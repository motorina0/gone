import {copyFile, mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {createLocalGeoTransform} from '../src/geography/LocalGeoTransform';
import type {
  EnvironmentLandmark,
  EnvironmentResource,
  HighResolutionTile,
  HighResolutionView,
  NavigationConnection,
  NavigationHazard,
  NavigationResource,
  ProjectionResource,
  Rect,
  WorldResource,
} from '../src/content/ContentTypes';
import type {WorldPoint} from '../src/world/WorldTypes';
import {MAX_UNASSISTED_ELEVATION_DELTA_METERS} from '../src/navigation/Pathfinding';

type Coordinate = [number, number];
type Geometry =
  | {type: 'Point'; coordinates: Coordinate}
  | {type: 'LineString'; coordinates: Coordinate[]}
  | {type: 'Polygon'; coordinates: Coordinate[][]};

interface SourceFeature {
  id: string;
  geometry: Geometry;
  tags: Record<string, string>;
}

interface OsmSource {
  retrievedAt: string;
  endpoint: string;
  requestBounds: {west: number; east: number; south: number; north: number};
  sourceSha256: string;
  attribution: string;
  licence: string;
  licenceUrl: string;
  transformations: string[];
  features: SourceFeature[];
}

interface AuthoredArea {
  id: string;
  name: string;
  elevation: number;
  sourceRefs: string[];
  note: string;
  coordinates: Coordinate[];
}

interface AuthoredFootprint {
  sourceRefs: string[];
  note: string;
  coordinates: Coordinate[];
}

interface AuthoredCrossing {
  id: string;
  elevation: number;
  sourceRefs: string[];
  note: string;
  coordinates: [Coordinate, Coordinate];
}

interface AuthoredCanopy {
  id: string;
  name: string;
  sourceRef: string;
  widthMeters: number;
  coordinates: [Coordinate, Coordinate];
}

interface PassengerPlatformLink {
  id: string;
  sourceRef: string;
  widthMeters: number;
  elevationOffset: number;
  note: string;
}

interface AuthoredVerticalAccess {
  id: string;
  type: 'stairs' | 'ramp';
  sourceRefs: string[];
  longitude: number;
  latitude: number;
  fromOffset: number;
  toOffset: number;
  note: string;
}

interface AuthoredSurfaceLink {
  id: string;
  sourceRefs: string[];
  widthMeters: number;
  elevationOffset: number;
  coordinates: [Coordinate, Coordinate];
  note: string;
}

interface GameplayAuthoring {
  geographicBounds: {west: number; east: number; south: number; north: number};
  anchor: {latitude: number; longitude: number};
  playerSpawn: {
    latitude: number;
    longitude: number;
    elevation: number;
    note: string;
  };
  renderFootprint: AuthoredFootprint;
  navigationPolicy: {
    vehicleHighwayValues: string[];
    includeParkingAreas: boolean;
    tramTracksWalkable: boolean;
    railwayTracksHazardous: boolean;
    maximumUnassistedElevationDeltaMeters: number;
    representativeVehicleAreaId: string;
    representativeTramAreaId: string;
    note: string;
  };
  authoredGroundAreas: AuthoredArea[];
  legitimateRailCrossings: AuthoredCrossing[];
  passengerPlatformLinks: PassengerPlatformLink[];
  authoredSurfaceLinks: AuthoredSurfaceLink[];
  authoredVerticalAccesses: AuthoredVerticalAccess[];
  approximateCanopies: AuthoredCanopy[];
  heightOverrides: Record<string, {heightMeters: number; reason: string}>;
  elevationModel: {
    ground: number;
    platform: number;
    trackBed: number;
    passengerTunnel: number;
    canopyClearance: number;
    note: string;
  };
  approximations: string[];
}

interface TerrainSource {
  id: string;
  sourceUrl: string;
  dataset: string;
  referenceElevationMeters: number;
  attribution: string;
  licence: string;
  licenceUrl: string;
  liabilityNotice: string;
  transformations: string[];
  canonicalModel: {
    type: 'robust-planar-fit';
    anchorTerrainElevationMeters: number;
    slopeEastMetersPerMeter: number;
    slopeNorthMetersPerMeter: number;
    method: string;
  };
  samples: Array<{
    longitude: number;
    latitude: number;
    elevationMeters: number;
  }>;
}

const projectRoot = path.resolve('.');
const sourceRoot = path.join(projectRoot, 'data/cluj-napoca-station');
const outputArgumentIndex = process.argv.indexOf('--output');
const skipHighResolution = process.argv.includes('--skip-high-resolution');
if (outputArgumentIndex >= 0 && !process.argv[outputArgumentIndex + 1]) {
  throw new Error('--output requires a destination directory.');
}
const locationRoot =
  outputArgumentIndex >= 0
    ? path.resolve(process.argv[outputArgumentIndex + 1]!)
    : path.join(projectRoot, 'public/content/locations/cluj-napoca-station');
const readJson = async <T>(filePath: string): Promise<T> =>
  JSON.parse(await readFile(filePath, 'utf8')) as T;
const osm = await readJson<OsmSource>(path.join(sourceRoot, 'osm-source.json'));
const authoring = await readJson<GameplayAuthoring>(
  path.join(sourceRoot, 'gameplay-authoring.json'),
);
const terrain = await readJson<TerrainSource>(path.join(sourceRoot, 'terrain-source.json'));
const transform = createLocalGeoTransform(authoring.geographicBounds);
const worldBounds = {
  minX: 0,
  minY: 0,
  maxX: Number(transform.worldBounds.maxX.toFixed(3)),
  maxY: Number(transform.worldBounds.maxY.toFixed(3)),
};

const round = (value: number, precision = 3): number => Number(value.toFixed(precision));
const anchorPlanar = transform.toWorld(
  {longitude: authoring.anchor.longitude, latitude: authoring.anchor.latitude},
  0,
);
const terrainElevationAt = (point: Pick<WorldPoint, 'x' | 'y'>): number =>
  terrain.canonicalModel.slopeEastMetersPerMeter * (point.x - anchorPlanar.x) +
  terrain.canonicalModel.slopeNorthMetersPerMeter * (point.y - anchorPlanar.y);
const surfacePoint = (x: number, y: number, elevationOffset = 0): WorldPoint => ({
  x: round(x),
  y: round(y),
  elevation: round(terrainElevationAt({x, y}) + elevationOffset),
});
const coordinateToWorld = (coordinate: Coordinate, elevationOffset = 0): WorldPoint => {
  const point = transform.toWorld(
    {longitude: coordinate[0], latitude: coordinate[1]},
    0,
  );
  return surfacePoint(point.x, point.y, elevationOffset);
};
const pointToWorld = (
  coordinate: {longitude: number; latitude: number},
  elevation = 0,
): WorldPoint => coordinateToWorld([coordinate.longitude, coordinate.latitude], elevation);
const polygonWorld = (feature: SourceFeature, elevation = 0): WorldPoint[] => {
  if (feature.geometry.type !== 'Polygon') return [];
  const ring = feature.geometry.coordinates[0] ?? [];
  return ring
    .slice(0, ring.length > 1 && ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1] ? -1 : undefined)
    .map((coordinate) => coordinateToWorld(coordinate, elevation));
};
const lineWorld = (feature: SourceFeature, elevation = 0): WorldPoint[] =>
  feature.geometry.type === 'LineString'
    ? feature.geometry.coordinates.map((coordinate) => coordinateToWorld(coordinate, elevation))
    : [];
const centroid = (points: WorldPoint[]): WorldPoint => ({
  x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
  y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  elevation: points.reduce((sum, point) => sum + point.elevation, 0) / points.length,
});
const boundsOf = (points: WorldPoint[]) => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
};
const polygonArea = (points: WorldPoint[]): number =>
  Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length]!;
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
const pointInside = (point: WorldPoint, polygon: WorldPoint[]): boolean => {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const start = polygon[previous]!;
    const end = polygon[index]!;
    if (
      start.y > point.y !== end.y > point.y &&
      point.x < ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x
    ) {
      inside = !inside;
    }
  }
  return inside;
};
const distanceToSegment = (point: WorldPoint, start: WorldPoint, end: WorldPoint): number => {
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const amount = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * (end.x - start.x) +
        (point.y - start.y) * (end.y - start.y)) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + (end.x - start.x) * amount),
    point.y - (start.y + (end.y - start.y) * amount),
  );
};
const distanceToPolygon = (point: WorldPoint, polygon: WorldPoint[]): number =>
  pointInside(point, polygon)
    ? 0
    : Math.min(
        ...polygon.map((start, index) =>
          distanceToSegment(point, start, polygon[(index + 1) % polygon.length]!),
        ),
      );
