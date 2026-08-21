import Phaser from 'phaser';
import type {LoadedContent} from '../content/ContentTypes';
import {WorldState} from '../world/WorldState';
import type {MovementPace, WorldPoint} from '../world/WorldTypes';
import {GameClock} from '../world/GameClock';
import {ProjectionService} from '../projection/ProjectionService';
import {
  DEFAULT_AGENT_SIZE_INCREASE_PERCENTAGE,
  entityScaleForProjection,
  projectedEntityHeight,
  visualScaleForIncreasePercentage,
} from '../projection/EntityScale';
import {VIEW_IDS, type ViewId} from '../views/ViewManager';
import {GridNavigationService} from '../navigation/Pathfinding';
import {MovementSystem} from '../systems/MovementSystem';
import {HudController} from '../ui/HudController';
import {SettingsStore, type Settings} from '../persistence/SettingsStore';
import {APP_HEIGHT, APP_WIDTH} from '../app/AppConfig';
import {
  centerForAnchoredZoom,
  constrainCameraToPolygon,
  overviewForPolygon,
  visibleStageRect,
  type ScreenPoint,
} from '../views/CameraBounds';
import {dampedCameraVelocity} from '../views/CameraMotion';
import {
  CLOSEUP_HEIGHT_FRACTION,
  tacticalZoomLevels,
  ZOOM_LEVEL_COUNT,
} from '../views/ZoomLevels';
import {overlayWorldMetrics, type OverlayWorldMetrics} from '../views/OverlayScale';

