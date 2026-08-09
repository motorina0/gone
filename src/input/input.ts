import {PointerEventTypes,Vector3} from '@babylonjs/core';
import type {Vec2} from '../core/types';
import type {View} from '../rendering/scene';

interface PointerSample {
  x:number;
  y:number;
  time:number;
}

const TAP_DISTANCE=12;
const TAP_DURATION=500;

export const isTap=(start:PointerSample,end:PointerSample):boolean=>
  end.time-start.time<=TAP_DURATION&&Math.hypot(end.x-start.x,end.y-start.y)<=TAP_DISTANCE;

export const bindWorldInput=(view:View,onSelect:()=>void,onMove:(p:Vec2)=>void):void=>{
  const starts=new Map<number,PointerSample>();
  view.scene.onPointerObservable.add(info=>{
    const event=info.event as PointerEvent;
    if(info.type===PointerEventTypes.POINTERDOWN&&event.button===0){
      starts.set(event.pointerId,{x:event.clientX,y:event.clientY,time:event.timeStamp});
      return;
    }
    if(info.type!==PointerEventTypes.POINTERUP||event.button!==0)return;
    const start=starts.get(event.pointerId);
    starts.delete(event.pointerId);
    if(!start||!isTap(start,{x:event.clientX,y:event.clientY,time:event.timeStamp}))return;
    const pick=view.scene.pick(view.scene.pointerX,view.scene.pointerY);
    if(pick?.pickedMesh===view.player){
      onSelect();
      return;
    }
    if(pick?.pickedMesh===view.ground&&pick.pickedPoint){
      const point=pick.pickedPoint as Vector3;
      onMove({x:point.x,z:point.z});
    }
  });
};
