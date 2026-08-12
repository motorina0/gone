import type {WorldPoint,EntityKind} from '../world/WorldTypes';
export interface Rect{id:string;x:number;y:number;width:number;height:number}
export interface ProjectionResource{id:string;name:string;kind:'isometric'|'top';matrix:number[];origin:{x:number;y:number};scale:number;azimuth:number;elevation:number}
export interface WorldResource{id:string;name:string;bounds:{minX:number;minY:number;maxX:number;maxY:number};spawns:Record<string,WorldPoint>;exchange:WorldPoint;package:WorldPoint;extraction:WorldPoint}
export interface EntityResource{id:string;name:string;kind:EntityKind;spawn:WorldPoint;speed:number;entities?:EntityResource[]}
export interface PatrolResource{id:string;name:string;loop:boolean;points:WorldPoint[];patrols?:string[]}
export interface MissionResource{id:string;name:string;description:string;objectives:Array<{id:string;name:string}>;observationSeconds:number;observationRadius:number;interactionRadius:number;lockdownSeconds:number}
export interface Manifest{id:string;name:string;world:string;environment:string;mission:string;navigation:{walkable:string;blockers:string;visionBlockers:string};entities:string[];patrols:string[];interactions:Record<string,string>;projections:string[];views:string[];occlusion:string[];detailOverlays:string[]}
export interface LoadedContent{baseUrl:URL;manifest:Manifest;world:WorldResource;mission:MissionResource;entities:EntityResource[];patrols:PatrolResource[];blockers:Rect[];visionBlockers:Rect[];projections:ProjectionResource[];views:string[];occlusion:string[];detailOverlays:string[]}
