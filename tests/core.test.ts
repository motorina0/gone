import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {GridNavigationService} from '../src/navigation/Pathfinding';
import {createProjection} from '../src/projection/Projection';
import {DEFAULT_SETTINGS, SettingsStore} from '../src/persistence/SettingsStore';
import {MovementSystem} from '../src/systems/MovementSystem';
import {
  constrainCameraCenter,
  constrainCameraToPolygon,
  minimumZoomForPolygon,
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
    const camera = {focus: point(12, 34), zoom: 1.2};
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
      expect(manifest.entityScale).toBe(0.42);
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
});