const bufferSegment = (
  start: WorldPoint,
  end: WorldPoint,
  width: number,
  elevationOffset: number,
): WorldPoint[] => {
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const offsetX = (-(end.y - start.y) / length) * (width / 2);
  const offsetY = ((end.x - start.x) / length) * (width / 2);
  return [
    {x: start.x + offsetX, y: start.y + offsetY},
    {x: end.x + offsetX, y: end.y + offsetY},
    {x: end.x - offsetX, y: end.y - offsetY},
    {x: start.x - offsetX, y: start.y - offsetY},
  ].map((point) => surfacePoint(point.x, point.y, elevationOffset));
};
const squareArea = (point: WorldPoint, radius: number, elevationOffset: number): WorldPoint[] => [
  surfacePoint(point.x - radius, point.y - radius, elevationOffset),
  surfacePoint(point.x + radius, point.y - radius, elevationOffset),
  surfacePoint(point.x + radius, point.y + radius, elevationOffset),
  surfacePoint(point.x - radius, point.y + radius, elevationOffset),
];
const mapFootprint = authoring.renderFootprint.coordinates.map((coordinate) =>
  coordinateToWorld(coordinate),
);
if (mapFootprint.length !== 8) {
  throw new Error('The Cluj render footprint must contain exactly eight ordered corner-cut points.');
}
const writeJson = async (relativePath: string, value: unknown): Promise<void> => {
  const destination = path.join(locationRoot, relativePath);
  await mkdir(path.dirname(destination), {recursive: true});
  await writeFile(destination, `${JSON.stringify(value, null, 2)}\n`);
};
const writeText = async (relativePath: string, value: string): Promise<void> => {
  const destination = path.join(locationRoot, relativePath);
  await mkdir(path.dirname(destination), {recursive: true});
  await writeFile(destination, value);
};
const writeBinary = async (relativePath: string, value: Buffer): Promise<void> => {
  const destination = path.join(locationRoot, relativePath);
  await mkdir(path.dirname(destination), {recursive: true});
  await writeFile(destination, value);
};
const writeRasterPair = async (
  layer: string,
  id: string,
  svg: string,
): Promise<void> => {
  const png = await sharp(Buffer.from(svg))
    .resize(1920, 1280)
    .png({compressionLevel: 6})
    .toBuffer();
  const webp = await sharp(png)
    .webp({quality: 90, alphaQuality: 100, smartSubsample: true, effort: 0})
    .toBuffer();
  await Promise.all([
    writeBinary(`png/${layer}/${id}.png`, png),
    writeBinary(`raster/${layer}/${id}.webp`, webp),
  ]);
};

const HIGH_RESOLUTION_STAGE = {width: 960, height: 640};
const HIGH_RESOLUTION_TILE_SIZE = 2048;
const HIGH_RESOLUTION_BUNDLE_SIZE = 32 * 1024 * 1024;
const HIGH_RESOLUTION_SCALES = [2, 4, 8, 16] as const;
interface HighResolutionJob {
  svg: string;
  tile: HighResolutionTile;
  renderX: number;
  renderY: number;
  renderWidth: number;
  renderHeight: number;
  pixelWidth: number;
  pixelHeight: number;
}
const highResolutionJobs: HighResolutionJob[] = [];
const highResolutionViews: HighResolutionView[] = projectionsPlaceholder();
const highResolutionDetails: HighResolutionView[] = projectionsPlaceholder();
const highResolutionOcclusion: HighResolutionView[] = projectionsPlaceholder();

function projectionsPlaceholder(): HighResolutionView[] {
  return Array.from({length: 5}, () => ({levels: []}));
}

const queueHighResolutionView = (
  svg: string,
  target: HighResolutionView,
): void => {
  for (const [index, sourceScale] of HIGH_RESOLUTION_SCALES.entries()) {
    const level = index + 1;
    const logicalTileSize = HIGH_RESOLUTION_TILE_SIZE / sourceScale;
    const tiles: HighResolutionTile[] = [];
    for (let y = 0; y < HIGH_RESOLUTION_STAGE.height; y += logicalTileSize) {
      for (let x = 0; x < HIGH_RESOLUTION_STAGE.width; x += logicalTileSize) {
        const width = Math.min(logicalTileSize, HIGH_RESOLUTION_STAGE.width - x);
        const height = Math.min(logicalTileSize, HIGH_RESOLUTION_STAGE.height - y);
        const bleed = 1 / sourceScale;
        const renderX = Math.max(0, x - bleed);
        const renderY = Math.max(0, y - bleed);
        const renderRight = Math.min(HIGH_RESOLUTION_STAGE.width, x + width + bleed);
        const renderBottom = Math.min(HIGH_RESOLUTION_STAGE.height, y + height + bleed);
        const renderWidth = renderRight - renderX;
        const renderHeight = renderBottom - renderY;
        const tile: HighResolutionTile = {
          x,
          y,
          width,
          height,
          bundle: 0,
          offset: 0,
          bytes: 0,
          cropX: Math.round((x - renderX) * sourceScale),
          cropY: Math.round((y - renderY) * sourceScale),
        };
        tiles.push(tile);
        highResolutionJobs.push({
          svg,
          tile,
          renderX,
          renderY,
          renderWidth,
          renderHeight,
          pixelWidth: Math.round(renderWidth * sourceScale),
          pixelHeight: Math.round(renderHeight * sourceScale),
        });
      }
    }
    target.levels.push({level, sourceScale, tiles});
  }
};

const cropSvgForTile = (job: HighResolutionJob): string => {
  const match = job.svg.match(/^<svg\s+([^>]*)>/);
  if (!match) throw new Error('Generated map layer does not begin with an SVG root.');
  const attributes = match[1]!.replace(/\s(?:width|height|viewBox)="[^"]*"/g, '');
  const root = `<svg ${attributes} width="${job.pixelWidth}" height="${job.pixelHeight}" viewBox="${job.renderX} ${job.renderY} ${job.renderWidth} ${job.renderHeight}">`;
  return job.svg.replace(/^<svg\s+[^>]*>/, root);
};

const renderHighResolutionBundles = async (): Promise<Buffer[]> => {
  const results: Buffer[] = Array.from({length: highResolutionJobs.length});
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < highResolutionJobs.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await sharp(Buffer.from(cropSvgForTile(highResolutionJobs[index]!)))
        .png({compressionLevel: 6})
        .toBuffer();
    }
  };
  await Promise.all(Array.from({length: 4}, worker));
  const bundles: Buffer[][] = [[]];
  const bundleSizes = [0];
  for (const [index, job] of highResolutionJobs.entries()) {
    const result = results[index]!;
    let bundle = bundles.length - 1;
    if (bundleSizes[bundle]! > 0 && bundleSizes[bundle]! + result.byteLength > HIGH_RESOLUTION_BUNDLE_SIZE) {
      bundles.push([]);
      bundleSizes.push(0);
      bundle += 1;
    }
    job.tile.bundle = bundle;
    job.tile.offset = bundleSizes[bundle]!;
    job.tile.bytes = result.byteLength;
    bundles[bundle]!.push(result);
    bundleSizes[bundle] = bundleSizes[bundle]! + result.byteLength;
  }
  return bundles.map((parts, index) => Buffer.concat(parts, bundleSizes[index]));
};

const projectionMatrices: Array<{
  id: string;
  name: string;
  kind: 'isometric' | 'top';
  matrix: [number, number, number, number];
  azimuth: number;
  elevation: number;
}> = [
  {id: 'view-0', name: '0° izometric', kind: 'isometric', matrix: [-0.866, 0.866, 0.5, 0.5], azimuth: 0, elevation: 35.264},
  {id: 'view-90', name: '90° izometric', kind: 'isometric', matrix: [-0.866, -0.866, -0.5, 0.5], azimuth: 90, elevation: 35.264},
  {id: 'view-180', name: '180° izometric', kind: 'isometric', matrix: [0.866, -0.866, -0.5, -0.5], azimuth: 180, elevation: 35.264},
  {id: 'view-270', name: '270° izometric', kind: 'isometric', matrix: [0.866, 0.866, 0.5, -0.5], azimuth: 270, elevation: 35.264},
  {id: 'view-top', name: 'Plan ortografic', kind: 'top', matrix: [1, 0, 0, -1], azimuth: 0, elevation: 90},
];

const projections: ProjectionResource[] = projectionMatrices.map((definition) => {
  const corners = mapFootprint.map(({x, y}) => ({
    x: definition.matrix[0] * x + definition.matrix[1] * y,
    y: definition.matrix[2] * x + definition.matrix[3] * y,
  }));
  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));
  const scale = Math.min(880 / (maxX - minX), 530 / (maxY - minY));
  return {
    schemaVersion: '1.0.0',
    id: definition.id,
    name: definition.name,
    kind: definition.kind,
    matrix: definition.matrix,
    origin: {
      x: round((960 - (minX + maxX) * scale) / 2, 6),
      y: round((640 - (minY + maxY) * scale) / 2 + 12, 6),
    },
    scale: round(scale, 12),
    azimuth: definition.azimuth,
    elevation: definition.elevation,
  } as ProjectionResource & {schemaVersion: string};
});

