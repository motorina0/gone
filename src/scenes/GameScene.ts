import Phaser from 'phaser';
import type {LoadedContent} from '../content/ContentTypes';
import {WorldState} from '../world/WorldState';
import type {MovementPace, WorldPoint} from '../world/WorldTypes';
import {GameClock} from '../world/GameClock';
import {ProjectionService} from '../projection/ProjectionService';
import {VIEW_IDS, type ViewId} from '../views/ViewManager';
import {GridNavigationService} from '../navigation/Pathfinding';
import {MovementSystem} from '../systems/MovementSystem';
import {HudController} from '../ui/HudController';
import {SettingsStore, type Settings} from '../persistence/SettingsStore';
import {APP_HEIGHT, APP_WIDTH} from '../app/AppConfig';
import {
  constrainCameraCenter,
  constrainCameraToPolygon,
  type ScreenPoint,
} from '../views/CameraBounds';

const MIN_ZOOM_LEVEL = 1;
const MAX_ZOOM_LEVEL = 5;
const TAP_DISTANCE = 10;
const DOUBLE_TAP_MS = 360;

interface TapRecord {
  at: number;
  x: number;
  y: number;
}

export class GameScene extends Phaser.Scene {
  private world!: WorldState;
  private projections!: ProjectionService;
  private navigation!: GridNavigationService;
  private movement = new MovementSystem();
  private clock = new GameClock();
  private sprite!: Phaser.GameObjects.Image;
  private markers!: Phaser.GameObjects.Graphics;
  private background!: Phaser.GameObjects.Image;
  private detail!: Phaser.GameObjects.Image;
  private foreground!: Phaser.GameObjects.Image;
  private hud!: HudController;
  private pointerStart?: {x: number; y: number; time: number};
  private pointerLast?: {x: number; y: number};
  private lastTap?: TapRecord;
  private destination?: WorldPoint;
  private panning = false;
  private pinchDistance = 0;
  private settingsStore = new SettingsStore();
  private settings!: Settings;
  private zoomLevel = MIN_ZOOM_LEVEL;
  private mapPolygon: ScreenPoint[] = [];

  constructor() {
    super('game');
  }

