import {angleBetween,distance} from '../core/math'; import type {GuardData,Vec2} from '../core/types';
export const canTakedown=(player:Vec2,g:GuardData)=>!g.defeated&&g.state!=='alert'&&distance(player,g.position)<=1.5&&angleBetween(g.facing,{x:player.x-g.position.x,z:player.z-g.position.z})>Math.PI*0.65;
