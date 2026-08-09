export interface CameraFraming {
  fov:number;
  horizontal:boolean;
}

export const cameraFraming=(aspectRatio:number):CameraFraming=>
  aspectRatio<0.8?{fov:1.35,horizontal:true}:{fov:0.8,horizontal:false};