const SATELLITE_BASE_ZOOM = 0.1;
const TACTICAL_INITIAL_ZOOM = 3;
const TAP_DISTANCE = 10;
const DOUBLE_TAP_MS = 360;
const EDGE_SCROLL_ZONE = 24;
const CAMERA_PAN_SPEED = 320;
const CAMERA_ACCELERATION = 8;
const CAMERA_STOP_EPSILON = 1;
const CAMERA_FOLLOW_SPEED = 5;
const PATH_PREVIEW_INTERVAL = 70;
const MAX_SYNCHRONOUS_PREVIEW_HAZARDS = 1_000;
const PINCH_ZOOM_THRESHOLD = 36;
const AGENT_ORIGIN_Y = 0.94;

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
  private sprite!: Phaser.GameObjects.Sprite;
  private markers!: Phaser.GameObjects.Graphics;
  private background!: Phaser.GameObjects.Image;
  private backdrop!: Phaser.GameObjects.Image;
  private detail!: Phaser.GameObjects.Image;
  private foreground!: Phaser.GameObjects.Image;
  private hud!: HudController;
  private pointerStart?: {x: number; y: number; time: number};
  private pointerLast?: {x: number; y: number};
  private lastTap?: TapRecord;
  private destination?: WorldPoint;
  private previewPath: WorldPoint[] = [];
  private previewPoint?: WorldPoint;
  private previewUpdatedAt = 0;
  private invalidFeedbackUntil = 0;
  private panning = false;
  private pinchDistance = 0;
  private settingsStore = new SettingsStore();
  private settings!: Settings;
  private zoomLevel = TACTICAL_INITIAL_ZOOM;
  private tacticalZoomLevel = TACTICAL_INITIAL_ZOOM;
  private minimumZoom = SATELLITE_BASE_ZOOM;
  private mapPolygon: ScreenPoint[] = [];
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private edgePointer?: {x: number; y: number};
  private cameraVelocity = {x: 0, y: 0};
  private following = false;
  private readonly cameraMemory = new Map<ViewId, {focus: WorldPoint}>();
  private loadedViews = new Set<number>();
  private viewRequest = 0;
  private activeRenderingId = 'default';
  private activeAnimation = '';
  private readonly loadedCloseAgentDirections = new Set<number>();
  private readonly closeAgentLoads = new Map<number, Promise<void>>();
  private desiredCloseAgentDirection?: number;
  private overlayMetrics!: OverlayWorldMetrics;
  private lastCameraUpdateAt?: number;

  constructor() {
    super('game');
  }

  create(): void {
    const content = this.registry.get('content') as LoadedContent;
    this.activeRenderingId = content.defaultRendering;
    this.world = new WorldState(content);
    this.applyDefaultAgentSize();
    this.projections = new ProjectionService(content.projections);
    this.navigation = new GridNavigationService(
      content.walkable.bounds,
      content.blockers,
      content.walkable.cellSize,
      content.walkable.areas,
      content.walkable.connections,
      content.walkable.hazards,
    );
    this.settings = this.settingsStore.load();
    this.renderAttribution(content);
    const initialViewIndex = this.registry.get('initialViewIndex') as number;
    const initialView = VIEW_IDS[initialViewIndex] ?? 'view-0';
    this.loadedViews.add(initialViewIndex);
    this.world.activeView = initialView;
    this.tacticalZoomLevel = Phaser.Math.Clamp(
      Math.round(this.settings.zoom),
      1,
      ZOOM_LEVEL_COUNT,
    );
    this.zoomLevel =
      this.world.activeView === 'view-top' ? SATELLITE_BASE_ZOOM : 1;
    this.world.camera.zoom = this.zoomLevel;
    this.world.camera.minimumZoom = this.minimumZoom;

    this.backdrop = this.add
      .image(
        APP_WIDTH / 2,
        APP_HEIGHT / 2,
        `backdrop-${initialViewIndex}`,
      )
      .setDisplaySize(
        APP_WIDTH * content.backdropScale,
        APP_HEIGHT * content.backdropScale,
      )
      .setTint(
        Phaser.Display.Color.HexStringToColor(
          content.environment.atmosphere.backdropTints[initialViewIndex]!,
        ).color,
      )
      .setDepth(-1);
    this.background = this.add
      .image(0, 0, `background-${initialViewIndex}`)
      .setOrigin(0)
      .setDisplaySize(APP_WIDTH, APP_HEIGHT)
      .setDepth(0);
    this.detail = this.add
      .image(0, 0, `detail-${initialViewIndex}`)
      .setOrigin(0)
      .setDisplaySize(APP_WIDTH, APP_HEIGHT)
      .setDepth(1);
    this.markers = this.add.graphics().setDepth(2);
    this.createAgentAnimations(content);
    this.sprite = this.add
      .sprite(0, 0, 'agent-atlas', 0)
      .setOrigin(0.5, AGENT_ORIGIN_Y)
      .setDepth(3)
      .setName(this.world.player.id)
      .setScale(this.entityScaleForView(initialView));
    this.foreground = this.add
      .image(0, 0, `occlusion-${initialViewIndex}`)
      .setOrigin(0)
      .setDisplaySize(APP_WIDTH, APP_HEIGHT)
      .setDepth(5);

    this.input.mouse?.disableContextMenu();
    this.input.addPointer(2);
    this.cursors = this.input.keyboard?.createCursorKeys();
    this.cameras.main.setZoom(this.world.camera.zoom);
    this.installInput();
    this.hud = new HudController({
      pause: () => this.togglePause(),
      restart: () => this.restartExploration(),
      pace: (pace) => this.setPace(pace),
      view: (id) => this.switchView(id as ViewId),
      zoom: (delta) => this.adjustZoom(delta),
      follow: () => this.toggleFollow(),
      agentSize: (percentage) => this.setAgentSizePercentage(percentage),
      rendering: (id) => void this.switchRendering(id),
    });
    this.applyView(initialView, initialViewIndex, this.world.camera.focus);

    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.input.keyboard?.on('keydown', this.onKey);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdown());
    this.installTestDiagnostics();
    this.hud.render(
      this.world,
      this.following || this.isCloseup(),
      this.tacticalZoomLevel,
      this.activeRenderingId,
    );
  }

  update(time: number, delta: number): void {
    const cameraElapsed =
      this.lastCameraUpdateAt === undefined
        ? delta / 1000
        : (time - this.lastCameraUpdateAt) / 1000;
    this.lastCameraUpdateAt = time;
    this.updateCameraNavigation(cameraElapsed);
    this.clock.advance(Math.min(delta / 1000, 0.1), (dt) => this.step(dt));
    this.renderWorld();
    this.hud.render(
      this.world,
      this.following || this.isCloseup(),
      this.tacticalZoomLevel,
      this.activeRenderingId,
    );
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
      this.trackEdgePointer(pointer);
      this.pointerStart = {x: pointer.x, y: pointer.y, time: performance.now()};
      this.pointerLast = {x: pointer.x, y: pointer.y};
      this.panning = pointer.middleButtonDown() || pointer.rightButtonDown();
      if (this.panning) this.setFollowing(false);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.trackEdgePointer(pointer);
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
        this.setFollowing(false);
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

    this.input.on('gameout', () => {
      this.edgePointer = undefined;
    });

    this.input.on(
      'wheel',
      (pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
        if (this.world.activeView === 'view-top' || Math.abs(dy) < 1) return;
        this.adjustZoom(dy < 0 ? 1 : -1, {x: pointer.x, y: pointer.y});
      },
    );
  }

  private updatePinch(touches: Phaser.Input.Pointer[]): void {
    const distance = Math.hypot(
      touches[0]!.x - touches[1]!.x,
      touches[0]!.y - touches[1]!.y,
    );
    if (this.pinchDistance > 0) {
      const change = distance - this.pinchDistance;
      if (
        this.world.activeView !== 'view-top' &&
        Math.abs(change) >= PINCH_ZOOM_THRESHOLD
      ) {
        const centerX = (touches[0]!.x + touches[1]!.x) / 2;
        const centerY = (touches[0]!.y + touches[1]!.y) / 2;
        this.adjustZoom(change > 0 ? 1 : -1, {x: centerX, y: centerY});
        this.pinchDistance = distance;
      }
    } else {
      this.pinchDistance = distance;
    }
    this.panning = true;
    this.setFollowing(false);
    this.constrainCamera();
  }

  private issueOrder(pointer: Phaser.Input.Pointer): void {
    if (this.world.session.paused) {
      this.world.session.message = 'Resume before issuing a movement order.';
      return;
    }

    const screen = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const rawPoint = this.projections.get(this.world.activeView).screenToWorld(screen);
    const point = this.navigation.resolveDestination(rawPoint);
    const now = performance.now();
    const doubleTap = Boolean(
      this.lastTap &&
        now - this.lastTap.at <= DOUBLE_TAP_MS &&
        Math.hypot(pointer.x - this.lastTap.x, pointer.y - this.lastTap.y) <= 32,
    );
    this.lastTap = {at: now, x: pointer.x, y: pointer.y};

    if (!point) {
      this.destination = rawPoint;
      this.previewPath = [];
      this.invalidFeedbackUntil = this.world.simulationTime + 0.8;
      this.world.session.message = 'Route blocked. Choose a clear destination.';
      return;
    }

    const path = this.navigation.findPath(this.world.player.position, point);
    if (!path.length) {
      this.destination = point;
      this.previewPath = [];
      this.invalidFeedbackUntil = this.world.simulationTime + 0.8;
      this.world.session.message = 'Destination unreachable.';
      return;
    }

    const pace: MovementPace = doubleTap ? 'run' : this.world.session.pace;
    this.destination = point;
    this.previewPath = [];
    this.movement.setPath(this.world.player.id, path, pace);
    this.world.player.pace = pace;
    this.world.player.moving = true;
    this.world.session.message = `${pace === 'run' ? 'Run' : 'Walk'} order accepted.`;
  }

  private updateCursor(pointer: Phaser.Input.Pointer): void {
    const canvas = this.game.canvas;
    const screen = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const rawPoint = this.projections.get(this.world.activeView).screenToWorld(screen);
    const point = this.navigation.resolveDestination(rawPoint);
    const walkable = point !== undefined;
    canvas.classList.toggle('cursor-move', walkable);
    canvas.classList.toggle('cursor-blocked', !walkable);
    if ((this.world.content.walkable.hazards?.length ?? 0) > MAX_SYNCHRONOUS_PREVIEW_HAZARDS) {
      this.previewPath = [];
      return;
    }
    if (pointer.wasTouch || performance.now() - this.previewUpdatedAt < PATH_PREVIEW_INTERVAL) {
      return;
    }
    if (
      this.previewPoint &&
      point &&
      Math.hypot(point.x - this.previewPoint.x, point.y - this.previewPoint.y) <
        this.world.content.walkable.cellSize * 0.5
    ) {
      return;
    }
    this.previewUpdatedAt = performance.now();
    this.previewPoint = point ?? rawPoint;
    this.previewPath = point
      ? this.navigation.findPath(this.world.player.position, point)
      : [];
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
    const angle = Math.atan2(heading.y - point.y, heading.x - point.x);
    const direction = ((Math.round((angle / Math.PI) * 4) % 8) + 8) % 8;
    const motion =
      player.moving && !this.settings.reducedMotion
        ? player.pace === 'run'
          ? 'run'
          : 'walk'
        : 'idle';
    this.desiredCloseAgentDirection = this.isCloseup() ? direction : undefined;
    const closeupArt = this.usingCloseAgent(direction);
    const animation = `${closeupArt ? 'agent-close' : 'agent'}-${direction}-${motion}`;
    if (animation !== this.activeAnimation) {
      this.activeAnimation = animation;
      this.sprite.play(animation, true);
    }
    this.evictCloseAgentDirectionsExcept(this.desiredCloseAgentDirection);
    if (this.desiredCloseAgentDirection !== undefined && !closeupArt) {
      void this.ensureCloseAgentLoaded(this.desiredCloseAgentDirection);
    }
    this.sprite
      .setPosition(point.x, point.y)
      .setFlipX(false)
      .setScale(
        this.entityScaleForView(
          this.world.activeView,
          this.activeAgentVisibleHeightPixels(closeupArt),
        ),
      );

    const metrics = overlayWorldMetrics(this.cameras.main.zoom, this.world.simulationTime);
    this.overlayMetrics = metrics;
    this.markers.clear();
    this.markers
      .fillStyle(0x07100a, 0.55)
      .fillEllipse(
        point.x,
        point.y + metrics.agentShadowOffsetY,
        metrics.agentShadowWidth,
        metrics.agentShadowHeight,
      );
    this.markers
      .lineStyle(metrics.agentRingStrokeWidth, 0xb9d879, 0.95)
      .strokeEllipse(
        point.x,
        point.y + metrics.agentRingOffsetY,
        metrics.agentRingWidth,
        metrics.agentRingHeight,
      );

    const drawRoute = (
      route: WorldPoint[],
      color: number,
      alpha: number,
      strokeWidth: number,
      outlineWidth: number,
    ): void => {
      if (!route.length) return;
      const projected = [player.position, ...route].map((waypoint) =>
        projection.worldToScreen(waypoint),
      );
      this.markers.lineStyle(outlineWidth, 0x07100a, alpha * 0.62);
      this.markers.beginPath().moveTo(projected[0]!.x, projected[0]!.y);
      projected.slice(1).forEach((routePoint) => this.markers.lineTo(routePoint.x, routePoint.y));
      this.markers.strokePath();
      this.markers.lineStyle(strokeWidth, color, alpha);
      this.markers.beginPath().moveTo(projected[0]!.x, projected[0]!.y);
      projected.slice(1).forEach((routePoint) => this.markers.lineTo(routePoint.x, routePoint.y));
      this.markers.strokePath();
    };
    drawRoute(
      this.previewPath,
      0xa8c97a,
      0.34,
      metrics.previewPathStrokeWidth,
      metrics.previewPathOutlineWidth,
    );
    drawRoute(
      this.movement.getRemainingPath(player.id),
      0xd9c373,
      0.82,
      metrics.activePathStrokeWidth,
      metrics.activePathOutlineWidth,
    );

    if (this.destination) {
      const destination = projection.worldToScreen(this.destination);
      const walkable = this.navigation.isWalkable(this.destination);
      this.markers
        .lineStyle(metrics.destinationStrokeWidth, walkable ? 0xd9c373 : 0xc65c4b, 0.95)
        .strokeCircle(destination.x, destination.y, metrics.destinationRadius);
      this.markers.fillStyle(walkable ? 0xd9c373 : 0xc65c4b, 0.75).fillCircle(
        destination.x,
        destination.y,
        metrics.destinationDotRadius,
      );
      if (!walkable && this.world.simulationTime < this.invalidFeedbackUntil) {
        const size = metrics.invalidSize;
        this.markers
          .lineStyle(metrics.invalidStrokeWidth, 0xe46c58, 0.95)
          .lineBetween(destination.x - size, destination.y - size, destination.x + size, destination.y + size)
          .lineBetween(destination.x + size, destination.y - size, destination.x - size, destination.y + size);
      }
    }
  }

  private constrainCamera(): void {
    const camera = this.cameras.main;
    const canvas = this.game.canvas.getBoundingClientRect();
    const container = this.getPlayableContainerRect();
    const visible = visibleStageRect(canvas, container, APP_WIDTH, APP_HEIGHT);
    if (!this.mapPolygon.length || visible.width <= 0 || visible.height <= 0) return;
    const projection = this.projectionResource(this.world.activeView);
    const overview = overviewForPolygon(this.mapPolygon, visible.width, visible.height);
    const levels =
      this.world.activeView === 'view-top'
        ? [overview.zoom]
        : tacticalZoomLevels({
            polygon: this.mapPolygon,
            viewportWidth: visible.width,
            viewportHeight: visible.height,
            projectedEntityHeight: projectedEntityHeight(
              this.world.content.manifest,
              projection,
              this.world.player.worldHeightMeters,
              this.world.player.visualScale,
            ),
          });
    const nextZoom =
      this.world.activeView === 'view-top'
        ? overview.zoom
        : levels[this.tacticalZoomLevel - 1]!;
    this.minimumZoom = levels[0]!;
    this.zoomLevel = nextZoom;
    this.world.camera.minimumZoom = this.minimumZoom;
    this.world.camera.zoom = nextZoom;
    camera.setZoom(nextZoom);
    const visibleOffset = {
      x: (visible.left + visible.right) / 2 - camera.centerX,
      y: (visible.top + visible.bottom) / 2 - camera.centerY,
    };
    let requestedVisibleCenter = {
      x: camera.scrollX + camera.width / 2 + visibleOffset.x / camera.zoom,
      y: camera.scrollY + camera.height / 2 + visibleOffset.y / camera.zoom,
    };
    if (this.isCloseup()) {
      const player = this.projections
        .get(this.world.activeView)
        .worldToScreen(this.world.player.position);
      const visibleCenterY = (visible.top + visible.bottom) / 2;
      const definition = this.world.content.manifest.agentCloseAnimation;
      const targetAnchorY = definition
        ? visibleCenterY +
          (AGENT_ORIGIN_Y * definition.frameHeight -
            (definition.firstVisibleRow + definition.lastVisibleRow) / 2) *
            this.entityScaleForView(this.world.activeView, definition.visibleHeightPixels) *
            camera.zoom
        : visible.bottom - (visible.height * (1 - CLOSEUP_HEIGHT_FRACTION)) / 2;
      requestedVisibleCenter = {
        x: player.x,
        y: player.y - (targetAnchorY - visibleCenterY) / camera.zoom,
      };
    }
    const bounded =
      this.world.activeView === 'view-top'
        ? overview.center
        : constrainCameraToPolygon(
            requestedVisibleCenter,
            this.mapPolygon,
            visible.width / (2 * camera.zoom),
            visible.height / (2 * camera.zoom),
          );
    const cameraCenter = {
      x: bounded.x - visibleOffset.x / camera.zoom,
      y: bounded.y - visibleOffset.y / camera.zoom,
    };
    camera.centerOn(cameraCenter.x, cameraCenter.y);
    this.world.camera.focus = this.projections
      .get(this.world.activeView)
      .screenToWorld(cameraCenter);
  }

  private getPlayableContainerRect(): {left: number; top: number; right: number; bottom: number} {
    const game = document.querySelector<HTMLElement>('#game')!.getBoundingClientRect();
    const intel = document.querySelector<HTMLElement>('.intel-strip')?.getBoundingClientRect();
    const console = document.querySelector<HTMLElement>('.command-console')?.getBoundingClientRect();
    const cameraBank = document.querySelector<HTMLElement>('.camera-bank')?.getBoundingClientRect();
    return {
      left: game.left,
      top: Math.max(game.top, intel?.bottom ?? game.top),
      right: game.right,
      bottom: Math.min(game.bottom, console?.top ?? game.bottom, cameraBank?.top ?? game.bottom),
    };
  }

  private adjustZoom(delta: number, anchor?: ScreenPoint): void {
    if (this.world.activeView === 'view-top') return;
    const nextLevel = Phaser.Math.Clamp(
      this.tacticalZoomLevel + Math.sign(delta),
      1,
      ZOOM_LEVEL_COUNT,
    );
    if (nextLevel === this.tacticalZoomLevel) return;
    const camera = this.cameras.main;
    const canvas = this.game.canvas.getBoundingClientRect();
    const visible = visibleStageRect(
      canvas,
      this.getPlayableContainerRect(),
      APP_WIDTH,
      APP_HEIGHT,
    );
    const levels = tacticalZoomLevels({
      polygon: this.mapPolygon,
      viewportWidth: visible.width,
      viewportHeight: visible.height,
      projectedEntityHeight: projectedEntityHeight(
        this.world.content.manifest,
        this.projectionResource(this.world.activeView),
        this.world.player.worldHeightMeters,
        this.world.player.visualScale,
      ),
    });
    const nextZoom = levels[nextLevel - 1]!;
    if (anchor && nextLevel !== ZOOM_LEVEL_COUNT) {
      const center = centerForAnchoredZoom(
        {x: camera.scrollX + camera.width / 2, y: camera.scrollY + camera.height / 2},
        anchor,
        {x: camera.centerX, y: camera.centerY},
        camera.zoom,
        nextZoom,
      );
      camera.centerOn(center.x, center.y);
    } else if (delta > 0) {
      const player = this.projections
        .get(this.world.activeView)
        .worldToScreen(this.world.player.position);
      camera.centerOn(player.x, player.y);
    }
    this.tacticalZoomLevel = nextLevel;
    this.settings.zoom = nextLevel;
    this.zoomLevel = nextZoom;
    this.world.camera.zoom = nextZoom;
    camera.setZoom(nextZoom);
    this.constrainCamera();
    this.saveSettings();
    this.world.session.message = `Camera zoom level ${nextLevel} of ${ZOOM_LEVEL_COUNT}.`;
  }

  private async switchView(id: ViewId): Promise<void> {
    const index = VIEW_IDS.indexOf(id);
    if (index < 0 || id === this.world.activeView) return;
    const request = ++this.viewRequest;
    this.rememberCurrentCamera();
    const canonicalFocus = {...this.world.camera.focus};
    if (
      !this.loadedViews.has(index) ||
      !this.textures.exists(this.backgroundTextureKey(this.activeRenderingId, index))
    ) {
      this.world.session.message = `Loading ${id === 'view-top' ? 'satellite' : id.replace('view-', '') + '°'} view…`;
      try {
        await this.ensureViewLoaded(index);
      } catch (error) {
        this.world.session.message = 'Camera view could not be loaded.';
        console.error(error);
        return;
      }
    }
    if (request !== this.viewRequest) return;
    const memory = this.cameraMemory.get(id);
    const focus = memory?.focus ?? canonicalFocus;
    this.applyView(id, index, focus);
    this.world.session.message = `${id === 'view-top' ? 'Satellite' : id.replace('view-', '') + '°'} view ready.`;
  }

  private applyView(id: ViewId, index: number, canonicalFocus: WorldPoint): void {
    this.world.activeView = id;
    this.minimumZoom = SATELLITE_BASE_ZOOM;
    this.zoomLevel = SATELLITE_BASE_ZOOM;
    this.world.camera.zoom = this.zoomLevel;
    this.world.camera.minimumZoom = this.minimumZoom;
    this.cameras.main.setZoom(this.zoomLevel);
    const projection = this.projections.get(id);
    const bounds = this.world.content.world.bounds;
    const footprint = this.world.content.world.footprint ?? [
      {x: bounds.minX, y: bounds.minY, elevation: 0},
      {x: bounds.maxX, y: bounds.minY, elevation: 0},
      {x: bounds.maxX, y: bounds.maxY, elevation: 0},
      {x: bounds.minX, y: bounds.maxY, elevation: 0},
    ];
    this.mapPolygon = footprint.map((point) => projection.worldToScreen(point));
    const focus = projection.worldToScreen(canonicalFocus);
    this.cameras.main.centerOn(focus.x, focus.y);
    this.constrainCamera();
    this.background
      .setTexture(this.backgroundTextureKey(this.activeRenderingId, index))
      .setDisplaySize(APP_WIDTH, APP_HEIGHT);
    this.backdrop
      .setTexture(`backdrop-${index}`)
      .setDisplaySize(
        APP_WIDTH * this.world.content.backdropScale,
        APP_HEIGHT * this.world.content.backdropScale,
      )
      .setTint(
        Phaser.Display.Color.HexStringToColor(
          this.world.content.environment.atmosphere.backdropTints[index]!,
        ).color,
      );
    this.detail.setTexture(`detail-${index}`).setDisplaySize(APP_WIDTH, APP_HEIGHT);
    this.foreground
      .setTexture(`occlusion-${index}`)
      .setDisplaySize(APP_WIDTH, APP_HEIGHT);
    this.settings.preferredView = id;
    this.saveSettings();
    this.renderWorld();
  }

  private projectionResource(id: string) {
    const projection = this.world.content.projections.find((candidate) => candidate.id === id);
    if (!projection) throw new Error(`Projection resource not found: ${id}`);
    return projection;
  }

  private entityScaleForView(id: string, visibleHeightPixels?: number): number {
    return entityScaleForProjection(
      this.world.content.manifest,
      this.projectionResource(id),
      visibleHeightPixels,
      this.world.player.worldHeightMeters,
      this.world.player.visualScale,
    );
  }

  private setAgentSizePercentage(percentage: number): void {
    const clamped = Phaser.Math.Clamp(percentage, 0, 1000);
    this.world.player.visualScale = visualScaleForIncreasePercentage(clamped);
    this.world.session.message = `Temporary agent size calibration: +${Number(clamped.toFixed(2))}%.`;
    this.renderWorld();
  }

  private applyDefaultAgentSize(): void {
    this.world.player.visualScale = visualScaleForIncreasePercentage(
      DEFAULT_AGENT_SIZE_INCREASE_PERCENTAGE,
    );
  }

  private isCloseup(): boolean {
    return (
      this.world.activeView !== 'view-top' &&
      this.tacticalZoomLevel === ZOOM_LEVEL_COUNT
    );
  }

  private renderingById(id: string) {
    return this.world.content.renderings.find((rendering) => rendering.id === id);
  }

  private backgroundTextureKey(renderingId: string, index: number): string {
    return renderingId === this.world.content.defaultRendering
      ? `background-${index}`
      : `background-${renderingId}-${index}`;
  }

  private ensureRenderingBackground(renderingId: string, index: number): Promise<void> {
    const rendering = this.renderingById(renderingId);
    const url = rendering?.views[index];
    if (!rendering || !url) return Promise.reject(new Error(`Unknown rendering: ${renderingId}`));
    return this.loadTexture(this.backgroundTextureKey(renderingId, index), url);
  }

  private async switchRendering(id: string): Promise<void> {
    if (id === this.activeRenderingId || !this.renderingById(id)) return;
    const index = VIEW_IDS.indexOf(this.world.activeView as ViewId);
    this.world.session.message = `Loading ${id} rendering…`;
    try {
      await this.ensureRenderingBackground(id, index);
    } catch (error) {
      this.world.session.message = 'Map rendering could not be loaded.';
      console.error(error);
      return;
    }
    this.activeRenderingId = id;
    this.background
      .setTexture(this.backgroundTextureKey(id, index))
      .setDisplaySize(APP_WIDTH, APP_HEIGHT);
    this.world.session.message = `${this.renderingById(id)!.label} rendering ready.`;
    this.renderWorld();
  }

  private ensureViewLoaded(index: number): Promise<void> {
    const content = this.world.content;
    return Promise.all([
      this.loadTexture(`backdrop-${index}`, content.backdrops[index]!),
      this.ensureRenderingBackground(this.activeRenderingId, index),
      this.loadTexture(`detail-${index}`, content.detailOverlays[index]!),
      this.loadTexture(`occlusion-${index}`, content.occlusion[index]!),
    ]).then(() => {
      this.loadedViews.add(index);
    });
  }

  private loadTexture(key: string, url: string): Promise<void> {
    if (this.textures.exists(key)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        this.textures.addImage(key, image);
        resolve();
      };
      image.onerror = () => reject(new Error(`Failed to load texture: ${url}`));
      image.src = url;
    });
  }

  private ensureCloseAgentLoaded(direction: number): Promise<void> {
    if (this.loadedCloseAgentDirections.has(direction)) return Promise.resolve();
    const pending = this.closeAgentLoads.get(direction);
    if (pending) return pending;
    const content = this.world.content;
    const definition = content.manifest.agentCloseAnimation;
    const url = content.agentCloseAtlases[direction];
    if (!definition || !url) return Promise.resolve();
    const load = this.loadSpriteSheet(
      `agent-close-direction-${direction}`,
      url,
      definition.frameWidth,
      definition.frameHeight,
    )
      .then(() => {
        this.closeAgentLoads.delete(direction);
        if (this.desiredCloseAgentDirection !== direction) {
          this.removeCloseAgentDirection(direction);
          return;
        }
        this.createCloseAgentAnimations(content, direction);
        this.loadedCloseAgentDirections.add(direction);
        this.activeAnimation = '';
        this.renderWorld();
      })
      .catch((error: unknown) => {
        this.closeAgentLoads.delete(direction);
        if (this.desiredCloseAgentDirection === direction) {
          this.world.session.message = 'High-resolution operative art could not be loaded.';
        }
        console.error(error);
      });
    this.closeAgentLoads.set(direction, load);
    return load;
  }

  private loadSpriteSheet(
    key: string,
    url: string,
    frameWidth: number,
    frameHeight: number,
  ): Promise<void> {
    if (this.textures.exists(key)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        this.textures.addSpriteSheet(key, image, {frameWidth, frameHeight});
        resolve();
      };
      image.onerror = () => reject(new Error(`Failed to load sprite sheet: ${url}`));
      image.src = url;
    });
  }

  private rememberCurrentCamera(): void {
    this.constrainCamera();
    this.cameraMemory.set(this.world.activeView as ViewId, {
      focus: {...this.world.camera.focus},
    });
    this.cameraVelocity = {x: 0, y: 0};
  }

  private trackEdgePointer(pointer: Phaser.Input.Pointer): void {
    if (pointer.wasTouch) return;
    this.edgePointer = {x: pointer.x, y: pointer.y};
  }

  private updateCameraNavigation(dt: number): void {
    const dampingElapsed = Math.min(Math.max(dt, 0), 1);
    const movementElapsed = Math.min(dampingElapsed, 0.1);
    let horizontal = Number(Boolean(this.cursors?.right.isDown)) - Number(Boolean(this.cursors?.left.isDown));
    let vertical = Number(Boolean(this.cursors?.down.isDown)) - Number(Boolean(this.cursors?.up.isDown));
    if (this.edgePointer && !this.pointerStart) {
      const visible = visibleStageRect(
        this.game.canvas.getBoundingClientRect(),
        this.getPlayableContainerRect(),
        APP_WIDTH,
        APP_HEIGHT,
      );
      const insidePlayable =
        this.edgePointer.x >= visible.left &&
        this.edgePointer.x <= visible.right &&
        this.edgePointer.y >= visible.top &&
        this.edgePointer.y <= visible.bottom;
      if (insidePlayable) {
        if (this.edgePointer.x <= visible.left + EDGE_SCROLL_ZONE) horizontal -= 1;
        if (this.edgePointer.x >= visible.right - EDGE_SCROLL_ZONE) horizontal += 1;
        if (this.edgePointer.y <= visible.top + EDGE_SCROLL_ZONE) vertical -= 1;
        if (this.edgePointer.y >= visible.bottom - EDGE_SCROLL_ZONE) vertical += 1;
      }
    }
    const magnitude = Math.hypot(horizontal, vertical);
    const targetX = magnitude ? (horizontal / magnitude) * CAMERA_PAN_SPEED : 0;
    const targetY = magnitude ? (vertical / magnitude) * CAMERA_PAN_SPEED : 0;
    this.cameraVelocity.x = dampedCameraVelocity(
      this.cameraVelocity.x,
      targetX,
      dampingElapsed,
      CAMERA_ACCELERATION,
      CAMERA_STOP_EPSILON,
    );
    this.cameraVelocity.y = dampedCameraVelocity(
      this.cameraVelocity.y,
      targetY,
      dampingElapsed,
      CAMERA_ACCELERATION,
      CAMERA_STOP_EPSILON,
    );
    const camera = this.cameras.main;
    if (magnitude > 0) this.setFollowing(false);
    if (this.following && this.world.player.moving && magnitude === 0) {
      const target = this.projections
        .get(this.world.activeView)
        .worldToScreen(this.world.player.position);
      const followBlend = 1 - Math.exp(-CAMERA_FOLLOW_SPEED * dampingElapsed);
      camera.centerOn(
        Phaser.Math.Linear(camera.midPoint.x, target.x, followBlend),
        Phaser.Math.Linear(camera.midPoint.y, target.y, followBlend),
      );
    } else {
      camera.scrollX += (this.cameraVelocity.x * movementElapsed) / camera.zoom;
      camera.scrollY += (this.cameraVelocity.y * movementElapsed) / camera.zoom;
    }
    this.constrainCamera();
  }

  private createAgentAnimations(content: LoadedContent): void {
    const definition = content.manifest.agentAnimation;
    const motions = [
      {name: 'idle', columns: definition.idle, frameRate: 1},
      {name: 'walk', columns: definition.walk, frameRate: definition.walkFrameRate},
      {name: 'run', columns: definition.run, frameRate: definition.runFrameRate},
    ];
    const framesPerDirection =
      Math.max(...definition.idle, ...definition.walk, ...definition.run) + 1;
    for (let direction = 0; direction < definition.directions; direction += 1) {
      for (const motion of motions) {
        const key = `agent-${direction}-${motion.name}`;
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: motion.columns.map((column) => ({
            key: 'agent-atlas',
            frame: direction * framesPerDirection + column,
          })),
          frameRate: motion.frameRate,
          repeat: -1,
        });
      }
    }
  }

  private createCloseAgentAnimations(content: LoadedContent, direction: number): void {
    const definition = content.manifest.agentAnimation;
    const motions = [
      {name: 'idle', columns: definition.idle, frameRate: 1},
      {name: 'walk', columns: definition.walk, frameRate: definition.walkFrameRate},
      {name: 'run', columns: definition.run, frameRate: definition.runFrameRate},
    ];
    for (const motion of motions) {
      const key = `agent-close-${direction}-${motion.name}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: motion.columns.map((frame) => ({
          key: `agent-close-direction-${direction}`,
          frame,
        })),
        frameRate: motion.frameRate,
        repeat: -1,
      });
    }
  }

  private usingCloseAgent(direction?: number): boolean {
    return (
      this.isCloseup() &&
      (direction === undefined
        ? this.sprite.texture.key.startsWith('agent-close-direction-')
        : this.loadedCloseAgentDirections.has(direction))
    );
  }

  private evictCloseAgentDirectionsExcept(direction?: number): void {
    for (const loadedDirection of [...this.loadedCloseAgentDirections]) {
      if (loadedDirection !== direction) this.removeCloseAgentDirection(loadedDirection);
    }
  }

  private removeCloseAgentDirection(direction: number): void {
    for (const motion of ['idle', 'walk', 'run']) {
      const animation = `agent-close-${direction}-${motion}`;
      if (this.anims.exists(animation)) this.anims.remove(animation);
    }
    this.loadedCloseAgentDirections.delete(direction);
    const texture = `agent-close-direction-${direction}`;
    if (this.textures.exists(texture)) this.textures.remove(texture);
  }

  private activeAgentVisibleHeightPixels(closeupArt = this.usingCloseAgent()): number | undefined {
    const manifest = this.world.content.manifest;
    const close = manifest.agentCloseAnimation;
    if (closeupArt) return close?.visibleHeightPixels;
    if (this.isCloseup() && close) {
      return (close.visibleHeightPixels * manifest.agentAnimation.frameHeight) / close.frameHeight;
    }
    return manifest.agentAnimation.visibleHeightPixels;
  }

  private toggleFollow(): void {
    if (this.isCloseup()) {
      this.setFollowing(true);
      this.world.session.message = 'Close-up camera remains locked to the operative.';
      return;
    }
    this.setFollowing(!this.following);
    this.world.session.message = this.following
      ? 'Camera follow enabled.'
      : 'Camera follow disabled.';
  }

  private setFollowing(value: boolean): void {
    this.following = value;
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
    const view = this.world.activeView as ViewId;
    const viewIndex = VIEW_IDS.indexOf(view);
    this.movement.clear();
    this.destination = undefined;
    this.previewPath = [];
    this.world.reset();
    this.applyDefaultAgentSize();
    this.world.activeView = view;
    this.world.camera.zoom = this.zoomLevel;
    this.cameras.main.setZoom(this.zoomLevel);
    this.world.session.message = 'Operative reset to deployment point.';
    this.applyView(view, viewIndex, this.world.player.position);
  }

  private visibilityHandler = (): void => {
    if (document.hidden && this.world) {
      this.world.session.paused = true;
      this.world.session.message = 'Paused while the tab is hidden.';
    }
  };

  private onKey = (event: KeyboardEvent): void => {
    const index = ['1', '2', '3', '4', '5'].indexOf(event.key);
    if (index >= 0) void this.switchView(VIEW_IDS[index]!);
    if (event.code === 'Space') {
      event.preventDefault();
      this.togglePause();
    }
    if (event.code === 'KeyW') this.setPace('walk');
    if (event.code === 'KeyR') this.setPace('run');
    if (event.code === 'KeyF') this.toggleFollow();
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
          playerStage: {
            x:
              APP_WIDTH / 2 +
              (projection.worldToScreen(player.position).x - this.cameras.main.midPoint.x) *
                this.cameras.main.zoom,
            y:
              APP_HEIGHT / 2 +
              (projection.worldToScreen(player.position).y - this.cameras.main.midPoint.y) *
                this.cameras.main.zoom,
          },
          playerScale: this.sprite.scaleX,
          playerMoving: Boolean(player.moving),
          movementPace: player.pace,
          entityCount: this.world.entities.size,
          aiSystemsEnabled: false,
          missionResourceLoaded: Boolean(this.world.content.mission),
          cameraFocus: {...this.world.camera.focus},
          cameraScreenCenter: {x: this.cameras.main.midPoint.x, y: this.cameras.main.midPoint.y},
          cameraZoom: this.world.camera.zoom,
          minimumZoom: this.minimumZoom,
          zoomLevel: this.tacticalZoomLevel,
          playerDisplayHeight: this.sprite.displayHeight * this.cameras.main.zoom,
          playerVisibleHeight:
            this.sprite.displayHeight *
            (this.activeAgentVisibleHeightPixels() ??
              (this.usingCloseAgent()
                ? this.world.content.manifest.agentCloseAnimation?.frameHeight
                : this.world.content.manifest.agentAnimation.frameHeight)!) /
            (this.usingCloseAgent()
              ? this.world.content.manifest.agentCloseAnimation!.frameHeight
              : this.world.content.manifest.agentAnimation.frameHeight) *
            this.cameras.main.zoom,
          session: {...this.world.session},
          loadedResources: true,
          loadedViewCount: this.loadedViews.size,
          loadedViews: [...this.loadedViews],
          following: this.following,
          routePreviewLength: this.previewPath.length,
          activeRouteLength: this.movement.getRemainingPath(player.id).length,
          activeRouteElevations: [
            ...new Set(this.movement.getRemainingPath(player.id).map((point) => point.elevation)),
          ],
          animation: this.activeAnimation,
          closeAgentLoaded: this.usingCloseAgent(),
          retainedCloseAgentDirections: [...this.loadedCloseAgentDirections],
          pendingCloseAgentDirectionCount: this.closeAgentLoads.size,
          agentTexture: this.sprite.texture.key,
          animationFrame: this.sprite.anims.currentFrame?.index ?? 0,
          animationPlaying: this.sprite.anims.isPlaying,
          animationFrameCount: this.sprite.anims.currentAnim?.frames.length ?? 0,
          cameraVelocity: {...this.cameraVelocity},
          overlayWorldMetrics: {...this.overlayMetrics},
          projectedWorldBounds: this.mapPolygon.map((point) => ({...point})),
          backdropBounds: {
            left: this.backdrop.x - this.backdrop.displayWidth / 2,
            top: this.backdrop.y - this.backdrop.displayHeight / 2,
            right: this.backdrop.x + this.backdrop.displayWidth / 2,
            bottom: this.backdrop.y + this.backdrop.displayHeight / 2,
          },
          visibleStage: visibleStageRect(
            this.game.canvas.getBoundingClientRect(),
            this.getPlayableContainerRect(),
            APP_WIDTH,
            APP_HEIGHT,
          ),
          testDestination: [20, 40]
            .flatMap((distance) => [
              {
                x: player.position.x + distance,
                y: player.position.y,
                elevation: player.position.elevation,
              },
              {
                x: player.position.x - distance,
                y: player.position.y,
                elevation: player.position.elevation,
              },
              {
                x: player.position.x,
                y: player.position.y + distance,
                elevation: player.position.elevation,
              },
              {
                x: player.position.x,
                y: player.position.y - distance,
                elevation: player.position.elevation,
              },
            ])
            .map((world) => this.navigation.resolveDestination(world))
            .filter((world): world is WorldPoint => world !== undefined)
            .map((world) => ({world, screen: projection.worldToScreen(world)}))[0],
          testBlockedDestination: Array.from({length: 15}, (_, index) => (index + 1) * 4)
            .flatMap((distance) => [
              {
                x: player.position.x + distance,
                y: player.position.y,
                elevation: player.position.elevation,
              },
              {
                x: player.position.x - distance,
                y: player.position.y,
                elevation: player.position.elevation,
              },
              {
                x: player.position.x,
                y: player.position.y + distance,
                elevation: player.position.elevation,
              },
              {
                x: player.position.x,
                y: player.position.y - distance,
                elevation: player.position.elevation,
              },
            ])
            .filter((world) => this.navigation.resolveDestination(world) === undefined)
            .map((world) => ({world, screen: projection.worldToScreen(world)}))
            .find(
              ({screen}) =>
                Math.abs(screen.x - this.cameras.main.midPoint.x) <
                  this.cameras.main.width / (2 * this.cameras.main.zoom) - 5 &&
                Math.abs(screen.y - this.cameras.main.midPoint.y) <
                  this.cameras.main.height / (2 * this.cameras.main.zoom) - 5,
            ),
          testElevatedDestination: this.world.content.world.spawns.platformAccess
            ? {
                world: {...this.world.content.world.spawns.platformAccess},
                screen: projection.worldToScreen(this.world.content.world.spawns.platformAccess),
              }
            : undefined,
        };
      },
    });
  }

  private shutdown(): void {
    this.desiredCloseAgentDirection = undefined;
    this.evictCloseAgentDirectionsExcept();
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.input.keyboard?.off('keydown', this.onKey);
    this.input.removeAllListeners();
    this.hud.destroy();
    Reflect.deleteProperty(window, '__GONE_TEST__');
  }

  private renderAttribution(content: LoadedContent): void {
    const root = document.querySelector<HTMLElement>('[data-map-attribution]');
    if (!root) return;
    root.replaceChildren();
    const attribution = content.environment.attribution;
    if (!attribution) {
      root.hidden = true;
      return;
    }
    for (const item of [attribution.primary, attribution.secondary].filter(
      (candidate): candidate is {label: string; url: string} => candidate !== undefined,
    )) {
      const link = document.createElement('a');
      link.href = item.url;
      link.textContent = item.label;
      link.target = '_blank';
      link.rel = 'noreferrer';
      root.append(link);
    }
    if (attribution.legalNotice) {
      const details = document.createElement('details');
      details.className = 'attribution-legal';
      const summary = document.createElement('summary');
      summary.textContent = 'Notă legală DEM';
      const notice = document.createElement('p');
      notice.className = 'attribution-notice';
      notice.textContent = attribution.legalNotice;
      details.append(summary, notice);
      root.append(details);
    }
    root.hidden = false;
  }
}
