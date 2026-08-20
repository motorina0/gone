import {readFileSync, statSync} from 'node:fs';
import sharp from 'sharp';
import {describe, expect, it} from 'vitest';
import {environmentPropBlocker} from '../src/content/ContentLoader';
import type {
  EnvironmentProp,
  NavigationResource,
  Rect,
  WalkableArea,
} from '../src/content/ContentTypes';
import {GridNavigationService} from '../src/navigation/Pathfinding';
import {createLocalGeoTransform} from '../src/geography/LocalGeoTransform';
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

const LOCATION_IDS = ['piata-unirii', 'vatra-central-station', 'cluj-napoca-station'] as const;
const RASTER_LOCATION_IDS = ['piata-unirii', 'vatra-central-station'] as const;
const point = (x: number, y: number): WorldPoint => ({x, y, elevation: 0});
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const locationPath = (locationId: string, path: string): string =>
  `public/content/locations/${locationId}/${path}`;
const areaCenter = (area: WalkableArea): WorldPoint => {
  const center = {
    x: area.points.reduce((sum, candidate) => sum + candidate.x, 0) / area.points.length,
    y: area.points.reduce((sum, candidate) => sum + candidate.y, 0) / area.points.length,
  };
  const plane = area.elevationPlane;
  return {
    ...center,
    elevation: plane
      ? plane.originElevation +
        plane.slopeX * (center.x - plane.originX) +
        plane.slopeY * (center.y - plane.originY)
      : area.elevation,
  };
};

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

  it('authors the Vatra fidelity benchmark as editable Gone world data', () => {
    const environment = readJson<{
      disclaimer: string;
      atmosphere: {puddleCount: number; leafLitterCount: number};
      surfaces: Array<{markings?: string}>;
      landmarks: Array<{
        id: string;
        type: string;
        material?: string;
        roof?: string;
        canopies?: Array<{offset: number; length: number}>;
      }>;
      streetFurniture: EnvironmentProp[];
      distantSurfaces: Array<{id: string; type: string; markings?: string}>;
      distantScenery: Array<{id: string; type: string}>;
    }>(locationPath('vatra-central-station', 'environment.json'));
    expect(environment.disclaimer).toContain('Original fictional station district');
    expect(environment.atmosphere.puddleCount).toBeGreaterThanOrEqual(40);
    expect(environment.atmosphere.leafLitterCount).toBeGreaterThanOrEqual(100);
    expect(environment.surfaces.filter(({markings}) => markings).length).toBeGreaterThanOrEqual(3);
    expect(environment.landmarks.every(({material}) => Boolean(material))).toBe(true);
    expect(environment.landmarks.filter(({roof}) => roof).length).toBeGreaterThanOrEqual(15);
    expect(
      environment.landmarks
        .filter(({type}) => type === 'platform')
        .reduce((total, {canopies = []}) => total + canopies.length, 0),
    ).toBeGreaterThanOrEqual(4);
    expect(environment.streetFurniture.length).toBeGreaterThanOrEqual(75);
    const propTypes = new Set(environment.streetFurniture.map(({type}) => type));
    for (const type of [
      'car',
      'regional-train',
      'freight-wagon',
      'lamp',
      'platform-sign',
      'signal',
      'kiosk',
      'crosswalk',
      'gantry',
      'fence',
      'service-cart',
    ]) {
      expect(propTypes.has(type), `missing ${type} from Vatra dressing`).toBe(true);
    }
    const substantialPropTypes = new Set([
      'kiosk',
      'planter',
      'crate-stack',
      'utility-cabinet',
      'fence',
      'service-cart',
    ]);
    const substantialProps = environment.streetFurniture.filter(({type}) =>
      substantialPropTypes.has(type),
    );
    expect(substantialProps.length).toBeGreaterThanOrEqual(15);
    for (const prop of substantialProps) {
      expect(prop.blocksMovement, `${prop.id} must block movement`).toBe(true);
      expect(prop.width, `${prop.id} must author collision width`).toBeGreaterThan(0);
      expect(prop.depth, `${prop.id} must author collision depth`).toBeGreaterThan(0);
    }
    expect(environment.distantSurfaces.length).toBeGreaterThanOrEqual(12);
    expect(environment.distantSurfaces.filter(({markings}) => markings).length).toBeGreaterThanOrEqual(6);
    expect(environment.distantScenery.length).toBeGreaterThanOrEqual(30);
    expect(new Set(environment.distantScenery.map(({id}) => id)).size).toBe(
      environment.distantScenery.length,
    );
  });

  it('routes around substantial Vatra scenery instead of walking through it', () => {
    const environment = readJson<{streetFurniture: EnvironmentProp[]}>(
      locationPath('vatra-central-station', 'environment.json'),
    );
    const walkable = readJson<NavigationResource>(
      locationPath('vatra-central-station', 'navigation/walkable.json'),
    );
    const staticBlockers = readJson<{rectangles: Rect[]}>(
      locationPath('vatra-central-station', 'navigation/blockers.json'),
    ).rectangles;
    const environmentBlockers = environment.streetFurniture
      .map(environmentPropBlocker)
      .filter((blocker): blocker is Rect => blocker !== undefined);
    const navigation = new GridNavigationService(
      walkable.bounds,
      [...staticBlockers, ...environmentBlockers],
      walkable.cellSize,
      walkable.areas,
    );
    const cases = [
      {id: 'forecourt-kiosk', from: point(98, 148), to: point(110, 148)},
      {id: 'platform-cart-01', from: point(200, 69), to: point(210, 69)},
      {id: 'freight-fence-south', from: point(370, 260), to: point(370, 278)},
      {id: 'freight-fence-east', from: point(525, 265), to: point(538, 265)},
      {id: 'freight-crates-01', from: point(364, 252), to: point(376, 252)},
      {id: 'forecourt-planter-01', from: point(11, 157), to: point(21, 157)},
      {id: 'signal-cabinet-01', from: point(126, 100), to: point(138, 100)},
    ];

    for (const {id, from, to} of cases) {
      const prop = environment.streetFurniture.find((candidate) => candidate.id === id)!;
      expect(prop, `missing ${id}`).toBeDefined();
      expect(navigation.isWalkable(point(prop.x, prop.y)), `${id} center is traversable`).toBe(false);
      const path = navigation.findPath(from, to);
      expect(path.length, `${id} still has a direct path`).not.toBe(1);
      const route = [from, ...path];
      for (let index = 0; index < route.length - 1; index += 1) {
        const start = route[index]!;
        const end = route[index + 1]!;
        const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 0.05));
        for (let step = 0; step <= steps; step += 1) {
          const amount = step / steps;
          expect(
            navigation.isWalkable({
              x: start.x + (end.x - start.x) * amount,
              y: start.y + (end.y - start.y) * amount,
              elevation: 0,
            }),
            `${id} route crosses blocked scenery`,
          ).toBe(true);
        }
      }
    }
  });

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

  it('interpolates canonical elevation while traversing a stair connection', () => {
    const movement = new MovementSystem();
    const player = makePlayer();
    const entities = new Map([[player.id, player]]);
    movement.setPath(player.id, [{x: 10, y: 0, elevation: 4}], 'walk');

    movement.update(entities, 1);

    expect(player.position).toEqual({x: 5, y: 0, elevation: 2});
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

describe('Cluj-Napoca station geographic content', () => {
  it('converts WGS84 coordinates to the documented local metre world deterministically', () => {
    const world = readJson<{
      bounds: {minX: number; minY: number; maxX: number; maxY: number};
      geography: {
        geographicBounds: {west: number; east: number; south: number; north: number};
        anchor: {latitude: number; longitude: number; world: WorldPoint};
      };
    }>(locationPath('cluj-napoca-station', 'world.json'));
    const transform = createLocalGeoTransform(world.geography.geographicBounds);
    const anchor = transform.toWorld(world.geography.anchor);
    const restored = transform.toGeographic(anchor);

    expect(anchor.x).toBeCloseTo(world.geography.anchor.world.x, 3);
    expect(anchor.y).toBeCloseTo(world.geography.anchor.world.y, 3);
    expect(restored.longitude).toBeCloseTo(world.geography.anchor.longitude, 10);
    expect(restored.latitude).toBeCloseTo(world.geography.anchor.latitude, 10);
    expect(world.bounds.maxX).toBeCloseTo(725.436, 3);
    expect(world.bounds.maxY).toBeCloseTo(466.9, 3);
    expect(transform.toWorld({
      longitude: world.geography.geographicBounds.west,
      latitude: world.geography.geographicBounds.south,
    })).toEqual(point(0, 0));
  });

  it('records open-data licences, retrievals, transformations, and the empty OAM result', () => {
    const osm = readJson<{
      retrievedAt: string;
      sourceSha256: string;
      attribution: string;
      licence: string;
      transformations: string[];
      features: Array<{id: string; tags: Record<string, string>}>;
    }>('data/cluj-napoca-station/osm-source.json');
    const terrain = readJson<{
      retrievedAt: string;
      sourceSha256: string;
      referenceElevationMeters: number;
      attribution: string;
      liabilityNotice: string;
      canonicalModel: {
        type: string;
        slopeEastMetersPerMeter: number;
        slopeNorthMetersPerMeter: number;
      };
      transformations: string[];
      samples: unknown[];
    }>('data/cluj-napoca-station/terrain-source.json');
    const aerial = readJson<{found: number; result: unknown[]; decision: string}>(
      'data/cluj-napoca-station/openaerialmap-coverage.json',
    );
    const environment = readJson<{
      attribution: {legalNotice: string; secondary: {url: string}};
    }>(locationPath('cluj-napoca-station', 'environment.json'));
    const world = readJson<{geography: {terrainSourceId: string}}>(
      locationPath('cluj-napoca-station', 'world.json'),
    );

    expect(osm.retrievedAt).toBe('2026-08-20');
    expect(osm.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(osm.attribution).toBe('© OpenStreetMap contributors');
    expect(osm.licence).toContain('ODbL');
    expect(osm.transformations.length).toBeGreaterThanOrEqual(3);
    expect(osm.features.length).toBeGreaterThan(600);
    expect(osm.features.filter(({tags}) => tags.entrance !== undefined)).toHaveLength(6);
    expect(terrain.retrievedAt).toBe('2026-08-20');
    expect(terrain.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(terrain.referenceElevationMeters).toBeCloseTo(336.559, 3);
    expect(terrain.attribution).toContain('Copernicus WorldDEM-30');
    expect(terrain.liabilityNotice).toContain('do not incur any liability');
    expect(terrain.canonicalModel.type).toBe('robust-planar-fit');
    expect(Math.abs(terrain.canonicalModel.slopeEastMetersPerMeter)).toBeGreaterThan(0.001);
    expect(Math.abs(terrain.canonicalModel.slopeNorthMetersPerMeter)).toBeGreaterThan(0.001);
    expect(terrain.transformations.length).toBeGreaterThanOrEqual(4);
    expect(terrain.samples).toHaveLength(35);
    expect(environment.attribution.legalNotice).toContain(terrain.attribution);
    expect(environment.attribution.legalNotice).toContain(terrain.liabilityNotice);
    expect(environment.attribution.secondary.url).toContain('cop_dem_licenses.pdf');
    expect(world.geography.terrainSourceId).toBe('cluj-napoca-station-terrain-source');
    expect(aerial.found).toBe(0);
    expect(aerial.result).toEqual([]);
    expect(aerial.decision).toContain('no raster imagery was used');
  });

  it('models the Copernicus terrain plane in canonical walkable elevations', () => {
    const resource = readJson<NavigationResource>(
      locationPath('cluj-napoca-station', 'navigation/walkable.json'),
    );
    const forecourt = resource.areas.find(({id}) => id === 'piata-garii-forecourt')!;
    const plane = forecourt.elevationPlane!;
    const elevations = forecourt.points.map(({elevation}) => elevation);

    expect(plane.slopeX).toBeCloseTo(-0.005684726, 8);
    expect(plane.slopeY).toBeCloseTo(-0.00384408, 8);
    expect(Math.max(...elevations) - Math.min(...elevations)).toBeGreaterThan(1);
    expect(areaCenter(forecourt).elevation).toBeCloseTo(forecourt.elevation, 2);
  });

  it('routes from the public forecourt through the tunnel to every mapped passenger platform', () => {
    const resource = readJson<NavigationResource>(
      locationPath('cluj-napoca-station', 'navigation/walkable.json'),
    );
    const blockers = readJson<{rectangles: Rect[]}>(
      locationPath('cluj-napoca-station', 'navigation/blockers.json'),
    ).rectangles;
    const world = readJson<{spawns: {player: WorldPoint}}>(
      locationPath('cluj-napoca-station', 'world.json'),
    );
    const connections = resource.connections ?? [];
    const navigation = new GridNavigationService(
      resource.bounds,
      blockers,
      resource.cellSize,
      resource.areas,
      connections,
      resource.hazards,
    );
    expect(connections.some(({id}) => id.startsWith('portal-'))).toBe(false);
    expect(connections.map(({id}) => id)).toEqual(
      expect.arrayContaining([
        'stairs-way-892692965',
        'approximate-stairs-platform-4-5',
        'approximate-stairs-platform-6-7',
      ]),
    );
    expect(navigation.isWalkable(world.spawns.player)).toBe(true);
    const platforms = resource.areas.filter((area) => area.id.startsWith('platform-way-'));
    expect(platforms.map(({id}) => id).sort()).toEqual(
      [
        'platform-way-1416233688',
        'platform-way-215798523',
        'platform-way-215798526',
        'platform-way-215798529',
        'platform-way-215798532',
      ].sort(),
    );
    let expandedNodes = 0;
    let walkabilityChecks = 0;
    let segmentSamples = 0;
    for (const platform of platforms) {
      const destination = areaCenter(platform);
      const route = navigation.findPath(world.spawns.player, destination);
      const diagnostics = navigation.getLastSearchDiagnostics();
      expandedNodes += diagnostics.expandedNodes;
      walkabilityChecks += diagnostics.walkabilityChecks;
      segmentSamples += diagnostics.segmentSamples;
      expect(navigation.isWalkable(destination), platform.id).toBe(true);
      expect(route.length, platform.id).toBeGreaterThan(2);
    }
    expect(expandedNodes).toBeLessThan(35_000);
    expect(walkabilityChecks).toBeLessThan(250_000);
    expect(segmentSamples).toBeLessThan(200_000);

    const platform = platforms.find((area) => area.id === 'platform-way-215798526')!;
    const route = navigation.findPath(world.spawns.player, areaCenter(platform));
    const offsets = new Set(
      route.map((waypoint) => {
        const plane = platform.elevationPlane!;
        const terrainElevation =
          plane.slopeX * (waypoint.x - plane.originX) +
          plane.slopeY * (waypoint.y - plane.originY);
        return Number((waypoint.elevation - terrainElevation).toFixed(2));
      }),
    );
    for (const offset of [0, -3.2, 0.55]) expect(offsets.has(offset), `${offset} m layer`).toBe(true);
  }, 30_000);

  it('keeps station interiors, railway tracks, and tram tracks blocked except at mapped crossings', () => {
    const resource = readJson<NavigationResource>(
      locationPath('cluj-napoca-station', 'navigation/walkable.json'),
    );
    const blockers = readJson<{rectangles: Rect[]}>(
      locationPath('cluj-napoca-station', 'navigation/blockers.json'),
    ).rectangles;
    const navigation = new GridNavigationService(
      resource.bounds,
      blockers,
      resource.cellSize,
      resource.areas,
      resource.connections,
      resource.hazards,
    );
    const station = resource.hazards!.find(
      (hazard) => hazard.id === 'closed-building-way-262209819',
    )!;
    const crossing = resource.areas.find((area) => area.id === 'crossing-central')!;
    const crossingCenter = areaCenter(crossing);
    const stationCenter = areaCenter({
      id: station.id,
      elevation: 0,
      points: station.points,
    });
    const transform = createLocalGeoTransform({
      west: 23.5838,
      east: 23.5933,
      south: 46.7821,
      north: 46.7863,
    });
    const unmarkedTrack = transform.toWorld({longitude: 23.5869319, latitude: 46.7846});
    const unmarkedTramTrack = transform.toWorld({
      longitude: 23.5864958,
      latitude: 46.7840175,
    });
    const mappedTramCrossing = transform.toWorld({
      longitude: 23.5858139,
      latitude: 46.7838535,
    });

    expect(
      navigation.resolveDestination(stationCenter),
    ).toBeUndefined();
    expect(
      navigation.resolveDestination(unmarkedTrack),
    ).toBeUndefined();
    expect(navigation.resolveDestination(unmarkedTramTrack)).toBeUndefined();
    expect(navigation.resolveDestination(mappedTramCrossing)).toBeDefined();
    expect(
      resource.hazards!.some(({id}) => id.startsWith('track-way-380768280-')),
    ).toBe(true);
    expect(resource.hazards!.filter(({id}) => id.startsWith('track-')).length).toBeGreaterThan(
      3_000,
    );
    expect(
      resource.hazards!
        .filter(({id}) => id.startsWith('track-'))
        .every((hazard) => hazard.minElevation !== undefined && hazard.maxElevation !== undefined),
    ).toBe(true);
    expect(navigation.isWalkable(crossingCenter)).toBe(true);
    expect(navigation.resolveDestination({...crossingCenter, elevation: 0})?.elevation).toBeCloseTo(
      crossingCenter.elevation,
      3,
    );
    expect(blockers.every((blocker) => Number.isFinite(blocker.minElevation))).toBe(true);
  });

  it('keeps all Cluj runtime layers editable, separate, and source-labelled', () => {
    const manifest = readJson<{
      views: string[];
      detailOverlays: string[];
      occlusion: string[];
      backdrops: string[];
    }>(locationPath('cluj-napoca-station', 'manifest.json'));
    expect(manifest.views.every((asset) => asset.endsWith('.svg'))).toBe(true);
    expect(new Set(manifest.views)).not.toEqual(new Set(manifest.detailOverlays));
    expect(new Set(manifest.views)).not.toEqual(new Set(manifest.occlusion));
    expect(new Set(manifest.views)).not.toEqual(new Set(manifest.backdrops));
    for (const id of VIEW_IDS) {
      const beauty = readFileSync(locationPath('cluj-napoca-station', `views/${id}.svg`), 'utf8');
      const details = readFileSync(
        locationPath('cluj-napoca-station', `details/${id}.svg`),
        'utf8',
      );
      expect(beauty).toContain('data-station="main"');
      expect(beauty).toContain('data-hazard="rail-track"');
      expect(beauty).toContain('data-platform=');
      expect(beauty).toContain('data-canopy=');
      expect(beauty).toContain('data-entrance="main"');
      expect(beauty).toContain('data-barrier=');
      expect(details).toContain('GARA CLUJ-NAPOCA');
      expect(details).toContain('INTRARE PRINCIPALĂ · INTERIOR ÎNCHIS');
      expect(details).toContain('data-transport-stop=');
      expect(details).toContain('data-tunnel-entrance=');
    }
  });
});

describe('data-driven environment artwork', () => {
  for (const locationId of LOCATION_IDS) {
    it(`${locationId} defines surfaces, architecture, props, and weather in world space`, () => {
      const environment = readJson<{
        atmosphere: {wetness: number; backdropTexture: string; backdropTints: string[]};
        surfaces: Array<{id: string; type: string}>;
        landmarks: Array<{id: string}>;
        trees: unknown[];
        streetFurniture: Array<{type: string; blocksMovement?: boolean}>;
      }>(locationPath(locationId, 'environment.json'));
      expect(environment.atmosphere.wetness).toBeGreaterThan(0);
      expect(environment.atmosphere.backdropTexture).toMatch(/\.png$/);
      expect(environment.atmosphere.backdropTints).toHaveLength(5);
      expect(environment.surfaces.some(({type}) => type === 'road')).toBe(true);
      expect(environment.surfaces.some(({type}) => ['plaza', 'rail'].includes(type))).toBe(true);
      expect(environment.landmarks.length).toBeGreaterThanOrEqual(8);
      expect(environment.trees.length).toBeGreaterThan(0);
      expect(environment.streetFurniture.length).toBeGreaterThan(0);
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
      'vatra-corrugated-metal.png',
      'vatra-painted-plaster.png',
      'vatra-platform-concrete.png',
      'vatra-wet-brick.png',
    ]) {
      expect(readFileSync(`public/content/materials/${name}`).subarray(0, 8)).toEqual(pngSignature);
    }
    for (const locationId of LOCATION_IDS) {
      expect(
        readFileSync(locationPath(locationId, 'sprites/agent-atlas.png')).subarray(0, 8),
      ).toEqual(pngSignature);
    }
    for (const locationId of RASTER_LOCATION_IDS) {
      expect(readFileSync(locationPath(locationId, 'views/view-0.svg'), 'utf8')).toContain(
        '../../../materials/industrial-wet-asphalt.png',
      );
      const rendered = readFileSync(locationPath(locationId, 'views/view-0.webp'));
      expect(rendered.subarray(0, 4).toString()).toBe('RIFF');
      expect(rendered.subarray(8, 12).toString()).toBe('WEBP');
    }
  });

  it('ships replaceable Gone Vatra finish plates and transparent derived occlusion', async () => {
    const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    for (const view of VIEW_IDS.slice(0, 4)) {
      const source = `art/vatra/paintovers/${view}.png`;
      expect(readFileSync(source).subarray(0, 8)).toEqual(pngSignature);
      expect(statSync(source).size).toBeGreaterThan(1_000_000);
      expect(await sharp(source).metadata()).toMatchObject({
        width: 1536,
        height: 1024,
      });

      const runtime = locationPath('vatra-central-station', `views/${view}.webp`);
      const runtimeImage = sharp(runtime);
      expect(await runtimeImage.metadata()).toMatchObject({
        width: 1920,
        height: 1280,
        hasAlpha: true,
      });
      const runtimeAlpha = await runtimeImage.extractChannel('alpha').raw().toBuffer();
      const alphaAt = (x: number, y: number): number => runtimeAlpha[y * 1920 + x]!;
      const perimeterAlpha = [
        ...Array.from({length: 1920}, (_, x) => alphaAt(x, 0)),
        ...Array.from({length: 1920}, (_, x) => alphaAt(x, 1279)),
        ...Array.from({length: 1280}, (_, y) => alphaAt(0, y)),
        ...Array.from({length: 1280}, (_, y) => alphaAt(1919, y)),
      ];
      expect(Math.max(...perimeterAlpha)).toBeLessThanOrEqual(10);
      expect(alphaAt(960, 640)).toBeGreaterThanOrEqual(253);
      const occlusionPath = locationPath(
        'vatra-central-station',
        `occlusion-3d/${view}.webp`,
      );
      const occlusion = sharp(occlusionPath);
      expect(await occlusion.metadata()).toMatchObject({
        width: 1920,
        height: 1280,
        hasAlpha: true,
      });
      const alpha = (await occlusion.stats()).channels[3]!;
      expect(alpha.min).toBe(0);
      expect(alpha.max).toBe(255);
      expect(alpha.mean).toBeGreaterThan(20);
      expect(alpha.mean).toBeLessThan(120);
      const occlusionAlpha = await sharp(occlusionPath)
        .extractChannel('alpha')
        .raw()
        .toBuffer();
      const occlusionAlphaAt = (x: number, y: number): number =>
        occlusionAlpha[y * 1920 + x]!;
      const occlusionPerimeterAlpha = [
        ...Array.from({length: 1920}, (_, x) => occlusionAlphaAt(x, 0)),
        ...Array.from({length: 1920}, (_, x) => occlusionAlphaAt(x, 1279)),
        ...Array.from({length: 1280}, (_, y) => occlusionAlphaAt(0, y)),
        ...Array.from({length: 1280}, (_, y) => occlusionAlphaAt(1919, y)),
      ];
      expect(Math.max(...occlusionPerimeterAlpha)).toBeLessThanOrEqual(10);
    }

    const processor = readFileSync('tools/process-vatra-renders.mjs', 'utf8');
    expect(processor).toContain('art/vatra/paintovers');
    expect(processor).toContain("extractChannel('alpha')");
    const generator = readFileSync('art/vatra/build_vatra_scene.py', 'utf8');
    for (const authoredDetail of [
      'add_footbridge',
      'add_building_dressing',
      'tactile',
      'rail_fastener',
      'catenary-dropper',
      'asphalt-repair',
    ]) {
      expect(generator).toContain(authoredDetail);
    }
  });

  it('ships editable Gone 3D sources with aligned Vatra runtime layers', async () => {
    expect(readFileSync('art/vatra/vatra-central-station.blend').subarray(0, 7).toString()).toBe(
      'BLENDER',
    );
    expect(readFileSync('art/agent/gone-operative.blend').subarray(0, 7).toString()).toBe(
      'BLENDER',
    );
    const manifest = readJson<{
      views: string[];
      backdrops: string[];
      backdropScale: number;
      occlusion: string[];
      depthMaps: string[];
      detailOverlays: string[];
      agentAnimation: {directions: number; walk: number[]; run: number[]};
    }>(locationPath('vatra-central-station', 'manifest.json'));
    expect(manifest.views).toHaveLength(5);
    expect(manifest.backdrops).toHaveLength(5);
    expect(manifest.backdropScale).toBe(4);
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
    for (const asset of [
      ...manifest.views,
      ...manifest.backdrops,
      ...manifest.occlusion,
      ...manifest.depthMaps,
    ]) {
      const bytes = readFileSync(locationPath('vatra-central-station', asset));
      expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
    }
    for (const asset of manifest.views.slice(0, 4)) {
      const image = sharp(locationPath('vatra-central-station', asset));
      const metadata = await image.metadata();
      const {data, info} = await image
        .extract({left: 0, top: 0, width: metadata.width!, height: 96})
        .removeAlpha()
        .raw()
        .toBuffer({resolveWithObject: true});
      let sum = 0;
      let sumOfSquares = 0;
      const pixels = data.length / info.channels;
      for (let index = 0; index < data.length; index += info.channels) {
        const luminance = data[index]! * 0.2126 + data[index + 1]! * 0.7152 + data[index + 2]! * 0.0722;
        sum += luminance;
        sumOfSquares += luminance * luminance;
      }
      const mean = sum / pixels;
      const deviation = Math.sqrt(sumOfSquares / pixels - mean * mean);
      expect(deviation, `${asset} must not expose a flat world-background band`).toBeGreaterThan(4);
    }
    for (let index = 0; index < manifest.views.length; index += 1) {
      const tactical = index < 4;
      const viewPipeline = sharp(
        locationPath('vatra-central-station', manifest.views[index]!),
      ).resize(480, 320);
      const backdropPipeline = sharp(
        locationPath('vatra-central-station', manifest.backdrops[index]!),
      );
      if (tactical) {
        viewPipeline.extract({left: 160, top: 110, width: 160, height: 100});
        backdropPipeline.extract({left: 880, top: 590, width: 160, height: 100});
      } else {
        backdropPipeline.extract({left: 720, top: 480, width: 480, height: 320});
      }
      const view = await viewPipeline.removeAlpha().raw().toBuffer();
      const backdrop = await backdropPipeline.removeAlpha().raw().toBuffer();
      let difference = 0;
      for (let pixel = 0; pixel < view.length; pixel += 1) {
        difference += Math.abs(view[pixel]! - backdrop[pixel]!);
      }
      expect(
        difference / view.length,
        `${manifest.backdrops[index]} must align with its detailed center view`,
      ).toBeLessThan(tactical ? 5.5 : 4);
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
    expect(DEFAULT_SETTINGS.zoom).toBe(3);
    let raw = JSON.stringify({...DEFAULT_SETTINGS, zoom: 99});
    const storage = {
      getItem: () => raw,
      setItem: () => undefined,
    };
    const store = new SettingsStore(storage);
    expect(store.load().zoom).toBe(5);
    raw = JSON.stringify({...DEFAULT_SETTINGS, zoom: 0.35});
    expect(store.load().zoom).toBe(0.35);
    raw = JSON.stringify({...DEFAULT_SETTINGS, zoom: -1});
    expect(store.load().zoom).toBe(0.1);
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
      const manifest = readJson<{views: string[]}>(locationPath(locationId, 'manifest.json'));
      const viewSizes = manifest.views.map((view) => statSync(locationPath(locationId, view)).size);
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