const buildingFeatures = osm.features.filter(
  (feature) => feature.geometry.type === 'Polygon' && feature.tags.building,
);
const activeRailFeatures = osm.features.filter(
  (feature) =>
    feature.geometry.type === 'LineString' &&
    ['rail', 'tram'].includes(feature.tags.railway ?? '') &&
    feature.tags.railway !== 'razed',
);
const platformFeatures = osm.features.filter(
  (feature) =>
    feature.tags.railway === 'platform' &&
    feature.tags.tram !== 'yes' &&
    (feature.geometry.type === 'Polygon' || feature.geometry.type === 'LineString'),
);
const tunnelFeatures = osm.features.filter(
  (feature) =>
    feature.geometry.type === 'LineString' &&
    feature.tags.highway === 'footway' &&
    (feature.tags.tunnel === 'yes' ||
      feature.tags.layer === '-1' ||
      feature.tags.level === '-1'),
);
const stepFeatures = osm.features.filter(
  (feature) => feature.geometry.type === 'LineString' && feature.tags.highway === 'steps',
);
const publicFootways = osm.features.filter(
  (feature) =>
    feature.geometry.type === 'LineString' &&
    ['footway', 'pedestrian', 'steps', 'path'].includes(feature.tags.highway ?? '') &&
    feature.tags.tunnel !== 'yes' &&
    feature.tags.layer !== '-1' &&
    feature.tags.level !== '-1' &&
    !['private', 'no'].includes(feature.tags.access ?? ''),
);
const vehicleHighwayValues = new Set(authoring.navigationPolicy.vehicleHighwayValues);
const vehicleWays = osm.features.filter(
  (feature) =>
    feature.geometry.type === 'LineString' &&
    vehicleHighwayValues.has(feature.tags.highway ?? '') &&
    feature.tags.access !== 'no' &&
    feature.tags.vehicle !== 'no' &&
    feature.tags.motor_vehicle !== 'no' &&
    feature.tags.tunnel !== 'yes' &&
    feature.tags.layer !== '-1',
);
const parkingFeatures = authoring.navigationPolicy.includeParkingAreas
  ? osm.features.filter(
      (feature) =>
        feature.geometry.type === 'Polygon' &&
        feature.tags.amenity === 'parking' &&
        feature.tags.access !== 'no',
    )
  : [];
const tramFeatures = authoring.navigationPolicy.tramTracksWalkable
  ? activeRailFeatures.filter((feature) => feature.tags.railway === 'tram')
  : [];

if (
  authoring.navigationPolicy.maximumUnassistedElevationDeltaMeters !==
  MAX_UNASSISTED_ELEVATION_DELTA_METERS
) {
  throw new Error(
    `Cluj navigation policy must match the shared ${MAX_UNASSISTED_ELEVATION_DELTA_METERS} m surface-step rule.`,
  );
}

const walkableAreas: NavigationResource['areas'] = [];
const addArea = (id: string, elevationOffset: number, points: WorldPoint[]): void => {
  if (points.length < 3 || polygonArea(points) < 2) return;
  walkableAreas.push({
    id,
    elevation: round(centroid(points).elevation),
    points,
    elevationPlane: {
      originX: round(anchorPlanar.x),
      originY: round(anchorPlanar.y),
      originElevation: elevationOffset,
      slopeX: terrain.canonicalModel.slopeEastMetersPerMeter,
      slopeY: terrain.canonicalModel.slopeNorthMetersPerMeter,
    },
  });
};

for (const area of authoring.authoredGroundAreas) {
  addArea(
    area.id,
    area.elevation,
    area.coordinates.map((coordinate) => coordinateToWorld(coordinate, area.elevation)),
  );
}

for (const feature of osm.features.filter(
  (candidate) =>
    candidate.geometry.type === 'Polygon' &&
    (candidate.tags.highway === 'pedestrian' ||
      (candidate.tags.public_transport === 'platform' && candidate.tags.train !== 'yes')),
)) {
  addArea(
    `osm-${feature.id.replace('/', '-')}`,
    authoring.elevationModel.ground,
    polygonWorld(feature, authoring.elevationModel.ground),
  );
}

for (const feature of publicFootways) {
  const line = lineWorld(feature, authoring.elevationModel.ground);
  const width = feature.tags.highway === 'steps' ? 3 : feature.tags.footway === 'sidewalk' ? 5 : 4;
  for (let index = 0; index < line.length - 1; index += 1) {
    addArea(
      `footway-${feature.id.replace('/', '-')}-${index + 1}`,
      authoring.elevationModel.ground,
      bufferSegment(
        line[index]!,
        line[index + 1]!,
        width,
        authoring.elevationModel.ground,
      ),
    );
  }
}

for (const feature of vehicleWays) {
  const line = lineWorld(feature, authoring.elevationModel.ground);
  const width = roadWidth(feature);
  for (let index = 0; index < line.length - 1; index += 1) {
    addArea(
      `vehicle-${feature.id.replace('/', '-')}-${index + 1}`,
      authoring.elevationModel.ground,
      bufferSegment(
        line[index]!,
        line[index + 1]!,
        width,
        authoring.elevationModel.ground,
      ),
    );
  }
}

for (const feature of parkingFeatures) {
  addArea(
    `vehicle-parking-${feature.id.replace('/', '-')}`,
    authoring.elevationModel.ground,
    polygonWorld(feature, authoring.elevationModel.ground),
  );
}

for (const feature of tramFeatures) {
  const line = lineWorld(feature, authoring.elevationModel.trackBed);
  for (let index = 0; index < line.length - 1; index += 1) {
    addArea(
      `tram-${feature.id.replace('/', '-')}-${index + 1}`,
      authoring.elevationModel.trackBed,
      bufferSegment(
        line[index]!,
        line[index + 1]!,
        4,
        authoring.elevationModel.trackBed,
      ),
    );
  }
}

const platformPolygons: WorldPoint[][] = [];
for (const feature of platformFeatures) {
  if (feature.geometry.type === 'Polygon') {
    const polygon = polygonWorld(feature, authoring.elevationModel.platform);
    platformPolygons.push(polygon);
    addArea(
      `platform-${feature.id.replace('/', '-')}`,
      authoring.elevationModel.platform,
      polygon,
    );
  }
}

const safeRailCrossingPolygons: WorldPoint[][] = [];
for (const feature of osm.features.filter(
  (candidate) =>
    candidate.geometry.type === 'Point' &&
    ['crossing', 'level_crossing', 'tram_crossing', 'tram_level_crossing'].includes(
      candidate.tags.railway ?? '',
    ),
)) {
  if (feature.geometry.type !== 'Point') continue;
  const point = coordinateToWorld(feature.geometry.coordinates, authoring.elevationModel.ground);
  safeRailCrossingPolygons.push(squareArea(point, 2, authoring.elevationModel.ground));
}
for (const feature of publicFootways.filter(
  (candidate) => candidate.tags.footway === 'crossing' || candidate.tags.crossing !== undefined,
)) {
  const line = lineWorld(feature, authoring.elevationModel.ground);
  for (let index = 0; index < line.length - 1; index += 1) {
    safeRailCrossingPolygons.push(
      bufferSegment(
        line[index]!,
        line[index + 1]!,
        4,
        authoring.elevationModel.ground,
      ),
    );
  }
}
for (const crossing of authoring.legitimateRailCrossings) {
  const [start, end] = crossing.coordinates.map((coordinate) =>
    coordinateToWorld(coordinate, crossing.elevation),
  ) as [WorldPoint, WorldPoint];
  const polygon = bufferSegment(start, end, 4, crossing.elevation);
  safeRailCrossingPolygons.push(polygon);
  addArea(crossing.id, crossing.elevation, polygon);
}

for (const link of authoring.passengerPlatformLinks) {
  const feature = osm.features.find((candidate) => candidate.id === link.sourceRef);
  if (!feature || feature.geometry.type !== 'LineString') {
    throw new Error(`Missing mapped passenger-platform link ${link.sourceRef}.`);
  }
  const line = lineWorld(feature, link.elevationOffset);
  for (const [index, point] of line.entries()) {
    const polygon = squareArea(point, link.widthMeters / 2, link.elevationOffset);
    safeRailCrossingPolygons.push(polygon);
    addArea(`${link.id}-node-${index + 1}`, link.elevationOffset, polygon);
  }
  for (let index = 0; index < line.length - 1; index += 1) {
    const polygon = bufferSegment(
      line[index]!,
      line[index + 1]!,
      link.widthMeters,
      link.elevationOffset,
    );
    safeRailCrossingPolygons.push(polygon);
    addArea(`${link.id}-${index + 1}`, link.elevationOffset, polygon);
  }
}

for (const link of authoring.authoredSurfaceLinks) {
  const [start, end] = link.coordinates.map((coordinate) =>
    coordinateToWorld(coordinate, link.elevationOffset),
  ) as [WorldPoint, WorldPoint];
  const polygon = bufferSegment(start, end, link.widthMeters, link.elevationOffset);
  safeRailCrossingPolygons.push(polygon);
  addArea(link.id, link.elevationOffset, polygon);
  for (const [index, point] of [start, end].entries()) {
    const node = squareArea(point, link.widthMeters / 2, link.elevationOffset);
    safeRailCrossingPolygons.push(node);
    addArea(`${link.id}-node-${index + 1}`, link.elevationOffset, node);
  }
}

for (const feature of tunnelFeatures) {
  const line = lineWorld(feature, authoring.elevationModel.passengerTunnel);
  for (let index = 0; index < line.length - 1; index += 1) {
    addArea(
      `tunnel-${feature.id.replace('/', '-')}-${index + 1}`,
      authoring.elevationModel.passengerTunnel,
      bufferSegment(
        line[index]!,
        line[index + 1]!,
        4,
        authoring.elevationModel.passengerTunnel,
      ),
    );
  }
}

const buildingPolygons = buildingFeatures.map((feature) => ({
  feature,
  polygon: polygonWorld(feature),
}));
const surfaceOffsetAt = (point: WorldPoint): number =>
  platformPolygons.some((polygon) => distanceToPolygon(point, polygon) <= 8)
    ? authoring.elevationModel.platform
    : authoring.elevationModel.ground;
const insideClosedBuilding = (point: WorldPoint): boolean =>
  buildingPolygons.some(
    ({feature, polygon}) =>
      feature.tags.building !== 'roof' &&
      feature.tags.building !== 'construction' &&
      pointInside(point, polygon),
  );
