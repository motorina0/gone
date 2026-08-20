import {readFileSync, statSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import type {NavigationResource} from '../src/content/ContentTypes';
import {GridNavigationService} from '../src/navigation/Pathfinding';
import {createProjection} from '../src/projection/Projection';
import {DEFAULT_SETTINGS, SettingsStore} from '../src/persistence/SettingsStore';
import {MovementSystem} from '../src/systems/MovementSystem';
import {
  centerForAnchoredZoom,
  constrainCameraCenter,
  constrainCameraToPolygon,
  constrainCameraToPolygonBounds,
  minimumZoomForPolygon,
  overviewForPolygon,
  visibleStageRect,
} from '../src/views/CameraBounds';
import {VIEW_IDS, ViewManager} from '../src/views/ViewManager';
import type {EntityState, WorldPoint} from '../src/world/WorldTypes';

const LOCATION_IDS = ['piata-unirii', 'vatra-central-station'] as const;
const point = (x: number, y: number): WorldPoint => ({x, y, elevation: 0});
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const locationPath = (locationId: string, path: string): string =>
  `public/content/locations/${locationId}/${path}`;

const makePlayer = (): EntityState => ({
  id: 'player',
  name: 'Agent',
  kind: 'player',
  position: point(0, 0),
  speed: 5,
  runSpeed: 13,
  route: [],
  routeIndex: 0,
  selected: true,
  facing: 0,
  pace: 'walk',
  moving: false,
  exposure: 0,
});

describe('canonical projections', () => {
  for (const locationId of LOCATION_IDS) {
    for (const id of VIEW_IDS) {
      it(`${locationId}/${id} projects and inverses canonical world points`, () => {
        const data = readJson<Parameters<typeof createProjection>[0]>(
          locationPath(locationId, `projections/${id}.json`),
        );
        const projection = createProjection(data);
        const world = point(31.25, 54.5);
        const screen = projection.worldToScreen(world);
        expect(Number.isFinite(screen.x)).toBe(true);
        expect(projection.screenToWorld(screen)).toEqual(
          expect.objectContaining({x: expect.closeTo(world.x, 6), y: expect.closeTo(world.y, 6)}),
        );
      });
    }
  }

  it('preserves camera focus when switching view', () => {
    const camera = {focus: point(12, 34), zoom: 1.2, minimumZoom: 1};
    const switched = new ViewManager().switchTo('view-180', camera);
    expect(switched).toEqual(camera);
    expect(switched.focus).not.toBe(camera.focus);
  });

  it('keeps every projected world floor inside its 960 by 640 artwork', () => {
    for (const locationId of LOCATION_IDS) {
      const world = readJson<{bounds: {minX: number; minY: number; maxX: number; maxY: number}}>(
        locationPath(locationId, 'world.json'),
      );
      for (const id of VIEW_IDS) {
        const projection = createProjection(
          readJson<Parameters<typeof createProjection>[0]>(
            locationPath(locationId, `projections/${id}.json`),
          ),
        );
        const {minX, minY, maxX, maxY} = world.bounds;
        const corners = [point(minX, minY), point(maxX, minY), point(maxX, maxY), point(minX, maxY)]
          .map((worldPoint) => projection.worldToScreen(worldPoint));
        expect(Math.min(...corners.map(({x}) => x))).toBeGreaterThanOrEqual(0);
        expect(Math.max(...corners.map(({x}) => x))).toBeLessThanOrEqual(960);
        expect(Math.min(...corners.map(({y}) => y))).toBeGreaterThanOrEqual(0);
        expect(Math.max(...corners.map(({y}) => y))).toBeLessThanOrEqual(640);
      }
    }
  });
});

describe('single-operative exploration content', () => {
  for (const locationId of LOCATION_IDS) {
    it(`${locationId} loads exactly one player and no patrols`, () => {
      const manifest = readJson<{
        mode: string;
        entities: string[];
        patrols: string[];
        entityScale: number;
      }>(locationPath(locationId, 'manifest.json'));
      expect(manifest.mode).toBe('exploration');
      expect(manifest.entities).toEqual(['entities/player.json']);
      expect(manifest.patrols).toEqual([]);
      expect(manifest.entityScale).toBeGreaterThanOrEqual(0.1);
      const player = readJson<{kind: string; speed: number; runSpeed: number}>(
        locationPath(locationId, manifest.entities[0]!),
      );
      expect(player.kind).toBe('player');
      expect(player.runSpeed).toBeGreaterThan(player.speed);
    });
  }

  it('walk and run orders use distinct deterministic speeds', () => {
    const movement = new MovementSystem();
    const player = makePlayer();
    const entities = new Map([[player.id, player]]);
    movement.setPath(player.id, [point(100, 0)], 'walk');
    movement.update(entities, 1);
    expect(player.position.x).toBe(5);
    expect(player.pace).toBe('walk');
    movement.setPath(player.id, [point(100, 0)], 'run');
    movement.update(entities, 1);
    expect(player.position.x).toBe(18);
    expect(player.pace).toBe('run');
  });

  it('exposes only untraversed movement waypoints for route feedback', () => {
    const movement = new MovementSystem();
    const player = makePlayer();
    const entities = new Map([[player.id, player]]);
    movement.setPath(player.id, [point(5, 0), point(10, 0)], 'walk');

    movement.update(entities, 1);

    expect(movement.getRemainingPath(player.id)).toEqual([point(10, 0)]);
    movement.update(entities, 1);
    expect(movement.getRemainingPath(player.id)).toEqual([]);
  });

  it('routes the operative around canonical blockers', () => {
    const navigation = new GridNavigationService(
      {minX: 0, minY: 0, maxX: 30, maxY: 30},
      [{id: 'building', x: 8, y: 0, width: 4, height: 12}],
      2,
    );
    const path = navigation.findPath(point(2, 4), point(20, 4));
    expect(path.length).toBeGreaterThan(2);
    expect(path.every((pathPoint) => navigation.isWalkable(pathPoint))).toBe(true);
    expect(navigation.findPath(point(2, 2), point(9, 4))).toEqual([]);
  });

  it('never leaves authored walkable surfaces and smooths clear diagonal routes', () => {
    const areas = [
      {
        id: 'square',
        elevation: 0,
        points: [point(0, 0), point(10, 0), point(10, 10), point(0, 10)],
      },
    ];
    const navigation = new GridNavigationService(
      {minX: 0, minY: 0, maxX: 20, maxY: 20},
      [],
      2,
      areas,
    );
    expect(navigation.isWalkable(point(5, 5))).toBe(true);
    expect(navigation.isWalkable(point(15, 5))).toBe(false);
    expect(navigation.isWalkable({x: 5, y: 5, elevation: 7})).toBe(false);
    expect(navigation.findPath(point(2, 2), point(8, 8))).toEqual([point(8, 8)]);
    expect(navigation.findPath(point(2, 2), point(15, 5))).toEqual([]);
    expect(navigation.findPath(point(5, 5), {x: 5, y: 5, elevation: 7})).toEqual([]);
  });

  it('keeps smoothed Vatra routes continuously inside authored surfaces and blockers', () => {
    const resource = readJson<NavigationResource>(
      locationPath('vatra-central-station', 'navigation/walkable.json'),
    );
    const blockers = readJson<{rectangles: Array<{id: string; x: number; y: number; width: number; height: number}>}>(
      locationPath('vatra-central-station', 'navigation/blockers.json'),
    );
    const navigation = new GridNavigationService(
      resource.bounds,
      blockers.rectangles,
      resource.cellSize,
      resource.areas,
    );
    const cases: Array<[WorldPoint, WorldPoint]> = [
      [point(150, 165), point(300, 60)],
      [point(345.7635, 74.4106), point(115.8152, 239.1575)],
    ];
    for (const [origin, destination] of cases) {
      const path = navigation.findPath(origin, destination);
      expect(path.length).toBeGreaterThan(0);
      const route = [origin, ...path];
      let continuouslyWalkable = true;
      for (let index = 0; index < route.length - 1; index += 1) {
        const start = route[index]!;
        const end = route[index + 1]!;
        const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 0.05));
        for (let step = 0; step <= steps; step += 1) {
          const amount = step / steps;
          continuouslyWalkable &&= navigation.isWalkable({
            x: start.x + (end.x - start.x) * amount,
            y: start.y + (end.y - start.y) * amount,
            elevation: 0,
          });
        }
      }
      expect(continuouslyWalkable).toBe(true);
    }
  });

  for (const locationId of LOCATION_IDS) {
    it(`${locationId} keeps its deployment point on an authored navigation surface`, () => {
      const resource = readJson<NavigationResource>(locationPath(locationId, 'navigation/walkable.json'));
      const world = readJson<{spawns: {player: WorldPoint}}>(locationPath(locationId, 'world.json'));
      const navigation = new GridNavigationService(
        resource.bounds,
        [],
        resource.cellSize,
        resource.areas,
      );
      expect(resource.areas.length).toBeGreaterThan(0);
      expect(navigation.isWalkable(world.spawns.player)).toBe(true);
    });
  }
});

