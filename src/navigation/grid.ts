import type { Vec2 } from '../core/types';
export interface Rect {x:number;z:number;w:number;h:number}
export class GridNavigator {
 constructor(readonly size=30, readonly obstacles:Rect[]=[]){}
 isWalkable(p:Vec2){return Math.abs(p.x)<=this.size/2&&Math.abs(p.z)<=this.size/2&&!this.obstacles.some(o=>Math.abs(p.x-o.x)<o.w/2+.45&&Math.abs(p.z-o.z)<o.h/2+.45)}
 findPath(from:Vec2,to:Vec2):Vec2[]{if(!this.isWalkable(from)||!this.isWalkable(to))return[];const key=(x:number,z:number)=>`${x},${z}`, snap=(p:Vec2)=>({x:Math.round(p.x),z:Math.round(p.z)});const s=snap(from),g=snap(to),open=[s],came=new Map<string,Vec2>(),score=new Map([[key(s.x,s.z),0]]);while(open.length){open.sort((a,b)=>(score.get(key(a.x,a.z))??Infinity)+Math.hypot(a.x-g.x,a.z-g.z)-(score.get(key(b.x,b.z))??Infinity)-Math.hypot(b.x-g.x,b.z-g.z));const c=open.shift()!;if(c.x===g.x&&c.z===g.z){const path:Vec2[]=[to];let n=c;while(key(n.x,n.z)!==key(s.x,s.z)){path.unshift(n);n=came.get(key(n.x,n.z))!}return path}for(const d of [{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}]){const n={x:c.x+d.x,z:c.z+d.z};if(!this.isWalkable(n))continue;const nk=key(n.x,n.z),ng=(score.get(key(c.x,c.z))??0)+1;if(ng<(score.get(nk)??Infinity)){came.set(nk,c);score.set(nk,ng);if(!open.some(p=>p.x===n.x&&p.z===n.z))open.push(n)}}}return[]}
}
