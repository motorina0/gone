"""Generate original, deterministic cathedral artwork for every projection."""
from pathlib import Path
import json, math, random, struct, zlib

SIZE, WIDTH, HEIGHT = 512, 960, 640
ROOT = Path("public/content/locations/piata-unirii")
OUT = ROOT / "textures"
OUT.mkdir(parents=True, exist_ok=True)

def write_png(path, pixels, width, height, channels):
    raw = b"".join(b"\0" + bytes(pixels[y*width*channels:(y+1)*width*channels]) for y in range(height))
    def chunk(kind, data):
        return struct.pack(">I", len(data))+kind+data+struct.pack(">I", zlib.crc32(kind+data)&0xffffffff)
    header = struct.pack(">IIBBBBB", width, height, 8, 6 if channels == 4 else 2, 0, 0, 0)
    path.write_bytes(b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR", header)+chunk(b"IDAT", zlib.compress(raw, 9))+chunk(b"IEND", b""))

def source_texture(name, roof=False):
    rng = random.Random(9921 if roof else 7319); pixels = bytearray(SIZE*SIZE*3)
    for y in range(SIZE):
        for x in range(SIZE):
            noise = rng.randrange(-8, 9)
            if roof:
                seam = (x+y//2)%38 < 2 or y%28 < 2
                color = (114+noise, 50+noise, 34+noise) if not seam else (66, 34, 28)
            else:
                mortar = y%42 < 3 or (x+(y//42%2)*30)%76 < 3
                color = (91, 88, 78) if mortar else (181+noise, 174+noise, 151+noise)
            i=(y*SIZE+x)*3; pixels[i:i+3]=bytes(max(0,min(255,v)) for v in color)
    write_png(OUT/name, pixels, SIZE, SIZE, 3)

source_texture("cathedral-wall.png")
source_texture("cathedral-roof.png", True)

def inside(x, y, polygon):
    hit=False; j=len(polygon)-1
    for i,(xi,yi) in enumerate(polygon):
        xj,yj=polygon[j]
        if (yi>y)!=(yj>y) and x < (xj-xi)*(y-yi)/(yj-yi)+xi: hit=not hit
        j=i
    return hit

def blend(canvas, x, y, color):
    if not (0<=x<WIDTH and 0<=y<HEIGHT): return
    i=(y*WIDTH+x)*4; alpha=color[3]/255
    canvas[i:i+4]=bytes((int(color[n]*alpha+canvas[i+n]*(1-alpha)) for n in range(3)))+bytes((max(canvas[i+3],color[3]),))

def polygon(canvas, shape, color):
    xs=[p[0] for p in shape]; ys=[p[1] for p in shape]
    for y in range(max(0,int(min(ys))),min(HEIGHT,int(max(ys))+1)):
        for x in range(max(0,int(min(xs))),min(WIDTH,int(max(xs))+1)):
            if inside(x+.5,y+.5,shape): blend(canvas,x,y,color)

def line(canvas, start, end, color, width=1):
    dx=end[0]-start[0]; dy=end[1]-start[1]; steps=max(1,int(math.hypot(dx,dy)*1.5))
    for step in range(steps+1):
        x=round(start[0]+dx*step/steps); y=round(start[1]+dy*step/steps)
        for ox in range(-width,width+1):
            for oy in range(-width,width+1): blend(canvas,x+ox,y+oy,color)

def circle(canvas, center, radius, color):
    for y in range(int(center[1]-radius),int(center[1]+radius)+1):
        for x in range(int(center[0]-radius),int(center[0]+radius)+1):
            if (x-center[0])**2+(y-center[1])**2 <= radius**2: blend(canvas,x,y,color)

environment=json.loads((ROOT/"environment.json").read_text())
church=next(item for item in environment["landmarks"] if item["id"]=="church")
tower=next(item for item in environment["landmarks"] if item["id"]=="tower")

for view in ("0","90","180","270","top"):
    projection=json.loads((ROOT/"projections"/f"view-{view}.json").read_text()); a,b,c,d=projection["matrix"]; scale=projection["scale"]; origin=projection["origin"]
    def project(x,y,z=0): return (origin["x"]+(a*x+b*y)*scale, origin["y"]+(c*x+d*y-z)*scale)
    canvas=bytearray(WIDTH*HEIGHT*4)
    x,y,w,h=church["x"],church["y"],church["width"],church["height"]
    # A long Gothic nave with a faceted eastern apse, transept and side aisles.
    footprint=[(x+3,y),(x+w-3,y),(x+w,y+4),(x+w,y+h-5),(x+w-3,y+h),(x+3,y+h),(x,y+h-5),(x,y+4)]
    if projection["kind"]=="top":
        roof=[project(px,py) for px,py in footprint]; polygon(canvas,roof,(147,62,40,255))
        ridge=[project(x+w/2,y+1),project(x+w/2,y+h-1)]; line(canvas,*ridge,(75,37,29,255),2)
        for yy in range(int(y+5),int(y+h-2),5): line(canvas,project(x+2,yy),project(x+w-2,yy),(102,44,33,180))
        tx,ty,tw,th=tower["x"],tower["y"],tower["width"],tower["height"]
        polygon(canvas,[project(tx,ty),project(tx+tw,ty),project(tx+tw,ty+th),project(tx,ty+th)],(196,188,164,255))
    else:
        wall_height=10
        base=[project(px,py) for px,py in footprint]; top=[project(px,py,wall_height) for px,py in footprint]
        for i in range(len(footprint)):
            face=[base[i],base[(i+1)%len(base)],top[(i+1)%len(top)],top[i]]
            polygon(canvas,face,(184 if i%2 else 205,178 if i%2 else 199,151 if i%2 else 174,255))
            line(canvas,face[0],face[3],(91,84,71,255),1)
        # Steep red tiled roof, much taller than the old flat prism.
        ridge_a=project(x+w/2,y+2,17); ridge_b=project(x+w/2,y+h-2,17)
        polygon(canvas,[top[0],top[1],ridge_a,ridge_b,top[-1]],(153,61,39,255))
        polygon(canvas,[top[1],top[2],top[3],top[4],ridge_b,ridge_a],(117,45,34,255))
        line(canvas,ridge_a,ridge_b,(72,36,28,255),2)
        # Rhythmic buttresses and tall lancet windows along both nave walls.
        for yy in range(int(y+5),int(y+h-3),6):
            for xx,side in ((x, -1),(x+w, 1)):
                foot=project(xx+side*1.5,yy); shoulder=project(xx,yy,8); line(canvas,foot,shoulder,(211,202,177,255),2)
                window=project(xx,yy+1,6); circle(canvas,window,2.2,(38,58,64,255)); line(canvas,window,project(xx,yy+1,9),(38,58,64,255),1)
        # Tall articulated limestone bell tower with setbacks, belfry and spire.
        tx,ty,tw,th=tower["x"],tower["y"],tower["width"],tower["height"]
        levels=[(0,0,tw,th,0,13),(1,1,tw-2,th-2,13,22),(2,2,tw-4,th-4,22,29)]
        for ox,oy,lw,lh,z0,z1 in levels:
            low=[project(tx+ox,ty+oy,z0),project(tx+ox+lw,ty+oy,z0),project(tx+ox+lw,ty+oy+lh,z0),project(tx+ox,ty+oy+lh,z0)]
            high=[project(tx+ox,ty+oy,z1),project(tx+ox+lw,ty+oy,z1),project(tx+ox+lw,ty+oy+lh,z1),project(tx+ox,ty+oy+lh,z1)]
            for i in range(4): polygon(canvas,[low[i],low[(i+1)%4],high[(i+1)%4],high[i]],(194-i*7,187-i*7,165-i*6,255))
            for i in range(4): line(canvas,high[i],high[(i+1)%4],(94,88,75,255),1)
        for z in (17,25):
            for xx,yy in ((tx+tw/2,ty),(tx+tw,ty+th/2),(tx+tw/2,ty+th),(tx,ty+th/2)):
                p=project(xx,yy,z); circle(canvas,p,2.5,(30,47,52,255)); line(canvas,p,project(xx,yy,z+4),(30,47,52,255),1)
        spire_base=[project(tx+2,ty+2,29),project(tx+tw-2,ty+2,29),project(tx+tw-2,ty+th-2,29),project(tx+2,ty+th-2,29)]
        apex=project(tx+tw/2,ty+th/2,43)
        for i in range(4): polygon(canvas,[spire_base[i],spire_base[(i+1)%4],apex],(70+i*5,45+i*3,39+i*2,255))
        line(canvas,apex,project(tx+tw/2,ty+th/2,46),(201,174,94,255),1)
    write_png(OUT/f"cathedral-{view}.png",canvas,WIDTH,HEIGHT,4)

print("Generated detailed Gothic cathedral walls, tiled roof, buttresses, tower and spire.")