const connections: NavigationConnection[] = [];
const tunnelSegments = tunnelFeatures.flatMap((feature) => {
  const line = lineWorld(feature, authoring.elevationModel.passengerTunnel);
  return line.slice(0, -1).map((start, index) => [start, line[index + 1]!] as const);
});
const distanceToTunnel = (point: WorldPoint): number =>
  Math.min(...tunnelSegments.map(([start, end]) => distanceToSegment(point, start, end)));

for (const feature of stepFeatures) {
  const line = lineWorld(feature);
  const first = line[0];
  const last = line.at(-1);
  if (!first || !last) continue;
  const firstIsTunnel = distanceToTunnel(first) <= 0.75;
  const lastIsTunnel = distanceToTunnel(last) <= 0.75;
  if (firstIsTunnel && lastIsTunnel) {
    for (let index = 0; index < line.length - 1; index += 1) {
      addArea(
        `tunnel-steps-${feature.id.replace('/', '-')}-${index + 1}`,
        authoring.elevationModel.passengerTunnel,
        bufferSegment(
          line[index]!,
          line[index + 1]!,
          3,
          authoring.elevationModel.passengerTunnel,
        ),
      );
    }
    continue;
  }
  if (firstIsTunnel === lastIsTunnel) continue;
  const tunnelEnd = firstIsTunnel ? first : last;
  const surfaceEnd = firstIsTunnel ? last : first;
  if (insideClosedBuilding(surfaceEnd)) continue;
  const surfaceOffset = surfaceOffsetAt(surfaceEnd);
  const from = surfacePoint(surfaceEnd.x, surfaceEnd.y, surfaceOffset);
  const to = surfacePoint(
    tunnelEnd.x,
    tunnelEnd.y,
    authoring.elevationModel.passengerTunnel,
  );
  connections.push({
    id: `stairs-${feature.id.replace('/', '-')}`,
    type: 'stairs',
    from,
    to,
    bidirectional: true,
  });
  addArea(
    `${connections.at(-1)!.id}-surface`,
    surfaceOffset,
    squareArea(from, 3, surfaceOffset),
  );
  addArea(
    `${connections.at(-1)!.id}-tunnel`,
    authoring.elevationModel.passengerTunnel,
    squareArea(to, 3, authoring.elevationModel.passengerTunnel),
  );
}

for (const access of authoring.authoredVerticalAccesses) {
  const coordinate = coordinateToWorld([access.longitude, access.latitude]);
  const from = surfacePoint(coordinate.x, coordinate.y, access.fromOffset);
  const to = surfacePoint(coordinate.x, coordinate.y, access.toOffset);
  connections.push({id: access.id, type: access.type, from, to, bidirectional: true});
  addArea(`${access.id}-surface`, access.fromOffset, squareArea(from, 4, access.fromOffset));
  addArea(`${access.id}-tunnel`, access.toOffset, squareArea(to, 4, access.toOffset));
}

const buildingBlockers: Rect[] = buildingPolygons
  .filter(({feature, polygon}) =>
    feature.tags.building !== 'roof' &&
    feature.tags.building !== 'construction' &&
    polygonArea(polygon) >= 5,
  )
  .map(({feature, polygon}) => {
    const bounds = boundsOf(polygon);
    const center = {x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2};
    return {
      id: `building-${feature.id.replace('/', '-')}`,
      x: round(bounds.minX),
      y: round(bounds.minY),
      width: round(bounds.maxX - bounds.minX),
      height: round(bounds.maxY - bounds.minY),
      minElevation: round(terrainElevationAt(center) - 1.5),
    };
  });
const barrierFeatures = osm.features.filter(
  (feature) =>
    feature.geometry.type === 'LineString' &&
    ['fence', 'wall', 'retaining_wall'].includes(feature.tags.barrier ?? ''),
);
const barrierBlockers: Rect[] = barrierFeatures
  .flatMap((feature) => {
    const line = lineWorld(feature);
    return line.slice(0, -1).flatMap((start, index) => {
      const end = line[index + 1]!;
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      const pieces = Math.max(1, Math.ceil(length / 4));
      return Array.from({length: pieces}, (_, piece) => {
        const startAmount = piece / pieces;
        const endAmount = (piece + 1) / pieces;
        const pieceStart = {
          x: start.x + (end.x - start.x) * startAmount,
          y: start.y + (end.y - start.y) * startAmount,
        };
        const pieceEnd = {
          x: start.x + (end.x - start.x) * endAmount,
          y: start.y + (end.y - start.y) * endAmount,
        };
        return {
          id: `barrier-${feature.id.replace('/', '-')}-${index + 1}-${piece + 1}`,
          x: round(Math.min(pieceStart.x, pieceEnd.x) - 0.25),
          y: round(Math.min(pieceStart.y, pieceEnd.y) - 0.25),
          width: round(Math.abs(pieceEnd.x - pieceStart.x) + 0.5),
          height: round(Math.abs(pieceEnd.y - pieceStart.y) + 0.5),
          minElevation: round(
            terrainElevationAt({
              x: (pieceStart.x + pieceEnd.x) / 2,
              y: (pieceStart.y + pieceEnd.y) / 2,
            }) - 1.5,
          ),
        };
      });
    });
  });
const blockers = [...barrierBlockers];
const closedBuildingHazards: NavigationHazard[] = buildingPolygons
  .filter(
    ({feature, polygon}) =>
      feature.tags.building !== 'roof' &&
      feature.tags.building !== 'construction' &&
      polygonArea(polygon) >= 5,
  )
  .map(({feature, polygon}) => ({
    id: `closed-building-${feature.id.replace('/', '-')}`,
    points: polygon,
    minElevation: round(terrainElevationAt(centroid(polygon)) - 1.5),
  }));
const outsideFootprintHazards: NavigationHazard[] = [
  {
    id: 'map-edge-corner-south-west',
    points: [
      surfacePoint(worldBounds.minX, worldBounds.minY),
      mapFootprint[0]!,
      mapFootprint[7]!,
    ],
  },
  {
    id: 'map-edge-corner-south-east',
    points: [
      surfacePoint(worldBounds.maxX, worldBounds.minY),
      mapFootprint[2]!,
      mapFootprint[1]!,
    ],
  },
  {
    id: 'map-edge-corner-north-east',
    points: [
      surfacePoint(worldBounds.maxX, worldBounds.maxY),
      mapFootprint[4]!,
      mapFootprint[3]!,
    ],
  },
  {
    id: 'map-edge-corner-north-west',
    points: [
      surfacePoint(worldBounds.minX, worldBounds.maxY),
      mapFootprint[6]!,
      mapFootprint[5]!,
    ],
  },
];

const trackHazards: NavigationHazard[] = [];
for (const feature of activeRailFeatures) {
  if (feature.tags.railway === 'tram' && authoring.navigationPolicy.tramTracksWalkable) {
    continue;
  }
  if (feature.tags.railway === 'rail' && !authoring.navigationPolicy.railwayTracksHazardous) {
    continue;
  }
  const line = lineWorld(feature, authoring.elevationModel.trackBed);
  const hazardWidth = feature.tags.railway === 'tram' ? 2.4 : 3.4;
  for (let index = 0; index < line.length - 1; index += 1) {
    const start = line[index]!;
    const end = line[index + 1]!;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const pieces = Math.max(1, Math.ceil(length / 2));
    for (let piece = 0; piece < pieces; piece += 1) {
      const startAmount = piece / pieces;
      const endAmount = (piece + 1) / pieces;
      const pieceStart = surfacePoint(
        start.x + (end.x - start.x) * startAmount,
        start.y + (end.y - start.y) * startAmount,
        authoring.elevationModel.trackBed,
      );
      const pieceEnd = surfacePoint(
        start.x + (end.x - start.x) * endAmount,
        start.y + (end.y - start.y) * endAmount,
        authoring.elevationModel.trackBed,
      );
      const midpoint = surfacePoint(
        (pieceStart.x + pieceEnd.x) / 2,
        (pieceStart.y + pieceEnd.y) / 2,
      );
      if (
        safeRailCrossingPolygons.some((polygon) => distanceToPolygon(midpoint, polygon) <= 1.5)
      ) {
        continue;
      }
      const groundElevation = terrainElevationAt(midpoint);
      trackHazards.push({
        id: `track-${feature.id.replace('/', '-')}-${index + 1}-${piece + 1}`,
        points: bufferSegment(
          pieceStart,
          pieceEnd,
          hazardWidth,
          authoring.elevationModel.trackBed,
        ),
        minElevation: round(groundElevation - 1.2),
        maxElevation: round(groundElevation + 2),
      });
    }
  }
}

const playerSpawn = pointToWorld(authoring.playerSpawn, authoring.playerSpawn.elevation);
const anchorWorld = pointToWorld(authoring.anchor);
const representativeAreaCenter = (id: string): WorldPoint => {
  const area = walkableAreas.find((candidate) => candidate.id === id);
  if (!area) throw new Error(`Missing representative navigation area ${id}.`);
  const center = centroid(area.points);
  return {x: round(center.x), y: round(center.y), elevation: round(center.elevation)};
};
const vehicleAccessPoint = representativeAreaCenter(
  authoring.navigationPolicy.representativeVehicleAreaId,
);
const tramAccessPoint = representativeAreaCenter(
  authoring.navigationPolicy.representativeTramAreaId,
);
const elevatedTestArea = walkableAreas.find((area) => area.id === 'platform-way-215798526');
if (!elevatedTestArea) throw new Error('Expected the OSM Peronul 2;3 polygon.');
const platformAccessPoint = {
  ...centroid(elevatedTestArea.points),
  elevation: elevatedTestArea.elevation,
};
const navigation: NavigationResource & {schemaVersion: string} = {
  schemaVersion: '1.0.0',
  id: 'cluj-napoca-station-walkable',
  name: 'Zone pietonale, carosabile, tramvai, peroane și pasaje pentru călători',
  cellSize: 2,
  bounds: worldBounds,
  areas: walkableAreas,
  connections,
  hazards: [...outsideFootprintHazards, ...closedBuildingHazards, ...trackHazards],
};

