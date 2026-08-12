import type {WorldPoint} from '../world/WorldTypes';
export const withinRange=(a:WorldPoint,b:WorldPoint,radius:number):boolean=>Math.hypot(a.x-b.x,a.y-b.y)<=radius;
