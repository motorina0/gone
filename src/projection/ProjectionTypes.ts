import type {WorldPoint} from '../world/WorldTypes';
export interface ScreenPoint{x:number;y:number}
export interface ProjectionDefinition{id:string;kind:'isometric'|'top';matrix:readonly number[];origin:ScreenPoint;scale:number}
export interface Projection{worldToScreen(point:WorldPoint):ScreenPoint;screenToWorld(point:ScreenPoint,elevation?:number):WorldPoint}
