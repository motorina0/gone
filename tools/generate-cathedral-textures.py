"""Generate deterministic original raster textures for the schematic cathedral."""
from pathlib import Path
import random, struct, zlib

SIZE = 512
OUT = Path('public/content/locations/piata-unirii/textures')
OUT.mkdir(parents=True, exist_ok=True)

def png(path, pixels):
    raw = b''.join(b'\x00' + bytes(pixels[y*SIZE:(y+1)*SIZE]) for y in range(SIZE))
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    header = struct.pack('>IIBBBBB', SIZE, SIZE, 8, 2, 0, 0, 0)
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

def wall():
    rng=random.Random(7319); px=bytearray(SIZE*SIZE*3)
    for y in range(SIZE):
        row=y//48; offset=28 if row%2 else 0
        for x in range(SIZE):
            mortar=(y%48<3 or (x+offset)%82<3)
            noise=rng.randrange(-12,13); shade=int(150-y*.055)+noise
            color=(78,77,70) if mortar else (max(80,shade+12),max(78,shade+8),max(70,shade))
            i=(y*SIZE+x)*3;px[i:i+3]=bytes(color)
    # Gothic lancet windows with dark glass and stone trim.
    for cx in (128,256,384):
        for y in range(145,390):
            half=max(0,34-abs(y-220)//3) if y<220 else 34
            for x in range(cx-half,cx+half):
                if 0<=x<SIZE:
                    border=abs(x-cx)>=half-5 or y in range(385,390)
                    i=(y*SIZE+x)*3;px[i:i+3]=bytes((190,177,145) if border else (35,55,61))
    png(OUT/'cathedral-wall.png',px)

def roof():
    rng=random.Random(9921);px=bytearray(SIZE*SIZE*3)
    for y in range(SIZE):
        for x in range(SIZE):
            seam=(x+y//2)%38<2 or y%26<2; noise=rng.randrange(-10,11)
            base=(45+noise,79+noise,72+noise) if not seam else (27,48,45)
            # weathered copper highlights
            if (x*13+y*7)%191<7: base=(74,113,99)
            i=(y*SIZE+x)*3;px[i:i+3]=bytes(max(0,min(255,v)) for v in base)
    png(OUT/'cathedral-roof.png',px)

wall();roof();print('Generated original cathedral wall and roof textures.')

# Render texture-mapped transparent detail overlays because browser SVG image
# rasterization intentionally does not fetch nested external image resources.
import json, math

def rgba_png(path, pixels, width=960, height=640):
    raw=b''.join(b'\x00'+bytes(pixels[y*width*4:(y+1)*width*4]) for y in range(height))
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    header=struct.pack('>IIBBBBB',width,height,8,6,0,0,0)
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',header)+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))

def inside(px,py,poly):
    hit=False;j=len(poly)-1
    for i,(xi,yi) in enumerate(poly):
        xj,yj=poly[j]
        if (yi>py)!=(yj>py) and px<(xj-xi)*(py-yi)/(yj-yi)+xi:hit=not hit
        j=i
    return hit

def paint(canvas,poly,texture):
    xs=[p[0] for p in poly];ys=[p[1] for p in poly]
    for y in range(max(0,int(min(ys))),min(639,int(max(ys))+1)):
      for x in range(max(0,int(min(xs))),min(959,int(max(xs))+1)):
       if inside(x+.5,y+.5,poly):
        source=texture[((y%SIZE)*SIZE+(x%SIZE))*3:][:3];i=(y*960+x)*4;canvas[i:i+4]=bytes((*source,255))

def texture_pixels(seed, roof=False):
    rng=random.Random(seed);px=bytearray(SIZE*SIZE*3)
    for y in range(SIZE):
      for x in range(SIZE):
       if roof:
        seam=(x+y//2)%38<2 or y%26<2;noise=rng.randrange(-10,11);color=(45+noise,79+noise,72+noise) if not seam else (27,48,45)
        if (x*13+y*7)%191<7:color=(74,113,99)
       else:
        row=y//48;offset=28 if row%2 else 0;mortar=y%48<3 or (x+offset)%82<3;noise=rng.randrange(-12,13);shade=int(150-y*.055)+noise;color=(78,77,70) if mortar else (max(80,shade+12),max(78,shade+8),max(70,shade))
       i=(y*SIZE+x)*3;px[i:i+3]=bytes(max(0,min(255,v)) for v in color)
    return px

wall_pixels=texture_pixels(7319);roof_pixels=texture_pixels(9921,True)
for view in ('0','90','180','270','top'):
    projection=json.loads((OUT.parent/'projections'/f'view-{view}.json').read_text());a,b,c,d=projection['matrix'];scale=projection['scale'];origin=projection['origin']
    def project(x,y,z=0):return(origin['x']+(a*x+b*y)*scale,origin['y']+(c*x+d*y-z)*scale)
    canvas=bytearray(960*640*4)
    if projection['kind']=='isometric':
      for x,y,w,h,height,kind in ((48,24,25,38,8,'church'),(54,17,9,11,14,'tower')):
       base=[project(x,y),project(x+w,y),project(x+w,y+h),project(x,y+h)];top=[project(x,y,height),project(x+w,y,height),project(x+w,y+h,height),project(x,y+h,height)]
       for i in range(4):paint(canvas,[base[i],base[(i+1)%4],top[(i+1)%4],top[i]],wall_pixels)
       if kind=='church':
        peak=project(x+w/2,y+h/2,height+5);paint(canvas,[top[0],top[1],peak,top[3]],roof_pixels);paint(canvas,[top[1],top[2],top[3],peak],roof_pixels)
       else:paint(canvas,top,roof_pixels)
    else:
      paint(canvas,[project(48,24),project(73,24),project(73,62),project(48,62)],roof_pixels);paint(canvas,[project(54,17),project(63,17),project(63,28),project(54,28)],roof_pixels)
    rgba_png(OUT/f'cathedral-{view}.png',canvas)
print('Generated five transparent cathedral detail images.')