const world: WorldResource & {schemaVersion: string} = {
  schemaVersion: '1.0.0',
  id: 'cluj-napoca-station-world',
  name: 'Gara Cluj-Napoca',
  bounds: worldBounds,
  footprint: mapFootprint,
  spawns: {
    player: playerSpawn,
    platformAccess: platformAccessPoint,
    vehicleAccess: vehicleAccessPoint,
    tramAccess: tramAccessPoint,
  },
  exchange: playerSpawn,
  package: playerSpawn,
  extraction: playerSpawn,
  geography: {
    sourceCrs: 'EPSG:4326',
    origin: {
      latitude: authoring.geographicBounds.south,
      longitude: authoring.geographicBounds.west,
    },
    geographicBounds: authoring.geographicBounds,
    metresPerDegree: {
      longitude: round(transform.metresPerDegree.longitude, 9),
      latitude: round(transform.metresPerDegree.latitude, 9),
    },
    anchor: {...authoring.anchor, world: anchorWorld},
    elevationDatumMeters: terrain.referenceElevationMeters,
    terrainSourceId: terrain.id,
  },
};

const parseLevels = (feature: SourceFeature): number => {
  const levels = Number(feature.tags['building:levels']);
  if (Number.isFinite(levels) && levels > 0) return Math.round(levels);
  if (feature.tags.building === 'apartments') return 4;
  if (['industrial', 'warehouse'].includes(feature.tags.building ?? '')) return 1;
  if (feature.tags.building === 'train_station') return 2;
  return 2;
};
const buildingHeight = (feature: SourceFeature): number => {
  const override = authoring.heightOverrides[feature.id]?.heightMeters;
  if (override !== undefined) return override;
  const taggedHeight = Number(feature.tags.height?.replace(' m', ''));
  if (Number.isFinite(taggedHeight) && taggedHeight > 0) return taggedHeight;
  return parseLevels(feature) * 3.2 + 1.2;
};
const buildingStyle = (
  feature: SourceFeature,
): {color: string; material: EnvironmentLandmark['material']; roof: EnvironmentLandmark['roof']} => {
  if (feature.tags.building === 'train_station') {
    return {color: '#a79c87', material: 'plaster', roof: 'pitched'};
  }
  if (['industrial', 'warehouse'].includes(feature.tags.building ?? '')) {
    return {color: '#6d5c50', material: 'brick', roof: 'metal'};
  }
  if (['commercial', 'retail', 'office'].includes(feature.tags.building ?? '')) {
    return {color: '#7b807d', material: 'plaster', roof: 'flat'};
  }
  if (feature.tags.building === 'construction') {
    return {color: '#5e605b', material: 'concrete', roof: 'open'};
  }
  return {color: '#85796d', material: 'plaster', roof: 'pitched'};
};

const landmarks: EnvironmentLandmark[] = buildingPolygons
  .filter(({polygon}) => polygonArea(polygon) >= 8)
  .map(({feature, polygon}) => {
    const bounds = boundsOf(polygon);
    const style = buildingStyle(feature);
    const name =
      feature.tags.name ??
      (feature.tags.building === 'train_station'
        ? 'Gara Cluj-Napoca'
        : `Clădire OSM ${feature.id.replace('way/', '')}`);
    return {
      id: `building-${feature.id.replace('/', '-')}`,
      name,
      type: feature.tags.building === 'train_station' ? 'station' : (feature.tags.building ?? 'building'),
      x: round(bounds.minX),
      y: round(bounds.minY),
      width: round(bounds.maxX - bounds.minX),
      height: round(bounds.maxY - bounds.minY),
      color: style.color,
      elevation: round(buildingHeight(feature)),
      material: style.material,
      roof: style.roof,
      floors: parseLevels(feature),
    };
  });

for (const feature of platformFeatures) {
  const points =
    feature.geometry.type === 'Polygon'
      ? polygonWorld(feature, authoring.elevationModel.platform)
      : lineWorld(feature, authoring.elevationModel.platform);
  if (points.length < 2) continue;
  const bounds = boundsOf(points);
  landmarks.push({
    id: `platform-${feature.id.replace('/', '-')}`,
    name: feature.tags.name ?? `Peronul ${feature.tags.ref ?? ''}`.trim(),
    type: 'platform',
    x: round(bounds.minX),
    y: round(bounds.minY),
    width: Math.max(2, round(bounds.maxX - bounds.minX)),
    height: Math.max(2, round(bounds.maxY - bounds.minY)),
    color: '#85877e',
    elevation: authoring.elevationModel.platform,
    material: 'concrete',
    roof: 'open',
  });
}

const canopyPolygons = authoring.approximateCanopies.map((canopy) => {
  const [start, end] = canopy.coordinates.map((coordinate) => coordinateToWorld(coordinate)) as [
    WorldPoint,
    WorldPoint,
  ];
  const polygon = bufferSegment(start, end, canopy.widthMeters, 0);
  const bounds = boundsOf(polygon);
  landmarks.push({
    id: canopy.id,
    name: canopy.name,
    type: 'canopy',
    x: round(bounds.minX),
    y: round(bounds.minY),
    width: round(bounds.maxX - bounds.minX),
    height: round(bounds.maxY - bounds.minY),
    color: '#59696a',
    elevation: authoring.elevationModel.canopyClearance,
    material: 'metal',
    roof: 'metal',
  });
  return {...canopy, polygon};
});

const treeFeatures = osm.features.filter(
  (feature) => feature.geometry.type === 'Point' && feature.tags.natural === 'tree',
);
const trees = treeFeatures.map((feature) => {
  const coordinate = (feature.geometry as {type: 'Point'; coordinates: Coordinate}).coordinates;
  return {
    id: `tree-${feature.id.replace('/', '-')}`,
    ...coordinateToWorld(coordinate),
    size: 0.8,
  };
});
const furnitureFeatures = osm.features.filter(
  (feature) =>
    feature.geometry.type === 'Point' &&
    (feature.tags.public_transport ||
      feature.tags.highway === 'bus_stop' ||
      ['bench', 'waste_basket', 'shelter', 'bicycle_parking'].includes(feature.tags.amenity ?? '') ||
      ['gate', 'lift_gate', 'entrance'].includes(feature.tags.barrier ?? '')),
);
const streetFurniture = furnitureFeatures.map((feature) => {
  const coordinate = (feature.geometry as {type: 'Point'; coordinates: Coordinate}).coordinates;
  const type = feature.tags.railway === 'tram_stop'
    ? 'tram-stop-sign'
    : feature.tags.highway === 'bus_stop' || feature.tags.bus === 'yes'
      ? 'bus-stop-sign'
      : feature.tags.amenity ?? feature.tags.barrier ?? 'station-marker';
  return {
    id: `prop-${feature.id.replace('/', '-')}`,
    type,
    ...coordinateToWorld(coordinate),
    width: type.includes('stop') ? 0.5 : 1,
    depth: type.includes('stop') ? 0.5 : 1,
    height: type.includes('stop') ? 2.4 : 1,
    color: type.includes('tram') ? '#7c3030' : '#355b77',
  };
});

const environment: EnvironmentResource & {
  schemaVersion: string;
  disclaimer: string;
  attribution: {
    primary: {label: string; url: string};
    secondary: {label: string; url: string};
    legalNotice: string;
  };
} = {
  schemaVersion: '1.0.0',
  id: 'cluj-napoca-station-environment',
  name: 'Gara Cluj-Napoca și Piața Gării',
  disclaimer:
    'Geometrie derivată din date deschise; finisaj vizual provizoriu, autorizat numai pentru această versiune privată de test.',
  attribution: {
    primary: {label: '© OpenStreetMap contributors', url: osm.licenceUrl},
    secondary: {label: 'Teren: Copernicus DEM GLO-30', url: terrain.licenceUrl},
    legalNotice: `${terrain.attribution}. ${terrain.liabilityNotice}`,
  },
  atmosphere: {
    sky: '#607079',
    horizon: '#27373b',
    ground: '#56605d',
    groundDark: '#27312f',
    backdropTexture: '../../materials/industrial-wet-asphalt.png',
    backdropTints: ['#d9e0da', '#d7ded9', '#d4dbd6', '#d8dfd9', '#e2e5de'],
    wetness: 0.42,
    puddleCount: 28,
    leafLitterCount: 70,
  },
  surfaces: [
    {id: 'station-envelope', type: 'yard', x: 0, y: 0, width: worldBounds.maxX, height: worldBounds.maxY, color: '#4f5855'},
    {id: 'piata-garii', type: 'plaza', x: 70, y: 165, width: 380, height: 95, color: '#777a72'},
    {id: 'passenger-rail-corridor', type: 'rail', x: 40, y: 245, width: worldBounds.maxX - 40, height: 175, color: '#414742'},
    {id: 'horea-access', type: 'road', x: 250, y: 0, width: 95, height: 230, color: '#3e4848'},
  ],
  landmarks,
  trees,
  streetFurniture,
};

