import type {EntityKind, WorldPoint} from '../world/WorldTypes';

export interface Rect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
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
  spawns: Record<string, WorldPoint>;
  exchange: WorldPoint;
  package: WorldPoint;
  extraction: WorldPoint;
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
}

export interface EnvironmentResource {
  id: string;
  name: string;
  atmosphere: {
    sky: string;
    horizon: string;
    ground: string;
    groundDark: string;
    wetness: number;
  };
  surfaces: EnvironmentSurface[];
  landmarks: Array<Rect & {name: string; type: string; color: string; elevation?: number}>;
  trees: Array<WorldPoint & {id?: string; size?: number}>;
  streetFurniture: EnvironmentProp[];
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
  navigation: {
    walkable: string;
    blockers: string;
    visionBlockers: string;
  };
  entities: string[];
  patrols: string[];
  interactions: Record<string, string>;
  projections: string[];
  views: string[];
  occlusion: string[];
  detailOverlays: string[];
}

export interface LoadedContent {
  baseUrl: URL;
  manifest: Manifest;
  world: WorldResource;
  environment: EnvironmentResource;
  mission?: MissionResource;
  entities: EntityResource[];
  patrols: PatrolResource[];
  blockers: Rect[];
  visionBlockers: Rect[];
  projections: ProjectionResource[];
  views: string[];
  occlusion: string[];
  detailOverlays: string[];
}
