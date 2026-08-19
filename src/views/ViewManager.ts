import type {CameraState} from '../world/WorldTypes';
export const VIEW_IDS=['view-0','view-90','view-180','view-270','view-top'] as const;export type ViewId=typeof VIEW_IDS[number];
export class ViewManager{active:ViewId;constructor(initial:ViewId='view-0'){this.active=initial}switchTo(next:ViewId,camera:CameraState):CameraState{this.active=next;return{focus:{...camera.focus},zoom:camera.zoom,minimumZoom:camera.minimumZoom}}}
