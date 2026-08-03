import {angleBetween,distance} from '../core/math'; import type {Vec2} from '../core/types'; import type {Rect} from '../navigation/grid';
export const inVision=(origin:Vec2,facing:Vec2,target:Vec2,range=7,halfAngle=Math.PI/5)=>distance(origin,target)<=range&&angleBetween(facing,{x:target.x-origin.x,z:target.z-origin.z})<=halfAngle;
const orient=(a:Vec2,b:Vec2,c:Vec2)=>(b.z-a.z)*(c.x-b.x)-(b.x-a.x)*(c.z-b.z);
const intersects=(a:Vec2,b:Vec2,c:Vec2,d:Vec2)=>orient(a,b,c)*orient(a,b,d)<0&&orient(c,d,a)*orient(c,d,b)<0;
export const hasLineOfSight=(a:Vec2,b:Vec2,blocks:Rect[])=>!blocks.some(r=>{const p=[{x:r.x-r.w/2,z:r.z-r.h/2},{x:r.x+r.w/2,z:r.z-r.h/2},{x:r.x+r.w/2,z:r.z+r.h/2},{x:r.x-r.w/2,z:r.z+r.h/2}];return p.some((q,i)=>intersects(a,b,q,p[(i+1)%4]))});
export const updateExposure=(current:number,visible:boolean,dt:number,required=1.4)=>({value:Math.max(0,current+(visible?dt:-dt*1.5)),detected:visible&&current+dt>=required});
