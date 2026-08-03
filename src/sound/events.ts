import {distance} from '../core/math'; import type {Vec2} from '../core/types';
export interface SoundEvent{position:Vec2;radius:number}
export const canHear=(guard:Vec2,event:SoundEvent)=>distance(guard,event.position)<=event.radius;