  create(): void {
    const content = this.registry.get('content') as LoadedContent;
    this.world = new WorldState(content);
    this.projections = new ProjectionService(content.projections);
    this.navigation = new GridNavigationService(content.world.bounds, content.blockers);
    this.settings = this.settingsStore.load();
    this.world.activeView = this.settings.preferredView;
    this.zoomLevel = Phaser.Math.Clamp(
      Math.round(this.settings.zoom),
      MIN_ZOOM_LEVEL,
      MAX_ZOOM_LEVEL,
    );
    this.world.camera.zoom = this.zoomLevel;

    this.background = this.add.image(0, 0, 'background-0').setOrigin(0).setDepth(0);
    this.detail = this.add.image(0, 0, 'detail-0').setOrigin(0).setDepth(1);
    this.markers = this.add.graphics().setDepth(2);
    this.sprite = this.add
      .image(0, 0, 'agent-isometric')
      .setDepth(3)
      .setName(this.world.player.id)
      .setScale(content.manifest.entityScale);
    this.foreground = this.add.image(0, 0, 'occlusion-0').setOrigin(0).setDepth(5);

    this.input.mouse?.disableContextMenu();
    this.input.addPointer(2);
    this.cameras.main.setZoom(this.world.camera.zoom);
    this.installInput();
    this.hud = new HudController({
      pause: () => this.togglePause(),
      restart: () => this.restartExploration(),
      pace: (pace) => this.setPace(pace),
      view: (id) => this.switchView(id as ViewId),
      zoom: (delta) => this.adjustZoom(delta),
    });
    this.switchView(this.world.activeView as ViewId);

    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.input.keyboard?.on('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
    this.installTestDiagnostics();
    this.hud.render(this.world);
  }

  update(_time: number, delta: number): void {
    this.clock.advance(Math.min(delta / 1000, 0.1), (dt) => this.step(dt));
    this.renderWorld();
    this.hud.render(this.world);
  }

  private step(dt: number): void {
    if (this.world.session.paused) return;
    const wasMoving = Boolean(this.world.player.moving);
    this.movement.update(this.world.entities, dt);
    if (wasMoving && !this.world.player.moving) {
      this.world.session.message = 'Destination reached.';
    }
    this.world.simulationTime += dt;
  }

  private installInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.pointerStart = {x: pointer.x, y: pointer.y, time: performance.now()};
      this.pointerLast = {x: pointer.x, y: pointer.y};
      this.panning = pointer.middleButtonDown() || pointer.rightButtonDown();
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const touches = this.input.manager.pointers.filter((item) => item.isDown);
      if (touches.length >= 2) {
        this.updatePinch(touches);
        return;
      }

      this.pinchDistance = 0;
      if (!pointer.isDown || !this.pointerStart) {
        this.updateCursor(pointer);
        return;
      }

      const moved = Math.hypot(
        pointer.x - this.pointerStart.x,
        pointer.y - this.pointerStart.y,
      );
      if (moved > TAP_DISTANCE) this.panning = true;
      if (this.panning && this.pointerLast) {
        const camera = this.cameras.main;
        camera.scrollX -=
          ((pointer.x - this.pointerLast.x) / camera.zoom) * this.settings.panSensitivity;
        camera.scrollY -=
          ((pointer.y - this.pointerLast.y) / camera.zoom) * this.settings.panSensitivity;
        this.constrainCamera();
      }
      this.pointerLast = {x: pointer.x, y: pointer.y};
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.pointerStart) return;
      const tap =
        !this.panning &&
        Math.hypot(pointer.x - this.pointerStart.x, pointer.y - this.pointerStart.y) <
          TAP_DISTANCE &&
        performance.now() - this.pointerStart.time < 500;
      this.pointerStart = undefined;
      this.pointerLast = undefined;
      this.panning = false;
      if (tap) this.issueOrder(pointer);
    });

    this.input.on(
      'wheel',
      (_pointer: unknown, _objects: unknown, _dx: number, dy: number) => {
        const next = Phaser.Math.Clamp(
          this.zoomLevel - dy * 0.002,
          MIN_ZOOM_LEVEL,
          MAX_ZOOM_LEVEL,
        );
        this.zoomLevel = next;
        this.world.camera.zoom = next;
        this.cameras.main.setZoom(next);
        this.constrainCamera();
        this.settings.zoom = next;
        this.saveSettings();
      },
    );
  }

  private updatePinch(touches: Phaser.Input.Pointer[]): void {
    const distance = Math.hypot(
      touches[0]!.x - touches[1]!.x,
      touches[0]!.y - touches[1]!.y,
    );
    if (this.pinchDistance > 0) {
      this.zoomLevel = Phaser.Math.Clamp(
        this.zoomLevel + (distance - this.pinchDistance) * 0.01,
        MIN_ZOOM_LEVEL,
        MAX_ZOOM_LEVEL,
      );
      this.world.camera.zoom = this.zoomLevel;
      this.cameras.main.setZoom(this.zoomLevel);
    }
    this.pinchDistance = distance;
    this.panning = true;
    this.constrainCamera();
  }

  private issueOrder(pointer: Phaser.Input.Pointer): void {
    if (this.world.session.paused) {
      this.world.session.message = 'Resume before issuing a movement order.';
      return;
    }

    const screen = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const point = this.projections.get(this.world.activeView).screenToWorld(screen);
    const now = performance.now();
    const doubleTap = Boolean(
      this.lastTap &&
        now - this.lastTap.at <= DOUBLE_TAP_MS &&
        Math.hypot(pointer.x - this.lastTap.x, pointer.y - this.lastTap.y) <= 32,
    );
    this.lastTap = {at: now, x: pointer.x, y: pointer.y};

    if (!this.navigation.isWalkable(point)) {
      this.destination = point;
      this.world.session.message = 'Route blocked. Choose a clear destination.';
      return;
    }

    const path = this.navigation.findPath(this.world.player.position, point);
    if (!path.length) {
      this.destination = point;
      this.world.session.message = 'Destination unreachable.';
      return;
    }

    const pace: MovementPace = doubleTap ? 'run' : this.world.session.pace;
    this.destination = point;
    this.movement.setPath(this.world.player.id, path, pace);
    this.world.player.pace = pace;
    this.world.player.moving = true;
    this.world.session.message = `${pace === 'run' ? 'Run' : 'Walk'} order accepted.`;
  }

  private updateCursor(pointer: Phaser.Input.Pointer): void {
    const canvas = this.game.canvas;
    const screen = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const point = this.projections.get(this.world.activeView).screenToWorld(screen);
    const walkable = this.navigation.isWalkable(point);
    canvas.classList.toggle('cursor-move', walkable);
    canvas.classList.toggle('cursor-blocked', !walkable);
  }

  private renderWorld(): void {
    const projection = this.projections.get(this.world.activeView);
    const player = this.world.player;
    const point = projection.worldToScreen(player.position);
    const heading = projection.worldToScreen({
      x: player.position.x + Math.cos(player.facing),
      y: player.position.y + Math.sin(player.facing),
      elevation: player.position.elevation,
    });
    const bob =
      player.moving && !this.settings.reducedMotion
        ? Math.sin(this.world.simulationTime * (player.pace === 'run' ? 15 : 10)) * 1.4
        : 0;
    this.sprite
      .setPosition(point.x, point.y + bob)
      .setTexture(this.world.activeView === 'view-top' ? 'agent-top' : 'agent-isometric')
      .setFlipX(heading.x < point.x)
      .setScale(this.world.content.manifest.entityScale);

    this.markers.clear();
    this.markers.fillStyle(0x07100a, 0.55).fillEllipse(point.x, point.y + 8, 25, 10);
    this.markers.lineStyle(2, 0xb9d879, 0.95).strokeCircle(point.x, point.y + 4, 16);

    if (this.destination) {
      const destination = projection.worldToScreen(this.destination);
      const walkable = this.navigation.isWalkable(this.destination);
      const pulse = 8 + Math.sin(this.world.simulationTime * 5) * 2;
      this.markers
        .lineStyle(2, walkable ? 0xd9c373 : 0xc65c4b, 0.95)
        .strokeCircle(destination.x, destination.y, pulse);
      this.markers.fillStyle(walkable ? 0xd9c373 : 0xc65c4b, 0.75).fillCircle(
        destination.x,
        destination.y,
        2,
      );
    }
  }

  private constrainCamera(): void {
    const camera = this.cameras.main;
    const canvas = this.game.canvas.getBoundingClientRect();
    const container = document.querySelector<HTMLElement>('#game')!.getBoundingClientRect();
    const center = constrainCameraCenter({
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
      viewportWidth: camera.width,
      viewportHeight: camera.height,
      zoom: camera.zoom,
      canvas,
      container,
      mapWidth: APP_WIDTH,
      mapHeight: APP_HEIGHT,
    });
    const bounded =
      this.zoomLevel === MIN_ZOOM_LEVEL
        ? center
        : constrainCameraToPolygon(
            center,
            this.mapPolygon,
            camera.width / (2 * camera.zoom),
            camera.height / (2 * camera.zoom),
          );
    camera.centerOn(bounded.x, bounded.y);
    this.world.camera.focus = this.projections
      .get(this.world.activeView)
      .screenToWorld(bounded);
  }

  private adjustZoom(delta: number): void {
    this.zoomLevel = Phaser.Math.Clamp(
      Math.round(this.zoomLevel) + delta,
      MIN_ZOOM_LEVEL,
      MAX_ZOOM_LEVEL,
    );
    this.world.camera.zoom = this.zoomLevel;
    this.cameras.main.setZoom(this.zoomLevel);
    if (delta > 0) {
      const player = this.projections
        .get(this.world.activeView)
        .worldToScreen(this.world.player.position);
      this.cameras.main.centerOn(player.x, player.y);
    }
    this.constrainCamera();
    this.settings.zoom = this.zoomLevel;
    this.saveSettings();
  }

  private switchView(id: ViewId): void {
    const index = VIEW_IDS.indexOf(id);
    if (index < 0) return;
    this.world.activeView = id;
    const projection = this.projections.get(id);
    const bounds = this.world.content.world.bounds;
    this.mapPolygon = [
      {x: bounds.minX, y: bounds.minY, elevation: 0},
      {x: bounds.maxX, y: bounds.minY, elevation: 0},
      {x: bounds.maxX, y: bounds.maxY, elevation: 0},
      {x: bounds.minX, y: bounds.maxY, elevation: 0},
    ].map((point) => projection.worldToScreen(point));
    const focus = projection.worldToScreen(this.world.camera.focus);
    this.cameras.main.centerOn(focus.x, focus.y);
    this.constrainCamera();
    this.background.setTexture(`background-${index}`);
    this.detail.setTexture(`detail-${index}`);
    this.foreground.setTexture(`occlusion-${index}`);
    this.settings.preferredView = id;
    this.saveSettings();
    this.renderWorld();
  }

  private setPace(pace: MovementPace): void {
    this.world.session.pace = pace;
    this.movement.setPace(this.world.player.id, pace);
    this.world.player.pace = pace;
    this.world.session.message = `${pace === 'run' ? 'Run' : 'Walk'} pace selected.`;
  }

  private togglePause(): void {
    this.world.session.paused = !this.world.session.paused;
    this.world.session.message = this.world.session.paused
      ? 'Exploration paused.'
      : 'Exploration resumed.';
  }

  private restartExploration(): void {
    const view = this.settings.preferredView as ViewId;
    this.movement.clear();
    this.destination = undefined;
    this.world.reset();
    this.world.camera.zoom = this.zoomLevel;
    this.cameras.main.setZoom(this.zoomLevel);
    this.world.session.message = 'Operative reset to deployment point.';
    this.switchView(view);
  }

  private visibilityHandler = (): void => {
    if (document.hidden && this.world) {
      this.world.session.paused = true;
      this.world.session.message = 'Paused while the tab is hidden.';
    }
  };

  private onKey = (event: KeyboardEvent): void => {
    const index = ['1', '2', '3', '4', '5'].indexOf(event.key);
    if (index >= 0) this.switchView(VIEW_IDS[index]!);
    if (event.code === 'Space') {
      event.preventDefault();
      this.togglePause();
    }
    if (event.code === 'KeyW') this.setPace('walk');
    if (event.code === 'KeyR') this.setPace('run');
    if (event.key === 'Escape') this.togglePause();
  };

  private saveSettings(): void {
    this.settingsStore.save(this.settings);
  }

  private installTestDiagnostics(): void {
    if (!new URLSearchParams(window.location.search).has('test')) return;
    Object.defineProperty(window, '__GONE_TEST__', {
      configurable: true,
      get: () => {
        const projection = this.projections.get(this.world.activeView);
        const player = this.world.player;
        return {
          activeView: this.world.activeView,
          player: {...player.position},
          playerScreen: projection.worldToScreen(player.position),
          playerScale: this.sprite.scaleX,
          playerMoving: Boolean(player.moving),
          movementPace: player.pace,
          entityCount: this.world.entities.size,
          aiSystemsEnabled: false,
          missionResourceLoaded: Boolean(this.world.content.mission),
          cameraFocus: {...this.world.camera.focus},
          cameraScreenCenter: {x: this.cameras.main.midPoint.x, y: this.cameras.main.midPoint.y},
          cameraZoom: this.world.camera.zoom,
          minimumZoom: MIN_ZOOM_LEVEL,
          zoomLevel: this.zoomLevel,
          playerDisplayHeight: this.sprite.displayHeight * this.cameras.main.zoom,
          session: {...this.world.session},
          loadedResources: true,
          testDestination: [
            {x: player.position.x + 40, y: player.position.y, elevation: 0},
            {x: player.position.x - 40, y: player.position.y, elevation: 0},
            {x: player.position.x, y: player.position.y + 40, elevation: 0},
            {x: player.position.x, y: player.position.y - 40, elevation: 0},
          ]
            .filter((world) => this.navigation.isWalkable(world))
            .map((world) => ({world, screen: projection.worldToScreen(world)}))[0],
        };
      },
    });
  }

  private shutdown(): void {
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.input.keyboard?.off('keydown', this.onKey);
    this.input.removeAllListeners();
    this.hud.destroy();
    Reflect.deleteProperty(window, '__GONE_TEST__');
  }
}