describe('data-driven environment artwork', () => {
  for (const locationId of LOCATION_IDS) {
    it(`${locationId} defines surfaces, architecture, props, and weather in world space`, () => {
      const environment = readJson<{
        atmosphere: {wetness: number};
        surfaces: Array<{id: string; type: string}>;
        landmarks: Array<{id: string}>;
        trees: unknown[];
        streetFurniture: Array<{type: string; blocksMovement?: boolean}>;
      }>(locationPath(locationId, 'environment.json'));
      expect(environment.atmosphere.wetness).toBeGreaterThan(0);
      expect(environment.surfaces.some(({type}) => type === 'road')).toBe(true);
      expect(environment.surfaces.some(({type}) => ['plaza', 'rail'].includes(type))).toBe(true);
      expect(environment.landmarks.length).toBeGreaterThanOrEqual(8);
      expect(environment.trees.length).toBeGreaterThan(0);
      expect(environment.streetFurniture.some(({type}) => type === 'car')).toBe(true);
      expect(
        environment.streetFurniture
          .filter(({type}) => ['car', 'maintenance-vehicle', 'freight-wagon', 'regional-train'].includes(type))
          .every(({blocksMovement}) => blocksMovement),
      ).toBe(true);
    });

    it(`${locationId} renders the same canonical content in all five views`, () => {
      for (const id of VIEW_IDS) {
        const svg = readFileSync(locationPath(locationId, `views/${id}.svg`), 'utf8');
        const occlusion = readFileSync(locationPath(locationId, `occlusion/${id}.svg`), 'utf8');
        expect(svg).toContain('data-surface=');
        expect(svg).toContain('data-landmark=');
        expect(svg).toContain('data-tree=');
        expect(svg).toContain('data-prop=');
        expect(svg).not.toContain('data-margin=');
        expect(svg).not.toContain('class="grid"');
        expect(occlusion).toContain('data-occluder=');
      }
    });
  }

  it('keeps the cathedral paint-over as replaceable external artwork', () => {
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const names = [
      'cathedral-wall.png',
      'cathedral-roof.png',
      ...VIEW_IDS.map((id) => `cathedral-${id.replace('view-', '')}.png`),
    ];
    for (const name of names) {
      const asset = readFileSync(locationPath('piata-unirii', `textures/${name}`));
      expect(asset.subarray(0, 8)).toEqual(pngSignature);
    }
  });

  it('keeps original raster materials and operative sprites as external assets', () => {
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    for (const name of [
      'industrial-wet-asphalt.png',
      'old-town-pavers.png',
      'weathered-masonry.png',
      'weathered-roof.png',
      'vatra-aged-steel.png',
      'vatra-platform-concrete.png',
    ]) {
      expect(readFileSync(`public/content/materials/${name}`).subarray(0, 8)).toEqual(pngSignature);
    }
    for (const locationId of LOCATION_IDS) {
      expect(
        readFileSync(locationPath(locationId, 'sprites/agent-atlas.png')).subarray(0, 8),
      ).toEqual(pngSignature);
      expect(readFileSync(locationPath(locationId, 'views/view-0.svg'), 'utf8')).toContain(
        '../../../materials/industrial-wet-asphalt.png',
      );
      const rendered = readFileSync(locationPath(locationId, 'views/view-0.webp'));
      expect(rendered.subarray(0, 4).toString()).toBe('RIFF');
      expect(rendered.subarray(8, 12).toString()).toBe('WEBP');
    }
  });

  it('ships editable Gone 3D sources with aligned Vatra runtime layers', () => {
    expect(readFileSync('art/vatra/vatra-central-station.blend').subarray(0, 7).toString()).toBe(
      'BLENDER',
    );
    expect(readFileSync('art/agent/gone-operative.blend').subarray(0, 7).toString()).toBe(
      'BLENDER',
    );
    const manifest = readJson<{
      views: string[];
      occlusion: string[];
      depthMaps: string[];
      detailOverlays: string[];
      agentAnimation: {directions: number; walk: number[]; run: number[]};
    }>(locationPath('vatra-central-station', 'manifest.json'));
    expect(manifest.views).toHaveLength(5);
    expect(manifest.occlusion).toHaveLength(5);
    expect(manifest.depthMaps).toHaveLength(5);
    expect(new Set(manifest.detailOverlays)).toEqual(new Set(['details/empty.svg']));
    expect(manifest.agentAnimation).toMatchObject({directions: 8});
    expect(manifest.agentAnimation.walk).toHaveLength(4);
    expect(manifest.agentAnimation.run).toHaveLength(4);
    const camera = readJson<{
      stageWidth: number;
      stageHeight: number;
      isometric: {backZ: number; orthoScale: number};
      top: {orthoScale: number};
    }>('art/vatra/camera-config.json');
    const projection = readJson<{
      elevation: number;
      matrix: [number, number, number, number];
      scale: number;
    }>(locationPath('vatra-central-station', 'projections/view-0.json'));
    const normalizedBack = Math.hypot(1, camera.isometric.backZ);
    const pixelsPerUnit = camera.stageHeight / camera.isometric.orthoScale;
    const rightX = Math.SQRT1_2;
    const upX = (camera.isometric.backZ / normalizedBack) * Math.SQRT1_2;
    const upZ = 1 / normalizedBack;
    expect((Math.atan(camera.isometric.backZ) * 180) / Math.PI).toBeCloseTo(
      projection.elevation,
      3,
    );
    expect(Math.abs(projection.matrix[0]) * projection.scale).toBeCloseTo(
      rightX * pixelsPerUnit,
      3,
    );
    expect(Math.abs(projection.matrix[2]) * projection.scale).toBeCloseTo(
      upX * pixelsPerUnit,
      3,
    );
    expect(projection.scale).toBeCloseTo(upZ * pixelsPerUnit, 3);
    const topProjection = readJson<{scale: number}>(
      locationPath('vatra-central-station', 'projections/view-top.json'),
    );
    expect(topProjection.scale).toBeCloseTo(camera.stageHeight / camera.top.orthoScale, 3);
    for (const asset of [...manifest.views, ...manifest.occlusion, ...manifest.depthMaps]) {
      const bytes = readFileSync(locationPath('vatra-central-station', asset));
      expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
    }
  });
});

