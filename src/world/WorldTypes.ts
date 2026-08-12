export interface WorldPoint{x:number;y:number;elevation:number}
export type EntityKind='player'|'courier'|'recipient'|'guard'|'civilian';
export type GuardState='patrol'|'suspicious'|'investigate'|'alert'|'return-to-patrol';
export interface EntityState{id:string;name:string;kind:EntityKind;position:WorldPoint;speed:number;route:WorldPoint[];routeIndex:number;selected:boolean;facing:number;guardState?:GuardState;exposure:number}
export type MissionPhase='briefing'|'active'|'won'|'lost';
export type ObjectiveId='locate'|'observe'|'collect'|'extract';
export interface MissionState{phase:MissionPhase;objective:ObjectiveId;paused:boolean;exchangeComplete:boolean;observationProgress:number;packageAvailable:boolean;packageCollected:boolean;countdown:number;message:string;failureReason?:string}
export interface CameraState{focus:WorldPoint;zoom:number}
