import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

interface Point {
  x: number;
  y: number;
  elevation?: number;
}

interface Surface {
  id: string;
  type: 'road' | 'sidewalk' | 'plaza' | 'yard' | 'rail';
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

interface Landmark {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  elevation?: number;
  roof?: 'flat' | 'pitched' | 'glass' | 'open';
  material?: 'stone' | 'brick' | 'concrete' | 'metal' | 'glass';
  floors?: number;
  renderInDetailOverlay?: boolean;
  occludes?: boolean;
}

interface Prop extends Point {
  id?: string;
  type: string;
  rotation?: number;
  width?: number;
  depth?: number;
  height?: number;
  color?: string;
  blocksMovement?: boolean;
}

interface Environment {
  id: string;
  name: string;
  atmosphere?: {
    sky: string;
    horizon: string;
    ground: string;
    groundDark: string;
    wetness?: number;
  };
  surfaces: Surface[];
  landmarks: Landmark[];
  trees: Array<Point & {id?: string; size?: number}>;
  streetFurniture: Prop[];
}

interface Manifest {
  id: string;
  name: string;
  world: string;
  environment: string;
  projections: string[];
  views: string[];
  occlusion: string[];
  detailOverlays: string[];
}

interface Projection {
  id: string;
  name: string;
  kind: 'isometric' | 'top';
  matrix: number[];
  origin: Point;
  scale: number;
}

interface World {
  bounds: {minX: number; minY: number; maxX: number; maxY: number};
}

const contentRoot = path.resolve('public/content');
const index = JSON.parse(await readFile(path.join(contentRoot, 'index.json'), 'utf8')) as {
  locations: Array<{manifest: string}>;
};

const escapeXml = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const shade = (hex: string, amount: number): string => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const channel = (shift: number) =>
    Math.max(0, Math.min(255, ((value >> shift) & 255) + amount))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(16)}${channel(8)}${channel(0)}`;
};

const defaultHeight = (type: string): number =>
  ({
    building: 12,
    church: 18,
    tower: 28,
    station: 14,
    warehouse: 10,
    office: 8,
    utility: 6,
    bridge: 7,
    platform: 1.2,
    monument: 4,
    yard: 0,
  })[type] ?? 7;

for (const location of index.locations) {
  const manifestPath = path.join(contentRoot, location.manifest);
  const locationRoot = path.dirname(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest;
  const environment = JSON.parse(
    await readFile(path.join(locationRoot, manifest.environment), 'utf8'),
  ) as Environment;
  const world = JSON.parse(await readFile(path.join(locationRoot, manifest.world), 'utf8')) as World;
  const atmosphere = environment.atmosphere ?? {
    sky: '#263238',
    horizon: '#11191b',
    ground: '#56615d',
    groundDark: '#283330',
    wetness: 0,
  };

  for (let viewIndex = 0; viewIndex < manifest.projections.length; viewIndex += 1) {
    const projection = JSON.parse(
      await readFile(path.join(locationRoot, manifest.projections[viewIndex]!), 'utf8'),
    ) as Projection;
    const [a, b, c, d] = projection.matrix as [number, number, number, number];
    const top = projection.kind === 'top';
    const project = (point: Point): Point => ({
      x: projection.origin.x + (a * point.x + b * point.y) * projection.scale,
      y:
        projection.origin.y +
        (c * point.x + d * point.y - (point.elevation ?? 0)) * projection.scale,
    });
    const points = (items: Point[]): string =>
      items
        .map((point) => project(point))
        .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
        .join(' ');
    const rectangle = (x: number, y: number, width: number, height: number, elevation = 0) => [
      {x, y, elevation},
      {x: x + width, y, elevation},
      {x: x + width, y: y + height, elevation},
      {x, y: y + height, elevation},
    ];
    const rotatedRectangle = (
      x: number,
      y: number,
      width: number,
      depth: number,
      rotation: number,
      elevation = 0,
    ): Point[] => {
      const angle = (rotation * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return [
        [-width / 2, -depth / 2],
        [width / 2, -depth / 2],
        [width / 2, depth / 2],
        [-width / 2, depth / 2],
      ].map(([localX, localY]) => ({
        x: x + localX! * cos - localY! * sin,
        y: y + localX! * sin + localY! * cos,
        elevation,
      }));
    };

    const bounds = world.bounds;
    const ground = rectangle(
      bounds.minX,
      bounds.minY,
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
    );
    const surfaceSvg = environment.surfaces
      .map((surface) => {
        const shape = rectangle(surface.x, surface.y, surface.width, surface.height, 0.02);
        const fill =
          surface.color ??
          ({road: '#3f4948', sidewalk: '#767a70', plaza: '#898477', yard: '#46504d', rail: '#3a403e'}[
            surface.type
          ] as string);
        let detail = '';
        if (surface.type === 'road') {
          const horizontal = surface.width >= surface.height;
          const start = horizontal
            ? {x: surface.x + 5, y: surface.y + surface.height / 2}
            : {x: surface.x + surface.width / 2, y: surface.y + 5};
          const end = horizontal
            ? {x: surface.x + surface.width - 5, y: surface.y + surface.height / 2}
            : {x: surface.x + surface.width / 2, y: surface.y + surface.height - 5};
          detail = `<polyline points="${points([start, end])}" fill="none" stroke="#d6c891" stroke-width="1.4" stroke-dasharray="10 10" opacity=".58"/>`;
        }
        if (surface.type === 'rail') {
          const horizontal = surface.width >= surface.height;
          const offsets = [-1.1, 1.1];
          detail = offsets
            .map((offset) => {
              const line = horizontal
                ? [
                    {x: surface.x, y: surface.y + surface.height / 2 + offset},
                    {x: surface.x + surface.width, y: surface.y + surface.height / 2 + offset},
                  ]
                : [
                    {x: surface.x + surface.width / 2 + offset, y: surface.y},
                    {x: surface.x + surface.width / 2 + offset, y: surface.y + surface.height},
                  ];
              return `<polyline points="${points(line)}" fill="none" stroke="#abb0a7" stroke-width="1.4"/>`;
            })
            .join('');
          const length = horizontal ? surface.width : surface.height;
          for (let offset = 2; offset < length; offset += 7) {
            const sleeper = horizontal
              ? rectangle(surface.x + offset, surface.y, 1, surface.height, 0.03)
              : rectangle(surface.x, surface.y + offset, surface.width, 1, 0.03);
            detail += `<polygon points="${points(sleeper)}" fill="#252a28" opacity=".8"/>`;
          }
        }
        const texture =
          surface.type === 'sidewalk' || surface.type === 'plaza'
            ? 'url(#pavers)'
            : surface.type === 'yard'
              ? 'url(#yard)'
              : fill;
        return `<g data-surface="${escapeXml(surface.id)}"><polygon points="${points(shape)}" fill="${texture}" stroke="${shade(fill, 24)}" stroke-width="1"/>${detail}</g>`;
      })
      .join('');

    const landmarkOrder = [...environment.landmarks].sort((left, right) => {
      const leftPoint = project({x: left.x + left.width / 2, y: left.y + left.height / 2});
      const rightPoint = project({x: right.x + right.width / 2, y: right.y + right.height / 2});
      return leftPoint.y - rightPoint.y;
    });
    const highlights: string[] = [];
    const buildingSvg = landmarkOrder
      .map((landmark) => {
        if (landmark.renderInDetailOverlay) return '';
        const elevation = top ? 0 : (landmark.elevation ?? defaultHeight(landmark.type));
        const base = rectangle(landmark.x, landmark.y, landmark.width, landmark.height);
        const roof = rectangle(
          landmark.x,
          landmark.y,
          landmark.width,
          landmark.height,
          elevation,
        );
        const shadow = base.map((point) => ({x: point.x + 4, y: point.y + 5}));
        const material = landmark.material ?? 'stone';
        const wallFill = `url(#${material === 'glass' ? 'glass' : material})`;
        const walls = elevation
          ? [0, 1, 2, 3]
              .map(
                (side) =>
                  `<polygon points="${points([base[side]!, base[(side + 1) % 4]!, roof[(side + 1) % 4]!, roof[side]!])}" fill="${wallFill}" stroke="#333b37" stroke-width=".9"/>`,
              )
              .join('')
          : '';
        const roofStyle = landmark.roof ?? (landmark.type === 'building' ? 'pitched' : 'flat');
        const apex = {
          x: landmark.x + landmark.width / 2,
          y: landmark.y + landmark.height / 2,
          elevation: elevation + Math.min(5, Math.max(2, landmark.width * 0.1)),
        };
        const roofSvg =
          roofStyle === 'pitched' && !top
            ? `<polygon points="${points([roof[0]!, roof[1]!, apex, roof[3]!])}" fill="url(#roofTile)" stroke="#3b403a"/><polygon points="${points([roof[1]!, roof[2]!, roof[3]!, apex])}" fill="url(#roofTileDark)" stroke="#3b403a"/>`
            : `<polygon points="${points(roof)}" fill="${roofStyle === 'glass' ? 'url(#glass)' : landmark.color}" stroke="${shade(landmark.color, 30)}" stroke-width="1.2"/>`;
        let facade = '';
        if (elevation >= 5 && !top) {
          const floors = landmark.floors ?? Math.max(1, Math.round(elevation / 4));
          for (let floor = 1; floor <= floors; floor += 1) {
            const z = (elevation * floor) / (floors + 1);
            for (const side of [1, 2]) {
              const from = project({...base[side]!, elevation: z});
              const to = project({...base[(side + 1) % 4]!, elevation: z});
              facade += `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}" stroke="#d2c79e" stroke-width="2.5" stroke-dasharray="5 5" opacity=".55"/>`;
              highlights.push(
                `<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${to.x.toFixed(1)}" y2="${to.y.toFixed(1)}" stroke="#dfb96f" stroke-width="2" stroke-dasharray="4 7" opacity=".28"/>`,
              );
            }
          }
        }
        return `<g data-landmark="${escapeXml(landmark.id)}"><polygon points="${points(shadow)}" fill="#070b09" opacity=".34"/>${walls}${roofSvg}${facade}</g>`;
      })
      .join('');

    const treeSvg = environment.trees
      .map((tree, index) => {
        const size = tree.size ?? 1;
        const base = project(tree);
        const crown = project({...tree, elevation: top ? 0 : 5 * size});
        const id = tree.id ?? `tree-${index + 1}`;
        return `<g data-tree="${escapeXml(id)}"><ellipse cx="${(base.x + 7).toFixed(1)}" cy="${(base.y + 5).toFixed(1)}" rx="${(10 * size).toFixed(1)}" ry="${(4 * size).toFixed(1)}" fill="#07100a" opacity=".32"/><line x1="${base.x.toFixed(1)}" y1="${base.y.toFixed(1)}" x2="${crown.x.toFixed(1)}" y2="${crown.y.toFixed(1)}" stroke="#353129" stroke-width="${(3.5 * size).toFixed(1)}"/><circle cx="${(crown.x - 4 * size).toFixed(1)}" cy="${crown.y.toFixed(1)}" r="${(7 * size).toFixed(1)}" fill="#354c3b" stroke="#63755d"/><circle cx="${(crown.x + 4 * size).toFixed(1)}" cy="${(crown.y + 1).toFixed(1)}" r="${(7.5 * size).toFixed(1)}" fill="#405a45"/><circle cx="${crown.x.toFixed(1)}" cy="${(crown.y - 5 * size).toFixed(1)}" r="${(8 * size).toFixed(1)}" fill="#4a634a"/></g>`;
      })
      .join('');

    const propSvg = environment.streetFurniture
      .map((prop, index) => {
        const id = prop.id ?? `${prop.type}-${index + 1}`;
        const rotation = prop.rotation ?? 0;
        if (prop.type === 'car' || prop.type === 'maintenance-vehicle') {
          const width = prop.width ?? 4.6;
          const depth = prop.depth ?? 2;
          const elevation = top ? 0 : (prop.height ?? 1.4);
          const base = rotatedRectangle(prop.x, prop.y, width, depth, rotation);
          const roof = rotatedRectangle(prop.x, prop.y, width, depth, rotation, elevation);
          const cabin = rotatedRectangle(
            prop.x,
            prop.y,
            width * 0.48,
            depth * 0.82,
            rotation,
            elevation + (top ? 0 : 0.15),
          );
          const color = prop.color ?? (prop.type === 'maintenance-vehicle' ? '#c99b36' : '#58696b');
          const walls = top
            ? ''
            : [0, 1, 2, 3]
                .map(
                  (side) =>
                    `<polygon points="${points([base[side]!, base[(side + 1) % 4]!, roof[(side + 1) % 4]!, roof[side]!])}" fill="${shade(color, side % 2 ? -20 : -8)}"/>`,
                )
                .join('');
          return `<g data-prop="${escapeXml(id)}"><polygon points="${points(base.map((point) => ({x: point.x + 1, y: point.y + 1.4})))}" fill="#050806" opacity=".38"/>${walls}<polygon points="${points(roof)}" fill="${color}" stroke="${shade(color, 40)}" stroke-width=".7"/><polygon points="${points(cabin)}" fill="#8ea5a4" stroke="#d2d4c8" stroke-width=".6"/><polyline points="${points([roof[0]!, roof[1]!])}" stroke="#efe1b0" stroke-width="1.2"/></g>`;
        }
        if (['regional-train', 'freight-wagon'].includes(prop.type)) {
          const width = prop.width ?? 34;
          const depth = prop.depth ?? 4;
          const elevation = top ? 0 : (prop.height ?? 3.6);
          const base = rotatedRectangle(prop.x, prop.y, width, depth, rotation);
          const roof = rotatedRectangle(prop.x, prop.y, width, depth, rotation, elevation);
          const color = prop.color ?? (prop.type === 'regional-train' ? '#4e7482' : '#765047');
          const walls = top
            ? ''
            : [0, 1, 2, 3]
                .map(
                  (side) =>
                    `<polygon points="${points([base[side]!, base[(side + 1) % 4]!, roof[(side + 1) % 4]!, roof[side]!])}" fill="${shade(color, side % 2 ? -24 : -10)}" stroke="#343b39"/>`,
                )
                .join('');
          return `<g data-prop="${escapeXml(id)}">${walls}<polygon points="${points(roof)}" fill="${color}" stroke="#bdc6bd"/><polyline points="${points([roof[0]!, roof[1]!])}" stroke="#d9c785" stroke-width="2" stroke-dasharray="5 5"/></g>`;
        }
        const point = project(prop);
        if (prop.type === 'bench') {
          return `<g data-prop="${escapeXml(id)}"><rect x="${(point.x - 8).toFixed(1)}" y="${(point.y - 2).toFixed(1)}" width="16" height="4" rx="1" fill="#8d704b" stroke="#c4a56f"/><path d="M${(point.x - 6).toFixed(1)} ${point.y.toFixed(1)}v5m12-5v5" stroke="#282d28" stroke-width="2"/></g>`;
        }
        return `<circle data-prop="${escapeXml(id)}" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3" fill="#a28b57"/>`;
      })
      .join('');

    const wetness = atmosphere.wetness ?? 0;
    const puddles = wetness
      ? environment.surfaces
          .filter((surface) => surface.type === 'road' || surface.type === 'plaza')
          .flatMap((surface, index) =>
            [0.23, 0.61].map((fraction, offset) => {
              const center = project({
                x: surface.x + surface.width * fraction,
                y: surface.y + surface.height * (offset ? 0.7 : 0.3),
              });
              return `<ellipse cx="${center.x.toFixed(1)}" cy="${center.y.toFixed(1)}" rx="${10 + index}" ry="2.4" fill="#b9d0cf" opacity="${(wetness * 0.14).toFixed(2)}"/>`;
            }),
          )
          .join('')
      : '';

    const defs = `<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${atmosphere.sky}"/><stop offset="1" stop-color="${atmosphere.horizon}"/></linearGradient><linearGradient id="ground" x2="0" y2="1"><stop stop-color="${atmosphere.ground}"/><stop offset="1" stop-color="${atmosphere.groundDark}"/></linearGradient><linearGradient id="stone"><stop stop-color="#aaa598"/><stop offset="1" stop-color="#777a70"/></linearGradient><linearGradient id="concrete"><stop stop-color="#a2a69e"/><stop offset="1" stop-color="#666f6c"/></linearGradient><linearGradient id="metal"><stop stop-color="#758183"/><stop offset="1" stop-color="#465153"/></linearGradient><linearGradient id="glass" x2="1" y2="1"><stop stop-color="#9bb5b6"/><stop offset=".5" stop-color="#49636a"/><stop offset="1" stop-color="#c5d0c9"/></linearGradient><pattern id="brick" width="12" height="7" patternUnits="userSpaceOnUse"><rect width="12" height="7" fill="#744b43"/><path d="M0 3.5h12M6 0v3.5M0 3.5v3.5" stroke="#9a6e61" stroke-width=".7"/></pattern><pattern id="roofTile" width="9" height="6" patternUnits="userSpaceOnUse"><rect width="9" height="6" fill="#685a50"/><path d="M0 3h9M4.5 0v3" stroke="#8b7668" stroke-width=".7"/></pattern><pattern id="roofTileDark" width="9" height="6" patternUnits="userSpaceOnUse"><rect width="9" height="6" fill="#4e4a45"/><path d="M0 3h9M4.5 0v3" stroke="#6d665e" stroke-width=".7"/></pattern><pattern id="pavers" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#777a70"/><path d="M0 4h8M4 0v4M0 4v4" stroke="#94978b" stroke-width=".55"/></pattern><pattern id="yard" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#414b48"/><path d="M-2 10L10-2M3 12L12 3" stroke="#6c7772" stroke-width="1" opacity=".4"/></pattern><pattern id="district" width="100" height="74" patternUnits="userSpaceOnUse"><rect width="100" height="74" fill="#18211f"/><rect x="6" y="7" width="38" height="25" fill="#2b3633" stroke="#46514d"/><rect x="53" y="13" width="40" height="18" fill="#25302e" stroke="#424d49"/><path d="M0 42h100M48 0v74" stroke="#65706c" stroke-width="5" opacity=".22"/></pattern><filter id="grain"><feTurbulence baseFrequency=".35" numOctaves="3" seed="19" result="n"/><feColorMatrix in="n" values=".13 0 0 0 .6 0 .13 0 0 .58 0 0 .13 0 .55 0 0 0 .18 0"/><feBlend in="SourceGraphic" mode="multiply"/></filter></defs>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">${defs}<rect width="960" height="640" fill="url(#sky)"/><rect width="960" height="640" fill="url(#district)" opacity=".78"/><polygon points="${points(ground)}" fill="url(#ground)" stroke="#89948b" stroke-width="2" filter="url(#grain)"/>${surfaceSvg}${puddles}${buildingSvg}${treeSvg}${propSvg}<text x="22" y="620" fill="#d8d4bd" opacity=".54" font-family="ui-monospace,monospace" font-size="10" letter-spacing="2">${escapeXml(manifest.name.toUpperCase())} // ${escapeXml(projection.name.toUpperCase())}</text></svg>`;

    const viewPath = path.join(locationRoot, manifest.views[viewIndex]!);
    await mkdir(path.dirname(viewPath), {recursive: true});
    await writeFile(viewPath, svg);

    const occluders = environment.landmarks
      .filter(
        (landmark) =>
          landmark.occludes !== false && !['yard', 'platform', 'office'].includes(landmark.type),
      )
      .map((landmark) => {
        const elevation = top ? 0 : (landmark.elevation ?? defaultHeight(landmark.type));
        return `<polygon data-occluder="${escapeXml(landmark.id)}" points="${points(rectangle(landmark.x, landmark.y, landmark.width, landmark.height, elevation))}" fill="#080d0a" opacity=".58"/>`;
      })
      .join('');
    const treeOccluders = environment.trees
      .map((tree) => {
        const crown = project({...tree, elevation: top ? 0 : 5 * (tree.size ?? 1)});
        return `<circle cx="${crown.x.toFixed(1)}" cy="${crown.y.toFixed(1)}" r="${(7 * (tree.size ?? 1)).toFixed(1)}" fill="#101812" opacity=".42"/>`;
      })
      .join('');
    const occlusionPath = path.join(locationRoot, manifest.occlusion[viewIndex]!);
    await mkdir(path.dirname(occlusionPath), {recursive: true});
    await writeFile(
      occlusionPath,
      `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640">${occluders}${treeOccluders}</svg>`,
    );

    const detailResource = manifest.detailOverlays[viewIndex]!;
    if (detailResource.endsWith('.svg')) {
      const detailPath = path.join(locationRoot, detailResource);
      await mkdir(path.dirname(detailPath), {recursive: true});
      await writeFile(
        detailPath,
        `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640" viewBox="0 0 960 640"><g>${highlights.join('')}${puddles}</g></svg>`,
      );
    }
  }

  console.log(`Generated five detailed projected views for ${manifest.id}.`);
}
