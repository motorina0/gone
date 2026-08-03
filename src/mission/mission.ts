import {distance} from '../core/math'; import type {Phase,Vec2} from '../core/types';
export const OBJECTIVE={x:11,z:-11}, EXTRACTION={x:-11,z:11};
export const objectiveReached=(p:Vec2)=>distance(p,OBJECTIVE)<1.5;
export const evaluateMission=(objective:boolean,p:Vec2,detected:boolean):Phase=>detected?'lost':objective&&distance(p,EXTRACTION)<1.8?'won':'playing';