const sourceViewPaths = projections.map((projection) => `views/${projection.id}.svg`);
const viewPaths = projections.map((projection) => `views/${projection.id}.webp`);
const trialRuntimeRoot = path.join(projectRoot, 'art/cluj-napoca-station/trials/runtime');
const backdropPaths = projections.map((projection) => `backdrops/${projection.id}.svg`);
const occlusionPaths = projections.map((projection) => `occlusion/${projection.id}.svg`);
const detailPaths = projections.map((projection) => `details/${projection.id}.svg`);
const depthPaths = projections.map((projection) => `depth/${projection.id}.svg`);
const rasterViewPaths = projections.map((projection) => `raster/views/${projection.id}.webp`);
const rasterBackdropPaths = projections.map((projection) => `raster/backdrops/${projection.id}.webp`);
const rasterOcclusionPaths = projections.map((projection) => `raster/occlusion/${projection.id}.webp`);
const rasterDetailPaths = projections.map((projection) => `raster/details/${projection.id}.webp`);
const rasterDepthPaths = projections.map((projection) => `raster/depth/${projection.id}.webp`);
const agentClosePaths = Array.from(
  {length: 8},
  (_, direction) => `sprites/agent-close-direction-${direction}.webp`,
);
const manifest = {
  schemaVersion: '1.0.0',
  id: 'cluj-napoca-station',
  name: 'Gara Cluj-Napoca — Piața Gării',
  mode: 'exploration',
  world: 'world.json',
  environment: 'environment.json',
  mission: 'mission.json',
  navigation: {
    walkable: 'navigation/walkable.json',
    blockers: 'navigation/blockers.json',
    visionBlockers: 'navigation/vision-blockers.json',
  },
  entities: ['entities/player.json'],
  patrols: [],
  interactions: {},
  projections: projections.map((projection) => `projections/${projection.id}.json`),
  sourceViews: sourceViewPaths,
  views: viewPaths,
  backdrops: rasterBackdropPaths,
  backdropScale: 4,
  occlusion: rasterOcclusionPaths,
  detailOverlays: rasterDetailPaths,
  depthMaps: rasterDepthPaths,
  defaultRendering: 'colored',
  renderings: [
    {id: 'svg', label: 'SVG', views: sourceViewPaths},
    {id: 'raster', label: 'PNG', views: rasterViewPaths},
    {id: 'colored', label: 'Colored', views: viewPaths},
  ],
  agentAtlas: 'sprites/agent-atlas.png',
  agentCloseAtlases: agentClosePaths,
  agentCloseAnimation: {
    frameWidth: 1024,
    frameHeight: 1280,
    visibleHeightPixels: 1119,
    firstVisibleRow: 47,
    lastVisibleRow: 1177,
    columns: 3,
    rows: 3,
  },
  agentAnimation: {
    frameWidth: 128,
    frameHeight: 160,
    directions: 8,
    visibleHeightPixels: 137,
    idle: [0],
    walk: [1, 2, 3, 4],
    run: [5, 6, 7, 8],
    walkFrameRate: 8,
    runFrameRate: 12,
  },
  entityScale: round((1.8 * projections[0]!.scale) / 137, 6),
  entityWorldHeightMeters: 1.8,
};

await writeJson('world.json', world);
await writeJson('environment.json', environment);
await writeJson('navigation/walkable.json', navigation);
await writeJson('navigation/blockers.json', {
  schemaVersion: '1.0.0',
  id: 'cluj-napoca-station-blockers',
  name: 'Garduri și bariere segmentate',
  rectangles: blockers,
});
await writeJson('navigation/vision-blockers.json', {
  schemaVersion: '1.0.0',
  id: 'cluj-napoca-station-vision-blockers',
  name: 'Clădiri care blochează vizibilitatea',
  rectangles: buildingBlockers,
});
await writeJson('entities/player.json', {
  schemaVersion: '1.0.0',
  id: 'player',
  name: 'Agent',
  kind: 'player',
  spawn: playerSpawn,
  speed: 8,
  runSpeed: 13,
  worldHeightMeters: 2,
  visualScale: 2.4,
});
await writeJson('mission.json', {
  schemaVersion: '1.0.0',
  id: 'explorare-gara-cluj',
  name: 'Explorare liberă',
  description: 'Explorează zonele publice exterioare ale Gării Cluj-Napoca.',
  objectives: [
    {id: 'piata', name: 'Vizitează Piața Gării'},
    {id: 'peroane', name: 'Explorează peroanele'},
    {id: 'transport', name: 'Identifică stațiile CTP'},
    {id: 'iesire', name: 'Revino în zona pietonală'},
  ],
  observationSeconds: 2,
  observationRadius: 20,
  interactionRadius: 6,
  lockdownSeconds: 60,
});
for (const projection of projections) {
  await writeJson(`projections/${projection.id}.json`, projection);
}
await mkdir(path.join(locationRoot, 'sprites'), {recursive: true});
await copyFile(
  path.join(projectRoot, 'public/content/locations/vatra-central-station/sprites/agent-atlas.png'),
  path.join(locationRoot, 'sprites/agent-atlas.png'),
);
for (const closePath of agentClosePaths) {
  await copyFile(
    path.join(projectRoot, 'public/content/locations/vatra-central-station', closePath),
    path.join(locationRoot, closePath),
  );
}

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const projectPoint = (projection: ProjectionResource, point: WorldPoint) => {
  const [a, b, c, d] = projection.matrix;
  return {
    x: projection.origin.x + (a! * point.x + b! * point.y) * projection.scale,
    y:
      projection.origin.y +
      (c! * point.x + d! * point.y) * projection.scale -
      (projection.kind === 'top' ? 0 : point.elevation * projection.scale),
  };
};
const svgPoints = (projection: ProjectionResource, points: WorldPoint[]): string =>
  points
    .map((point) => projectPoint(projection, point))
    .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(' ');
const svgPath = (projection: ProjectionResource, points: WorldPoint[]): string =>
  points
    .map((point, index) => {
      const projected = projectPoint(projection, point);
      return `${index === 0 ? 'M' : 'L'}${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`;
    })
    .join(' ');
const raised = (points: WorldPoint[], elevation: number): WorldPoint[] =>
  points.map((point) => ({...point, elevation: round(point.elevation + elevation)}));
const colorForLand = (feature: SourceFeature): string => {
  if (feature.tags.landuse === 'grass' || feature.tags.leisure === 'park') return '#556b50';
  if (feature.tags.landuse === 'construction') return '#59574f';
  if (feature.tags.amenity === 'parking') return '#59605d';
  if (feature.tags.landuse === 'garages') return '#4d5350';
  return '#515b56';
};
function roadWidth(feature: SourceFeature): number {
  if (feature.tags.highway === 'primary') return Number(feature.tags.lanes ?? 2) * 3.2;
  if (['secondary', 'tertiary'].includes(feature.tags.highway ?? '')) return 7;
  if (['residential', 'service'].includes(feature.tags.highway ?? '')) return 5;
  if (['footway', 'pedestrian', 'steps', 'path'].includes(feature.tags.highway ?? '')) return 2.2;
  return 4;
}
const roadColor = (feature: SourceFeature): string =>
  ['footway', 'pedestrian', 'steps', 'path'].includes(feature.tags.highway ?? '')
    ? '#969489'
    : '#3e4747';

const landFeatures = osm.features.filter(
  (feature) =>
    feature.geometry.type === 'Polygon' &&
    !feature.tags.building &&
    feature.tags.railway !== 'platform' &&
    (feature.tags.landuse || feature.tags.leisure || feature.tags.amenity === 'parking'),
);
const roadFeatures = osm.features.filter(
  (feature) => feature.geometry.type === 'LineString' && feature.tags.highway,
);
const entranceFeatures = osm.features.filter(
  (feature) => feature.geometry.type === 'Point' && feature.tags.entrance !== undefined,
);

const renderBuilding = (
  projection: ProjectionResource,
  feature: SourceFeature,
): {beauty: string; occlusion: string; depth: number} => {
  const base = polygonWorld(feature);
  const topElevation = projection.kind === 'top' ? 0 : buildingHeight(feature);
  const roof = raised(base, topElevation);
  const style = buildingStyle(feature);
  const walls = projection.kind === 'top'
    ? ''
    : base
        .map((point, index) => {
          const next = base[(index + 1) % base.length]!;
          const nextTop = roof[(index + 1) % roof.length]!;
          const top = roof[index]!;
          return `<polygon points="${svgPoints(projection, [point, next, nextTop, top])}" fill="${index % 2 ? '#5c5d56' : '#716d61'}" stroke="#303633" stroke-width=".45"/>`;
        })
        .join('');
  const station = feature.tags.building === 'train_station';
  const roofFill = station
    ? 'url(#stationRoof)'
    : style.roof === 'metal'
      ? 'url(#metalRoof)'
      : style.roof === 'open'
        ? 'url(#construction)'
        : 'url(#roofTile)';
  const beauty = `<g data-landmark="${escapeXml(feature.id)}" data-building="${escapeXml(feature.id)}"${station ? ' data-station="main"' : ''}>${walls}<polygon points="${svgPoints(projection, roof)}" fill="${roofFill}" stroke="#343832" stroke-width=".7"/></g>`;
  const occlusion = `<polygon data-occluder="${escapeXml(feature.id)}" points="${svgPoints(projection, roof)}" fill="#17201c" opacity="${projection.kind === 'top' ? '.12' : '.52'}"/>`;
  return {
    beauty,
    occlusion,
    depth: centroid(roof).y,
  };
};

