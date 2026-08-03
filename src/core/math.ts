import type { Vec2 } from './types';
export const distance=(a:Vec2,b:Vec2)=>Math.hypot(a.x-b.x,a.z-b.z);
export const normalized=(v:Vec2):Vec2=>{const n=Math.hypot(v.x,v.z);return n?{x:v.x/n,z:v.z/n}:{x:0,z:0}};
export const angleBetween=(a:Vec2,b:Vec2)=>Math.acos(Math.max(-1,Math.min(1,normalized(a).x*normalized(b).x+normalized(a).z*normalized(b).z)));
export const moveToward=(a:Vec2,b:Vec2,d:number):Vec2=>{const n=distance(a,b);return n<=d?{...b}:{x:a.x+(b.x-a.x)*d/n,z:a.z+(b.z-a.z)*d/n}};
