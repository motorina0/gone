export interface Vec2 { x:number; z:number }
export type GuardState='idle'|'patrol'|'suspicious'|'investigate'|'alert'|'return';
export interface GuardData { id:number; position:Vec2; facing:Vec2; route:Vec2[]; waypoint:number; state:GuardState; stateTime:number; exposure:number; target?:Vec2; defeated:boolean }
export interface PlayerData { position:Vec2; selected:boolean; path:Vec2[]; crouched:boolean }
export type Phase='playing'|'paused'|'won'|'lost';
