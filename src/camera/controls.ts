export type CameraAction='zoom-in'|'zoom-out'|'rotate-left'|'rotate-right';

export interface CameraState {
  alpha:number;
  radius:number;
}

const MIN_RADIUS=14;
const MAX_RADIUS=38;
const ZOOM_STEP=3;
const ROTATION_STEP=Math.PI/8;

export const updateCamera=(state:CameraState,action:CameraAction):CameraState=>{
  switch(action){
    case 'zoom-in': return {...state,radius:Math.max(MIN_RADIUS,state.radius-ZOOM_STEP)};
    case 'zoom-out': return {...state,radius:Math.min(MAX_RADIUS,state.radius+ZOOM_STEP)};
    case 'rotate-left': return {...state,alpha:state.alpha-ROTATION_STEP};
    case 'rotate-right': return {...state,alpha:state.alpha+ROTATION_STEP};
  }
};