describe('settings and camera behavior', () => {
  it('serializes settings and recovers corrupted storage', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
    const store = new SettingsStore(storage);
    store.save({...DEFAULT_SETTINGS, preferredView: 'view-top'});
    expect(store.load().preferredView).toBe('view-top');
    data.set('gone.settings', '{broken');
    expect(store.load()).toEqual(DEFAULT_SETTINGS);
  });

  it('supports a full-map overview and caps persisted zoom', () => {
    expect(DEFAULT_SETTINGS.zoom).toBe(1);
    const storage = {
      getItem: () => JSON.stringify({...DEFAULT_SETTINGS, zoom: 99}),
      setItem: () => undefined,
    };
    expect(new SettingsStore(storage).load().zoom).toBe(5);
  });

  it('constrains panning to the rendered map', () => {
    const input = {
      viewportWidth: 960,
      viewportHeight: 640,
      zoom: 1,
      canvas: {left: -120, top: 0, right: 1080, bottom: 800},
      container: {left: 0, top: 0, right: 960, bottom: 640},
      mapWidth: 960,
      mapHeight: 640,
      scrollX: 80,
      scrollY: 40,
    };
    expect(constrainCameraCenter(input)).toEqual({x: 560, y: 360});
    expect(constrainCameraCenter({...input, scrollX: -1000, scrollY: -1000})).toEqual({
      x: 384,
      y: 256,
    });
  });

  it('keeps the world point under the pointer fixed while zooming', () => {
    const center = {x: 500, y: 320};
    const pointer = {x: 748.8, y: 217.6};
    const viewportCenter = {x: 480, y: 320};
    const before = {
      x: center.x + (pointer.x - viewportCenter.x) / 3,
      y: center.y + (pointer.y - viewportCenter.y) / 3,
    };
    const afterCenter = centerForAnchoredZoom(center, pointer, viewportCenter, 3, 3.64);
    const after = {
      x: afterCenter.x + (pointer.x - viewportCenter.x) / 3.64,
      y: afterCenter.y + (pointer.y - viewportCenter.y) / 3.64,
    };
    expect(after).toEqual(before);
  });

  it('derives crop-aware stage bounds and a whole-map overview', () => {
    const visible = visibleStageRect(
      {left: -438, top: 0, right: 828, bottom: 844},
      {left: 0, top: 0, right: 390, bottom: 844},
      960,
      640,
    );
    expect(visible.left).toBeCloseTo(332.13, 1);
    expect(visible.right).toBeCloseTo(627.87, 1);
    expect(visible.width).toBeCloseTo(295.73, 1);
    const overview = overviewForPolygon(
      [{x: 50, y: 100}, {x: 650, y: 100}, {x: 650, y: 460}, {x: 50, y: 460}],
      visible.width,
      visible.height,
    );
    expect(overview.center).toEqual({x: 350, y: 280});
    expect(overview.zoom).toBeCloseTo(visible.width / 600, 5);
  });

  it('derives a zoom and focus within an isometric floor polygon', () => {
    const diamond = [
      {x: 480, y: 70},
      {x: 910, y: 320},
      {x: 480, y: 570},
      {x: 50, y: 320},
    ];
    const zoom = minimumZoomForPolygon(diamond, 960, 640);
    expect(zoom).toBeGreaterThan(1);
    expect(zoom).toBeLessThan(5);
    const center = constrainCameraToPolygon(
      {x: 480, y: 320},
      diamond,
      480 / zoom,
      320 / zoom,
    );
    expect(center.x).toBeCloseTo(480, 4);
    expect(center.y).toBeCloseTo(320, 4);
  });

  it('keeps a close tactical camera inside the projected world bounds', () => {
    const diamond = [
      {x: 480, y: 70},
      {x: 910, y: 320},
      {x: 480, y: 570},
      {x: 50, y: 320},
    ];
    expect(constrainCameraToPolygonBounds({x: 20, y: 900}, diamond, 200, 130)).toEqual({
      x: 250,
      y: 440,
    });
  });
});

describe('mobile asset budgets', () => {
  it('keeps every runtime view and character atlas within a bounded download budget', () => {
    for (const locationId of LOCATION_IDS) {
      const viewSizes = VIEW_IDS.map((id) =>
        statSync(locationPath(locationId, `views/${id}.webp`)).size,
      );
      expect(Math.max(...viewSizes)).toBeLessThan(2_000_000);
      expect(viewSizes.reduce((total, size) => total + size, 0)).toBeLessThan(8_000_000);
      expect(statSync(locationPath(locationId, 'sprites/agent-atlas.png')).size).toBeLessThan(
        2_000_000,
      );
      if (locationId === 'vatra-central-station') {
        const occlusionBytes = VIEW_IDS.reduce(
          (total, id) => total + statSync(locationPath(locationId, `occlusion-3d/${id}.webp`)).size,
          0,
        );
        expect(occlusionBytes).toBeLessThan(2_000_000);
      }
    }
  });
});
