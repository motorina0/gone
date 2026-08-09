export interface Settings{volume:number;cameraRotation:boolean;visionCones:boolean;reducedMotion:boolean;highContrast:boolean}
export const defaults:Settings={volume:.5,cameraRotation:true,visionCones:true,reducedMotion:false,highContrast:false};
export const serializeSettings=(s:Settings)=>JSON.stringify(s);
export const parseSettings=(raw:string|null):Settings=>{if(!raw)return defaults;try{const p=JSON.parse(raw) as Partial<Settings>;return {volume:typeof p.volume==='number'?Math.max(0,Math.min(1,p.volume)):defaults.volume,cameraRotation:typeof p.cameraRotation==='boolean'?p.cameraRotation:defaults.cameraRotation,visionCones:typeof p.visionCones==='boolean'?p.visionCones:defaults.visionCones,reducedMotion:typeof p.reducedMotion==='boolean'?p.reducedMotion:defaults.reducedMotion,highContrast:typeof p.highContrast==='boolean'?p.highContrast:defaults.highContrast}}catch{return defaults}};
export const loadSettings=()=>parseSettings(localStorage.getItem('shadow-grid-settings'));
export const saveSettings=(s:Settings)=>localStorage.setItem('shadow-grid-settings',serializeSettings(s));