for (const [viewIndex, projection] of projections.entries()) {
  const footprintScreenPoints = svgPoints(projection, mapFootprint);
  const defs = `<defs>
    <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#6f8085"/><stop offset="1" stop-color="#263437"/></linearGradient>
    <pattern id="asphalt" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="#46504e"/><circle cx="3" cy="5" r=".7" fill="#707875" opacity=".35"/><circle cx="13" cy="12" r=".55" fill="#252d2c" opacity=".5"/></pattern>
    <pattern id="pavers" width="12" height="8" patternUnits="userSpaceOnUse"><rect width="12" height="8" fill="#85867d"/><path d="M0 0h12M0 8h12M6 0v8" stroke="#666a64" stroke-width=".55"/></pattern>
    <pattern id="ballast" width="11" height="9" patternUnits="userSpaceOnUse"><rect width="11" height="9" fill="#484b46"/><circle cx="2" cy="3" r="1.2" fill="#77766c"/><circle cx="8" cy="6" r="1.4" fill="#62635d"/></pattern>
    <pattern id="roofTile" width="10" height="7" patternUnits="userSpaceOnUse"><rect width="10" height="7" fill="#76685c"/><path d="M0 1h10M2 1v6M7 1v6" stroke="#554b45" stroke-width=".55"/></pattern>
    <pattern id="stationRoof" width="12" height="8" patternUnits="userSpaceOnUse"><rect width="12" height="8" fill="#4d5b56"/><path d="M0 2h12M3 2v6M9 2v6" stroke="#77817a" stroke-width=".65"/></pattern>
    <linearGradient id="metalRoof"><stop stop-color="#7a8987"/><stop offset="1" stop-color="#3f5151"/></linearGradient>
    <pattern id="construction" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="#665f51"/><rect width="3" height="9" fill="#9b804b" opacity=".5"/></pattern>
    <linearGradient id="platform" x2="0" y2="1"><stop stop-color="#a5a69c"/><stop offset="1" stop-color="#747a75"/></linearGradient>
    <radialGradient id="vignette"><stop offset="58%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#08100e" stop-opacity=".42"/></radialGradient>
    <filter id="shadow"><feGaussianBlur stdDeviation="2.2"/></filter>
    <clipPath id="stage"><rect width="960" height="640"/></clipPath>
    <clipPath id="map-footprint"><polygon points="${footprintScreenPoints}"/></clipPath>
  </defs>`;

  const terrainShade = terrain.samples
    .map((sample, index) => {
      const local = coordinateToWorld([sample.longitude, sample.latitude]);
      const projected = projectPoint(projection, local);
      const delta = sample.elevationMeters - terrain.referenceElevationMeters;
      const color = delta >= 0 ? '#d7c99c' : '#8fb2ad';
      return `<circle data-terrain-sample="${index + 1}" cx="${projected.x.toFixed(1)}" cy="${projected.y.toFixed(1)}" r="${(30 + Math.min(30, Math.abs(delta) * 4)).toFixed(1)}" fill="${color}" opacity=".025"/>`;
    })
    .join('');
  const landSvg = landFeatures
    .map((feature) => {
      const polygon = polygonWorld(feature);
      const fill = colorForLand(feature);
      const pattern = feature.tags.landuse === 'construction' ? 'url(#construction)' : fill;
      return `<polygon data-surface="${escapeXml(feature.id)}" data-land="${escapeXml(feature.id)}" points="${svgPoints(projection, polygon)}" fill="${pattern}" stroke="#3f4944" stroke-width=".5"/>`;
    })
    .join('');
  const authoredForecourts = authoring.authoredGroundAreas
    .map((area) => {
      const polygon = area.coordinates.map((coordinate) => coordinateToWorld(coordinate));
      return `<polygon data-walkable="${escapeXml(area.id)}" points="${svgPoints(projection, polygon)}" fill="url(#pavers)" stroke="#b3b0a0" stroke-width=".8"/>`;
    })
    .join('');
  const roads = roadFeatures
    .map((feature) => {
      const line = lineWorld(feature);
      const width = Math.max(0.7, roadWidth(feature) * projection.scale);
      return `<path data-road="${escapeXml(feature.id)}" d="${svgPath(projection, line)}" fill="none" stroke="${roadColor(feature)}" stroke-width="${width.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');
  const tracks = activeRailFeatures
    .map((feature) => {
      const line = lineWorld(feature, authoring.elevationModel.trackBed);
      const pathData = svgPath(projection, line);
      const tram = feature.tags.railway === 'tram';
      const width = (tram ? 4 : 6) * projection.scale;
      return `<g data-hazard="${tram ? 'tram-track' : 'rail-track'}" data-source="${escapeXml(feature.id)}"><path d="${pathData}" fill="none" stroke="url(#ballast)" stroke-width="${width.toFixed(2)}"/><path d="${pathData}" fill="none" stroke="#222826" stroke-width="${Math.max(1.1, width * .48).toFixed(2)}" stroke-dasharray="1.2 3.2"/><path d="${pathData}" fill="none" stroke="#9a9b91" stroke-width="${Math.max(.65, width * .14).toFixed(2)}"/></g>`;
    })
    .join('');
  const barrierSvg = barrierFeatures
    .map((feature) => {
      const base = lineWorld(feature);
      const top = raised(base, feature.tags.barrier === 'fence' ? 1.5 : 1.1);
      const posts = projection.kind === 'top'
        ? ''
        : base
            .map((point, index) =>
              `<line x1="${projectPoint(projection, point).x.toFixed(1)}" y1="${projectPoint(projection, point).y.toFixed(1)}" x2="${projectPoint(projection, top[index]!).x.toFixed(1)}" y2="${projectPoint(projection, top[index]!).y.toFixed(1)}" stroke="#252d2a" stroke-width=".9"/>`,
            )
            .join('');
      return `<g data-barrier="${escapeXml(feature.tags.barrier ?? 'barrier')}" data-source="${escapeXml(feature.id)}">${posts}<path d="${svgPath(projection, top)}" fill="none" stroke="#5c665f" stroke-width="${feature.tags.barrier === 'fence' ? '1.2' : '2'}" stroke-dasharray="${feature.tags.barrier === 'fence' ? '2 1' : 'none'}"/></g>`;
    })
    .join('');
  const platformSvg = platformFeatures
    .map((feature) => {
      if (feature.geometry.type === 'Polygon') {
        const polygon = polygonWorld(feature, authoring.elevationModel.platform);
        return `<polygon data-platform="${escapeXml(feature.tags.ref ?? feature.id)}" points="${svgPoints(projection, polygon)}" fill="url(#platform)" stroke="#d3d0ba" stroke-width="1.1"/>`;
      }
      const line = lineWorld(feature, authoring.elevationModel.platform);
      return `<path data-platform="${escapeXml(feature.tags.ref ?? feature.id)}" d="${svgPath(projection, line)}" fill="none" stroke="url(#platform)" stroke-width="${(7 * projection.scale).toFixed(2)}" stroke-linecap="round"/>`;
    })
    .join('');
  const crossingSvg = authoring.legitimateRailCrossings
    .map((crossing) => {
      const line = crossing.coordinates.map((coordinate) =>
        coordinateToWorld(coordinate, crossing.elevation + 0.02),
      );
      return `<path data-crossing="${escapeXml(crossing.id)}" d="${svgPath(projection, line)}" fill="none" stroke="#c9bf91" stroke-width="${Math.max(2, 3 * projection.scale).toFixed(2)}" stroke-dasharray="2 1"/>`;
    })
    .join('');
  const canopySvg = canopyPolygons
    .map((canopy) => {
      const roof = raised(
        canopy.polygon,
        projection.kind === 'top' ? 0 : authoring.elevationModel.canopyClearance,
      );
      const center = centroid(canopy.polygon);
      const poles = projection.kind === 'top'
        ? ''
        : [0.18, 0.5, 0.82]
            .map((fraction) => {
              const x = canopy.polygon[0]!.x + (canopy.polygon[1]!.x - canopy.polygon[0]!.x) * fraction;
              const y = canopy.polygon[0]!.y + (canopy.polygon[1]!.y - canopy.polygon[0]!.y) * fraction;
              const base = projectPoint(
                projection,
                surfacePoint(x, y, authoring.elevationModel.platform),
              );
              const top = projectPoint(
                projection,
                surfacePoint(x, y, authoring.elevationModel.canopyClearance),
              );
              return `<line x1="${base.x.toFixed(1)}" y1="${base.y.toFixed(1)}" x2="${top.x.toFixed(1)}" y2="${top.y.toFixed(1)}" stroke="#394846" stroke-width="1.2"/>`;
            })
            .join('');
      return `<g data-canopy="${escapeXml(canopy.id)}" data-center="${center.x.toFixed(1)},${center.y.toFixed(1)}">${poles}<polygon points="${svgPoints(projection, roof)}" fill="url(#metalRoof)" stroke="#b3bbb3" stroke-width=".8"/></g>`;
    })
    .join('');
  const renderedBuildings = buildingFeatures
    .map((feature) => renderBuilding(projection, feature))
    .sort((left, right) => left.depth - right.depth);
  const buildings = renderedBuildings.map((building) => building.beauty).join('');
  const entranceSvg = entranceFeatures
    .map((feature) => {
      const coordinate = (feature.geometry as {type: 'Point'; coordinates: Coordinate}).coordinates;
      const base = coordinateToWorld(coordinate, 0.1);
      const top = coordinateToWorld(coordinate, 2.7);
      const baseScreen = projectPoint(projection, base);
      const topScreen = projectPoint(projection, top);
      const kind = feature.tags.entrance === 'main' ? 'main' : 'yes';
      return projection.kind === 'top'
        ? `<rect data-entrance="${kind}" data-source="${escapeXml(feature.id)}" x="${(baseScreen.x - 2.4).toFixed(1)}" y="${(baseScreen.y - 2.4).toFixed(1)}" width="4.8" height="4.8" fill="#d3bd82" stroke="#26312e" stroke-width=".7"/>`
        : `<g data-entrance="${kind}" data-source="${escapeXml(feature.id)}"><line x1="${baseScreen.x.toFixed(1)}" y1="${baseScreen.y.toFixed(1)}" x2="${topScreen.x.toFixed(1)}" y2="${topScreen.y.toFixed(1)}" stroke="#202927" stroke-width="5"/><line x1="${baseScreen.x.toFixed(1)}" y1="${baseScreen.y.toFixed(1)}" x2="${topScreen.x.toFixed(1)}" y2="${topScreen.y.toFixed(1)}" stroke="#b6a574" stroke-width="2.4"/></g>`;
    })
    .join('');
  const treeSvg = treeFeatures
    .map((feature) => {
      const coordinate = (feature.geometry as {type: 'Point'; coordinates: Coordinate}).coordinates;
      const point = coordinateToWorld(coordinate);
      const base = projectPoint(projection, point);
      const crown = projectPoint(projection, {
        ...point,
        elevation: projection.kind === 'top' ? 0 : 6,
      });
      return `<g data-tree="${escapeXml(feature.id)}"><ellipse cx="${(base.x + 4).toFixed(1)}" cy="${(base.y + 3).toFixed(1)}" rx="6" ry="2.4" fill="#18221c" opacity=".35"/><line x1="${base.x.toFixed(1)}" y1="${base.y.toFixed(1)}" x2="${crown.x.toFixed(1)}" y2="${crown.y.toFixed(1)}" stroke="#4e3e31" stroke-width="2"/><circle cx="${crown.x.toFixed(1)}" cy="${crown.y.toFixed(1)}" r="5.8" fill="#526d50" stroke="#79876b" stroke-width=".6"/></g>`;
    })
    .join('');
  const propSvg = furnitureFeatures
    .map((feature) => {
      const coordinate = (feature.geometry as {type: 'Point'; coordinates: Coordinate}).coordinates;
      const screen = projectPoint(projection, coordinateToWorld(coordinate, 1));
      const tram = feature.tags.railway === 'tram_stop';
      const transportStop = feature.tags.public_transport || feature.tags.highway === 'bus_stop';
      return `<g data-prop="${escapeXml(feature.id)}"${transportStop ? ` data-transport-stop="${escapeXml(feature.id)}"` : ''}><line x1="${screen.x.toFixed(1)}" y1="${(screen.y + 3).toFixed(1)}" x2="${screen.x.toFixed(1)}" y2="${(screen.y - 2).toFixed(1)}" stroke="#303b38" stroke-width="1"/><circle cx="${screen.x.toFixed(1)}" cy="${(screen.y - 3).toFixed(1)}" r="1.8" fill="${tram ? '#a54d43' : '#426d8c'}" stroke="#e3dcc0" stroke-width=".45"/></g>`;
    })
    .join('');
  const tunnelLabels = connections
    .filter((connection) => connection.type === 'stairs' || connection.type === 'tunnel-portal')
    .map((connection) => {
      const screen = projectPoint(projection, {
        ...connection.from,
        elevation: connection.from.elevation + 0.8,
      });
      return `<g data-tunnel-entrance="${escapeXml(connection.id)}"><path d="M${(screen.x - 3).toFixed(1)} ${(screen.y + 2).toFixed(1)}h6v-5h-6z" fill="#253331" stroke="#c1b98f" stroke-width=".6"/><path d="M${(screen.x - 2).toFixed(1)} ${screen.y.toFixed(1)}h4" stroke="#d9ce9e" stroke-width=".7"/></g>`;
    })
    .join('');
  const beautySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1280" viewBox="0 0 960 640">${defs}<g clip-path="url(#stage)"><g clip-path="url(#map-footprint)"><polygon data-surface="world-ground" data-footprint="source-supported" points="${footprintScreenPoints}" fill="url(#asphalt)" stroke="#747d76" stroke-width="1.2"/>${terrainShade}${landSvg}${roads}${authoredForecourts}${tracks}${platformSvg}${crossingSvg}${canopySvg}${buildings}${entranceSvg}${barrierSvg}${treeSvg}${propSvg}<rect width="960" height="640" fill="url(#vignette)" pointer-events="none"/></g></g></svg>`;
  const detailSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">${defs}<g clip-path="url(#map-footprint)">${tunnelLabels}</g></svg>`;
  const occlusionSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">${defs}<g clip-path="url(#map-footprint)">${renderedBuildings.map((building) => building.occlusion).join('')}</g></svg>`;
  const backdropSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><defs><pattern id="outer" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#374542"/><path d="M0 12h24M12 0v24" stroke="#56625c" stroke-width=".45" opacity=".45"/></pattern><radialGradient id="fade"><stop stop-color="#718078" stop-opacity=".18"/><stop offset="1" stop-color="#101a18" stop-opacity=".75"/></radialGradient></defs><rect width="960" height="640" fill="url(#outer)"/><rect width="960" height="640" fill="url(#fade)"/></svg>`;
  const buildingDepths = renderedBuildings.map(({depth}) => depth);
  const minimumDepth = Math.min(...buildingDepths);
  const depthRange = Math.max(1, Math.max(...buildingDepths) - minimumDepth);
  const depthSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><rect width="960" height="640" fill="#000"/>${renderedBuildings.map((building) => {
    const value = Math.round(40 + ((building.depth - minimumDepth) / depthRange) * 200);
    const gray = value.toString(16).padStart(2, '0');
    return building.occlusion
      .replace('fill="#17201c"', `fill="#${gray}${gray}${gray}"`)
      .replace(/ opacity="[^"]+"/, '');
  }).join('')}</svg>`;
  queueHighResolutionView(beautySvg, highResolutionViews[viewIndex]!);
  queueHighResolutionView(detailSvg, highResolutionDetails[viewIndex]!);
  queueHighResolutionView(occlusionSvg, highResolutionOcclusion[viewIndex]!);
  await writeText(sourceViewPaths[viewIndex]!, beautySvg);
  await copyFile(
    path.join(trialRuntimeRoot, `${projection.id}.webp`),
    path.join(locationRoot, viewPaths[viewIndex]!),
  );
  await writeText(detailPaths[viewIndex]!, detailSvg);
  await writeText(occlusionPaths[viewIndex]!, occlusionSvg);
  await writeText(backdropPaths[viewIndex]!, backdropSvg);
  await writeText(depthPaths[viewIndex]!, depthSvg);
  await Promise.all([
    writeRasterPair('views', projection.id, beautySvg),
    writeRasterPair('backdrops', projection.id, backdropSvg),
    writeRasterPair('details', projection.id, detailSvg),
    writeRasterPair('occlusion', projection.id, occlusionSvg),
    writeRasterPair('depth', projection.id, depthSvg),
  ]);
}

if (skipHighResolution) {
  await writeJson('manifest.json', manifest);
} else {
  const highResolutionBundleBuffers = await renderHighResolutionBundles();
  const highResolutionBundles = highResolutionBundleBuffers.map((_, index) => ({
    path: `high-resolution/tiles-${index}.bin`,
    mimeType: 'image/png',
  }));
  await Promise.all(
    highResolutionBundleBuffers.map((bundle, index) =>
      writeBinary(highResolutionBundles[index]!.path, bundle),
    ),
  );

  const preloadPaths = new Set([
    ...viewPaths,
    ...sourceViewPaths,
    ...rasterViewPaths,
    ...rasterBackdropPaths,
    ...rasterOcclusionPaths,
    ...rasterDetailPaths,
    ...rasterDepthPaths,
    'sprites/agent-atlas.png',
    ...agentClosePaths,
    ...highResolutionBundles.map((bundle) => bundle.path),
  ]);
  const preloadAssets = await Promise.all(
    [...preloadPaths].sort().map(async (assetPath) => ({
      path: assetPath,
      bytes: (await stat(path.join(locationRoot, assetPath))).size,
    })),
  );
  await writeJson('manifest.json', {
    ...manifest,
    highResolution: {
      stageWidth: HIGH_RESOLUTION_STAGE.width,
      stageHeight: HIGH_RESOLUTION_STAGE.height,
      tileSize: HIGH_RESOLUTION_TILE_SIZE,
      bundles: highResolutionBundles,
      renderingIds: ['svg', 'raster'],
      views: highResolutionViews,
      detailOverlays: highResolutionDetails,
      occlusion: highResolutionOcclusion,
    },
    preloadAssets,
  });
}

console.log(
  `Generated Cluj-Napoca station: ${walkableAreas.length} walkable areas, ${connections.length} elevation connections, ${closedBuildingHazards.length + trackHazards.length} hazards, ${blockers.length} barrier blockers, ${buildingFeatures.length} buildings, ${activeRailFeatures.length} active rail/tram ways.`,
);
