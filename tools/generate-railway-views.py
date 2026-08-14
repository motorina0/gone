#!/usr/bin/env python3
"""Generate consistent stylized-realistic orthographic station artwork from editable content."""
import json
from pathlib import Path
ROOT=Path('public/content/locations/vatra-central-station')
env=json.loads((ROOT/'environment.json').read_text())
world=json.loads((ROOT/'world.json').read_text()); bounds=world['bounds']; W=bounds['maxX']-bounds['minX']; H=bounds['maxY']-bounds['minY']
ids=['0','90','180','270','top']

def rect(x,y,w,h,z=0): return [(x,y,z),(x+w,y,z),(x+w,y+h,z),(x,y+h,z)]
for vid in ids:
 p=json.loads((ROOT/f'projections/view-{vid}.json').read_text()); a,b,c,d=p['matrix']; scale=p['scale']; ox,oy=p['origin']['x'],p['origin']['y']; top=vid=='top'
 def project(q):
  x,y,z=q if len(q)==3 else (*q,0)
  return ox+(a*x+b*y)*scale,oy+(c*x+d*y-z)*scale
 def pts(items): return ' '.join(f'{x:.1f},{y:.1f}' for x,y in map(project,items))
 ground=pts(rect(0,0,W,H))
 rails=''.join(f'<polyline points="{pts([(0,y,0),(W,y,0)])}"/>' for y in [102,114,126,194,206,218])
 sleepers=''.join(f'<polyline points="{pts([(x,96,0),(x,132,0)])}"/><polyline points="{pts([(x,188,0),(x,224,0)])}"/>' for x in range(0,int(W)+1,8))
 buildings=[]; occ=[]; details=[]
 height_by={'station':14,'tower':28,'warehouse':11,'office':8,'utility':6,'bridge':7,'platform':1.2,'building':12,'yard':0}
 for l in env['landmarks']:
  h=0 if top else height_by.get(l['type'],5); base=rect(l['x'],l['y'],l['width'],l['height']); roof=rect(l['x'],l['y'],l['width'],l['height'],h)
  if h:
   walls=''.join(f'<polygon points="{pts([base[i],base[(i+1)%4],roof[(i+1)%4],roof[i]])}" fill="url(#wall)" stroke="#454b49" stroke-width="1"/>' for i in range(4))
  else: walls=''
  roof_fill='url(#glass)' if l['type']=='bridge' else ('url(#brick)' if l['type']=='warehouse' else l['color'])

  architectural=''
  if l['type']=='station':
   windows=[]
   for fraction in [.12,.27,.42,.58,.73,.88]:
    wx,wy=project((l['x']+l['width']*fraction,l['y']+l['height']*.08,5 if not top else 0)); windows.append(f'<rect x="{wx-4:.1f}" y="{wy-6:.1f}" width="8" height="12" rx="1" fill="#d8aa63" stroke="#414846"/>')
   architectural=''.join(windows)
  elif l['type']=='office':
   # Roofless playable operations room: wet terrazzo, desks, consoles and access cabinet.
   floor=pts(rect(l['x']+2,l['y']+2,l['width']-4,l['height']-4,.15)); architectural=f'<polygon points="{floor}" fill="#62706e" stroke="#d4c7a5" stroke-width="2"/>'
   for fx,fy,color in [(.28,.3,'#273638'),(.65,.3,'#273638'),(.28,.7,'#7f684d'),(.72,.72,'#435b55')]:
    cx,cy=project((l['x']+l['width']*fx,l['y']+l['height']*fy,.3)); architectural+=f'<rect x="{cx-5:.1f}" y="{cy-3:.1f}" width="10" height="6" fill="{color}" stroke="#bac6c1"/>'
  elif l['type']=='warehouse':
   architectural=f'<path d="M {pts([(l["x"]+8,l["y"],1),(l["x"]+8,l["y"],8)])} M {pts([(l["x"]+24,l["y"],1),(l["x"]+24,l["y"],8)])}" stroke="#c69464" stroke-width="5"/>'
  buildings.append(f'<g data-landmark="{l["id"]}">{walls}<polygon points="{pts(roof)}" fill="{roof_fill}" stroke="#bac0b9" stroke-width="1.2"/>{architectural}</g>')
  if l['type'] not in ('yard','platform','office'): occ.append(f'<polygon points="{pts(roof)}" fill="#0a1012" opacity=".56"/>')
  if l['type'] in ('station','office','warehouse'):
   cx,cy=project((l['x']+l['width']*.25,l['y']+l['height']*.5,h+.2)); details.append(f'<rect x="{cx-5:.1f}" y="{cy-3:.1f}" width="10" height="6" fill="#e6b66d" opacity=".72"/>')
 trees=''.join(f'<g><line x1="{project((t["x"],t["y"],0))[0]:.1f}" y1="{project((t["x"],t["y"],0))[1]:.1f}" x2="{project((t["x"],t["y"],0 if top else 5))[0]:.1f}" y2="{project((t["x"],t["y"],0 if top else 5))[1]:.1f}" stroke="#313830" stroke-width="4"/><circle cx="{project((t["x"],t["y"],0 if top else 5))[0]:.1f}" cy="{project((t["x"],t["y"],0 if top else 5))[1]:.1f}" r="9" fill="#405346" stroke="#718070"/></g>' for t in env['trees'])
 props=[]
 for item in env['streetFurniture']:
  x,y=project((item['x'],item['y'],0)); typ=item['type']; w,h=(44,9) if typ in ('regional-train','freight-wagon') else ((18,10) if typ in ('car','maintenance-vehicle') else (14,4)); color='#4f7080' if typ=='regional-train' else '#75534b' if typ=='freight-wagon' else '#d2a437' if typ=='maintenance-vehicle' else '#59666b'; props.append(f'<rect x="{x-w/2:.1f}" y="{y-h/2:.1f}" width="{w}" height="{h}" rx="{min(4,h/2)}" fill="{color}" stroke="#c1c7c4"/>')
 svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#667579"/><stop offset="1" stop-color="#172326"/></linearGradient><linearGradient id="wet" x2="0" y2="1"><stop stop-color="#586565"/><stop offset=".55" stop-color="#313d3f"/><stop offset="1" stop-color="#202c2e"/></linearGradient><linearGradient id="wall"><stop stop-color="#aba89e"/><stop offset="1" stop-color="#6d7471"/></linearGradient><linearGradient id="glass" x2="1" y2="1"><stop stop-color="#8da8ad"/><stop offset=".5" stop-color="#3e5a61"/><stop offset="1" stop-color="#b6c5c3"/></linearGradient><pattern id="brick" width="12" height="7" patternUnits="userSpaceOnUse"><rect width="12" height="7" fill="#673d37"/><path d="M0 3.5h12M6 0v3.5M0 3.5v3.5" stroke="#8b6257" stroke-width=".7"/></pattern><filter id="glow"><feGaussianBlur stdDeviation="3"/></filter><filter id="stone"><feTurbulence baseFrequency=".45" numOctaves="3" seed="12" result="n"/><feColorMatrix in="n" values=".15 0 0 0 .75 0 .15 0 0 .72 0 0 .15 0 .66 0 0 0 .22 0"/><feBlend in="SourceGraphic" mode="multiply"/></filter><filter id="wetshine"><feGaussianBlur stdDeviation="1.2"/><feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer></filter><style>text{{font:600 10px system-ui;fill:#e8e3d5;text-anchor:middle;paint-order:stroke;stroke:#182225;stroke-width:3px}}.rails polyline{{fill:none;stroke:#aab1ad;stroke-width:2}}.sleepers polyline{{fill:none;stroke:#4a4a45;stroke-width:2;opacity:.75}}</style></defs><rect width="960" height="640" fill="url(#sky)"/><polygon points="{ground}" fill="url(#wet)" filter="url(#stone)" stroke="#8c9996" stroke-width="2"/><g opacity=".22" stroke="#c5d3d0">{''.join(f'<polyline points="{pts([(x,0,0),(x,H,0)])}"/>' for x in range(0,int(W)+1,20))}</g><g class="sleepers">{sleepers}</g><g class="rails">{rails}</g>{''.join(buildings)}{trees}{''.join(props)}<g opacity=".18" fill="#d9b978">{''.join(f'<ellipse cx="{project((x,H*.82,0))[0]:.1f}" cy="{project((x,H*.82,0))[1]:.1f}" rx="18" ry="3"/>' for x in range(40,int(W)-20,70))}</g><text x="24" y="620" text-anchor="start">VATRA CENTRAL · AFTER RAIN · {p['name'].upper()}</text></svg>'''
 (ROOT/'views').mkdir(exist_ok=True); (ROOT/f'views/view-{vid}.svg').write_text(svg)
 (ROOT/'occlusion').mkdir(exist_ok=True); (ROOT/f'occlusion/view-{vid}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">{"".join(occ)}</svg>')
 (ROOT/'details').mkdir(exist_ok=True); (ROOT/f'details/view-{vid}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><g filter="url(#g)"><defs><filter id="g"><feGaussianBlur stdDeviation="1.5"/></filter></defs>{"".join(details)}</g></svg>')
print('Generated five consistent Vatra Central Station views, occlusion masks, and light overlays.')
