import type {GuardData,PlayerData,Vec2} from '../core/types';
const routes:Vec2[][]=[[[-10,-8],[-5,-8]],[[-2,-11],[3,-11]],[[7,-8],[11,-4]],[[9,4],[9,10]],[[1,6],[-4,6]],[[-10,2],[-10,8]]].map(r=>r.map(([x,z])=>({x:x!,z:z!})));
export const createPlayer=():PlayerData=>({position:{x:-12,z:-12},selected:false,path:[],crouched:false});
export const createGuards=():GuardData[]=>routes.map((route,id)=>({id,position:{...route[0]},facing:{x:1,z:0},route,waypoint:1,state:'idle',stateTime:id*.1,exposure:0,defeated:false}));
