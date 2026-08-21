import type {EntityKind, WorldPoint} from '../world/WorldTypes';

export interface Rect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minElevation?: number;
  maxElevation?: number;
}

export interface WalkableArea {
  id: string;
  elevation: number;
  points: WorldPoint[];
  elevationPlane?: {
    originX: number;
    originY: number;
    originElevation: number;
    slopeX: number;
    slopeY: number;
  };
}

export interface NavigationHazard {
  id: string;
  points: WorldPoint[];
  minElevation?: number;
  maxElevation?: number;
}

export interface NavigationConnection {
  id: string;
  type: 'stairs' | 'ramp' | 'tunnel-portal' | 'crossing';
  from: WorldPoint;
  to: WorldPoint;
  bidirectional?: boolean;
}

export interface NavigationResource {
  id: string;
  name: string;
  cellSize: number;
  bounds: {minX: number; minY: number; maxX: number; maxY: number};
  areas: WalkableArea[];
  connections?: NavigationConnection[];
  hazards?: NavigationHazard[];
}

export interface ProjectionResource {
  id: string;
  name: string;
  kind: 'isometric' | 'top';
  matrix: number[];
  origin: {x: number; y: number};
  scale: number;
  azimuth: number;
  elevation: number;
}

export interface WorldResource {
  id: string;
  name: string;
  bounds: {minX: number; minY: number; maxX: number; maxY: number};
  footprint?: WorldPoint[];
  spawns: Record<string, WorldPoint>;
  exchange: WorldPoint;
  package: WorldPoint;
  extraction: WorldPoint;
  geography?: {
    sourceCrs: 'EPSG:4326';
    origin: {latitude: number; longitude: number};
    geographicBounds: {west: number; east: number; south: number; north: number};
    metresPerDegree: {longitude: number; latitude: number};
    anchor: {latitude: number; longitude: number; world: WorldPoint};
    elevationDatumMeters: number;
    terrainSourceId: string;
  };
}

export interface EntityResource {
  id: string;
  name: string;
  kind: EntityKind;
  spawn: WorldPoint;
  speed: number;
  runSpeed?: number;
  entities?: EntityResource[];
}

export type SurfaceKind = 'road' | 'sidewalk' | 'plaza' | 'yard' | 'rail';

export interface EnvironmentSurface extends Rect {
  type: SurfaceKind;
  color?: string;
  markings?: 'two-lane' | 'parking';
}

export interface EnvironmentProp extends WorldPoint {
  id?: string;
  type: string;
  rotation?: number;
  width?: number;
  depth?: number;
  height?: number;
  color?: string;
  blocksMovement?: boolean;
  text?: string;
  castsLight?: boolean;
  energy?: number;
}

export interface EnvironmentLandmark extends Rect {
  name: string;
  type: string;
  color: string;
  elevation?: number;
  material?: 'stone' | 'brick' | 'plaster' | 'concrete' | 'metal' | 'glass';
  roof?: 'flat' | 'pitched' | 'metal' | 'glass' | 'open';
  floors?: number;
  signText?: string;
  canopies?: Array<{offset: number; length: number; depth?: number; yOffset?: number}>;
}

export interface DistantSceneryItem {
  id: string;
  type: 'building' | 'warehouse' | 'tree' | 'tank';
  x: number;
  y: number;
  elevation?: number;
  width?: number;
  height?: number;
  size?: number;
  rotation?: number;
  material?: 'brick' | 'plaster' | 'metal';
}

export interface EnvironmentResource {
  id: string;
  name: string;
  atmosphere: {
    sky: string;
    horizon: string;
    ground: string;
    groundDark: string;
    backdropTexture: string;
    backdropTints: string[];
    wetness: number;
    puddleCount?: number;
    leafLitterCount?: number;
  };
  surfaces: EnvironmentSurface[];
  landmarks: EnvironmentLandmark[];
  trees: Array<WorldPoint & {id?: string; size?: number}>;
  streetFurniture: EnvironmentProp[];
  distantSurfaces?: EnvironmentSurface[];
  distantScenery?: DistantSceneryItem[];
  attribution?: {
    primary: {label: string; url: string};
    secondary?: {label: string; url: string};
    legalNotice?: string;
  };
}

export interface PatrolResource {
  id: string;
  name: string;
  loop: boolean;
  points: WorldPoint[];
  patrols?: string[];
}

export interface MissionResource {
  id: string;
  name: string;
  description: string;
  objectives: Array<{id: string; name: string}>;
  observationSeconds: number;
  observationRadius: number;
  interactionRadius: number;
  lockdownSeconds: number;
}

export interface Manifest {
  id: string;
  name: string;
  mode: 'exploration' | 'mission';
  world: string;
  environment: string;
  mission: string;
  entityScale: number;
  entityWorldHeightMeters?: number;
  navigation: {
    walkable: string;
    blockers: string;
    visionBlockers: string;
  };
  entities: string[];
  patrols: string[];
  interactions: Record<string, string>;
  projections: string[];
  sourceViews: string[];
  views: string[];
  backdrops?: string[];
  backdropScale?: number;
  occlusion: string[];
  detailOverlays: string[];
  depthMaps?: string[];
  agentAtlas: string;
  agentAnimation: {
    frameWidth: number;
    frameHeight: number;
    directions: number;
    visibleHeightPixels?: number;
    idle: number[];
    walk: number[];
    run: number[];
    walkFrameRate: number;
    runFrameRate: number;
  };
}

export interface LoadedContent {
  baseUrl: URL;
  manifest: Manifest;
  world: WorldResource;
  environment: EnvironmentResource;
  mission?: MissionResource;
  entities: EntityResource[];
  patrols: PatrolResource[];
  walkable: NavigationResource;
  blockers: Rect[];
  visionBlockers: Rect[];
  projections: ProjectionResource[];
  views: string[];
  backdrops: string[];
  backdropScale: number;
  occlusion: string[];
  detailOverlays: string[];
  depthMaps: string[];
  agentAtlas: string;
}
