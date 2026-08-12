import type {Rect} from '../content/ContentTypes';
import type {EntityState,WorldPoint} from '../world/WorldTypes';
import {hasLineOfSight} from './VisionSystem';
export const observationEligible=(player:WorldPoint,a:WorldPoint,b:WorldPoint,radius:number,blockers:Rect[]):boolean=>Math.hypot(player.x-a.x,player.y-a.y)<=radius&&Math.hypot(player.x-b.x,player.y-b.y)<=radius&&hasLineOfSight(player,a,blockers)&&hasLineOfSight(player,b,blockers);
export class ObservationSystem{update(player:EntityState,courier:EntityState,recipient:EntityState,holding:boolean,eligible:boolean,progress:number,dt:number,duration:number):number{if(holding&&eligible)return Math.min(1,progress+dt/duration);return Math.max(0,progress-dt/(duration*2))}}
