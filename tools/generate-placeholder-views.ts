import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
interface Point{x:number;y:number;elevation?:number}
interface Projection{id:string;name:string;kind:'isometric'|'top';matrix:number[];origin:Point;scale:number}
interface Landmark{id:string;name:string;type:string;x:number;y:number;width:number;height:number;color:string}
interface Environment{landmarks:Landmark[];trees:Point[];streetFurniture:Array<Point&{type:string}>}
const root=path.resolve('public/content/locations/piata-unirii');
const environment=JSON.parse(await readFile(path.join(root,'environment.json'),'utf8')) as Environment;
const ids=['0','90','180','270','top'];
const esc=(value:string)=>value.replaceAll('&','&amp;').replaceAll('’','&apos;');
for(const id of ids){
 const projection=JSON.parse(await readFile(path.join(root,'projections',`view-${id}.json`),'utf8')) as Projection;
 const [a,b,c,d]=projection.matrix as [number,number,number,number];
 const project=(p:Point):Point=>({x:projection.origin.x+(a*p.x+b*p.y)*projection.scale,y:projection.origin.y+(c*p.x+d*p.y-(p.elevation??0))*projection.scale});
 const points=(value:Point[])=>value.map(p=>{const q=project(p);return`${q.x.toFixed(1)},${q.y.toFixed(1)}`}).join(' ');
 const rectangle=(x:number,y:number,w:number,h:number,elevation=0)=>[{x,y,elevation},{x:x+w,y,elevation},{x:x+w,y:y+h,elevation},{x,y:y+h,elevation}];
 const floor=`<polygon points="${points(rectangle(0,0,120,90))}" fill="url(#ground)" stroke="#88928c" stroke-width="2"/>`;
 const grid=[] as string[];
 for(let x=0;x<=120;x+=10)grid.push(`<path d="M${points([{x,y:0},{x,y:90}])}"/>`);
 for(let y=0;y<=90;y+=10)grid.push(`<path d="M${points([{x:0,y},{x:120,y}])}"/>`);
 const roads=[rectangle(0,0,120,7),rectangle(0,83,120,7),rectangle(0,0,7,90),rectangle(113,0,7,90)].map(p=>`<polygon points="${points(p)}"/>`).join('');
 const structures=environment.landmarks.map(landmark=>{
  const height=projection.kind==='top'?0:landmark.type==='tower'?14:landmark.type==='building'?8:3;
  const base=rectangle(landmark.x,landmark.y,landmark.width,landmark.height);
  const top=rectangle(landmark.x,landmark.y,landmark.width,landmark.height,height);
  if(!height)return`<polygon points="${points(base)}" fill="${landmark.color}" stroke="#c8c0aa" stroke-width="2"/><text x="${project({x:landmark.x+landmark.width/2,y:landmark.y+landmark.height/2}).x}" y="${project({x:landmark.x+landmark.width/2,y:landmark.y+landmark.height/2}).y}" class="label">${esc(landmark.name)}</text>`;
  const walls=[0,1,2,3].map(index=>`<polygon points="${points([base[index]!,base[(index+1)%4]!,top[(index+1)%4]!,top[index]!])}" fill="${index%2?'#444945':'#505550'}" stroke="#9d9b8e"/>`).join('');
  const roof=landmark.type==='building'?`<polygon points="${points([top[0]!,top[1]!,{x:landmark.x+landmark.width/2,y:landmark.y+landmark.height/2,elevation:height+5},top[3]!])}" fill="#777266"/><polygon points="${points([top[1]!,top[2]!,top[3]!,{x:landmark.x+landmark.width/2,y:landmark.y+landmark.height/2,elevation:height+5}])}" fill="#68655e"/>`:`<polygon points="${points(top)}" fill="${landmark.color}" stroke="#d0c5aa"/>`;
  const label=project({x:landmark.x+landmark.width/2,y:landmark.y+landmark.height/2,elevation:height+6});
  return`${walls}${roof}<text x="${label.x}" y="${label.y}" class="label">${esc(landmark.name)}</text>`;
 }).join('');
 const trees=environment.trees.map(tree=>{const base=project(tree),crown=project({...tree,elevation:projection.kind==='top'?0:4});return`<path d="M${base.x},${base.y}L${crown.x},${crown.y}" stroke="#252d28" stroke-width="4"/><circle cx="${crown.x}" cy="${crown.y}" r="10" fill="#3d5a4b" stroke="#78907d"/>`}).join('');
 const furniture=environment.streetFurniture.map(item=>{const p=project(item);return item.type==='car'?`<rect x="${p.x-10}" y="${p.y-5}" width="20" height="10" rx="3" fill="#7b635d"/>`:`<rect x="${p.x-8}" y="${p.y-2}" width="16" height="4" fill="#9b8769"/>`}).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><defs><linearGradient id="ground" x2="0" y2="1"><stop stop-color="#263b3b"/><stop offset="1" stop-color="#162728"/></linearGradient><style>.label{fill:#e2d7bd;font:11px system-ui;text-anchor:middle;paint-order:stroke;stroke:#101a1b;stroke-width:3px}.grid path{fill:none;stroke:#738784;stroke-width:1;opacity:.25}.roads polygon{fill:#65706d;opacity:.6}</style></defs><rect width="960" height="640" fill="#0d171a"/>${floor}<g class="grid">${grid.join('')}</g><g class="roads">${roads}</g>${structures}${trees}${furniture}<text x="24" y="618" fill="#9eaaa4" font-family="system-ui" font-size="13">Original schematic placeholder · ${projection.name}</text></svg>`;
 await mkdir(path.join(root,'views'),{recursive:true});await writeFile(path.join(root,'views',`view-${id}.svg`),svg);
 const occluders=environment.landmarks.filter(l=>['church','tower','monument'].includes(l.id)).map(l=>`<polygon points="${points(rectangle(l.x,l.y,l.width,l.height,projection.kind==='top'?0:l.type==='tower'?14:l.type==='building'?8:3))}" fill="#11191b" opacity=".55"/>`).join('');
 await mkdir(path.join(root,'occlusion'),{recursive:true});await writeFile(path.join(root,'occlusion',`view-${id}.svg`),`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">${occluders}</svg>`);
}
console.log('Generated five projected grid backgrounds with elevated landmark geometry.');
