import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {Resvg} from '@resvg/resvg-js';
import sharp from 'sharp';

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
  sourceViews: string[];
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
              return `<polyline points="${points(line)}" fill="none" stroke="#777d78" stroke-width="1.05"/><polyline points="${points(line)}" fill="none" stroke="#c2c4b8" stroke-width=".25" opacity=".65"/>`;
            })
            .join('');
          const length = horizontal ? surface.width : surface.height;
          for (let offset = 2; offset < length; offset += 7) {
            const sleeper = horizontal
              ? rectangle(surface.x + offset, surface.y, 1, surface.height, 0.03)
              : rectangle(surface.x, surface.y + offset, surface.width, 1, 0.03);
            detail += `<polygon points="${points(sleeper)}" fill="#292724" opacity=".92"/>`;
          }
        }
        const texture =
          surface.type === 'sidewalk' || surface.type === 'plaza'
            ? 'url(#paversReal)'
            : surface.type === 'road' || surface.type === 'yard'
              ? 'url(#asphaltReal)'
              : surface.type === 'rail'
                ? 'url(#ballast)'
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
        const wallFill =
          material === 'glass' || material === 'metal'
            ? `url(#${material})`
            : 'url(#masonryReal)';
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
            ? `<polygon points="${points([roof[0]!, roof[1]!, apex, roof[3]!])}" fill="url(#roofReal)" stroke="#272a25"/><polygon points="${points([roof[1]!, roof[2]!, roof[3]!, apex])}" fill="url(#roofRealDark)" stroke="#272a25"/>`
            : `<polygon points="${points(roof)}" fill="${roofStyle === 'glass' ? 'url(#glass)' : 'url(#flatRoof)'}" stroke="${shade(landmark.color, 30)}" stroke-width="1.2"/>`;
        let facade = '';
        if (elevation >= 5 && !top) {
          const floors = landmark.floors ?? Math.max(1, Math.round(elevation / 4));
          for (let floor = 1; floor <= floors; floor += 1) {
            const z = (elevation * floor) / (floors + 1);
            for (const side of [1, 2]) {
              const start = base[side]!;
              const end = base[(side + 1) % 4]!;
              const edgeLength = Math.hypot(end.x - start.x, end.y - start.y);
              const columns = Math.max(2, Math.min(9, Math.floor(edgeLength / 7)));
              for (let column = 0; column < columns; column += 1) {
                const center = (column + 0.5) / columns;
                const half = Math.min(0.035, 0.28 / columns);
                const window = [
                  {x: start.x + (end.x - start.x) * (center - half), y: start.y + (end.y - start.y) * (center - half), elevation: z - 0.7},
                  {x: start.x + (end.x - start.x) * (center + half), y: start.y + (end.y - start.y) * (center + half), elevation: z - 0.7},
                  {x: start.x + (end.x - start.x) * (center + half), y: start.y + (end.y - start.y) * (center + half), elevation: z + 0.7},
                  {x: start.x + (end.x - start.x) * (center - half), y: start.y + (end.y - start.y) * (center - half), elevation: z + 0.7},
                ];
                facade += `<polygon points="${points(window)}" fill="url(#windowGlass)" stroke="#171c1b" stroke-width=".35"/>`;
                highlights.push(`<polygon points="${points(window)}" fill="#dfb96f" opacity=".18"/>`);
              }
            }
          }
        }
        let roofEquipment = '';
        if (elevation >= 6 && !top) {
          const equipmentCount = roofStyle === 'flat' ? Math.min(4, Math.max(1, Math.floor(landmark.width / 24))) : 1;
          for (let item = 0; item < equipmentCount; item += 1) {
            const fraction = (item + 1) / (equipmentCount + 1);
            const equipmentWidth = roofStyle === 'flat' ? 3.2 : 1.8;
            const equipmentDepth = roofStyle === 'flat' ? 2.6 : 1.8;
            const equipmentBase = rectangle(
              landmark.x + landmark.width * fraction - equipmentWidth / 2,
              landmark.y + landmark.height * (0.38 + (item % 2) * 0.24) - equipmentDepth / 2,
              equipmentWidth,
              equipmentDepth,
              elevation + 0.15,
            );
            const equipmentTop = equipmentBase.map((point) => ({
              ...point,
              elevation: (point.elevation ?? elevation) + (roofStyle === 'flat' ? 1.4 : 2.4),
            }));
            roofEquipment += [0, 1, 2, 3]
              .map(
                (side) =>
                  `<polygon points="${points([equipmentBase[side]!, equipmentBase[(side + 1) % 4]!, equipmentTop[(side + 1) % 4]!, equipmentTop[side]!])}" fill="#494b46" stroke="#272b28" stroke-width=".4"/>`,
              )
              .join('');
            roofEquipment += `<polygon points="${points(equipmentTop)}" fill="#77786d" stroke="#242926" stroke-width=".5"/>`;
          }
        }
        const roofInset = rectangle(
          landmark.x + Math.min(2, landmark.width * 0.08),
          landmark.y + Math.min(2, landmark.height * 0.08),
          landmark.width - Math.min(4, landmark.width * 0.16),
          landmark.height - Math.min(4, landmark.height * 0.16),
          elevation + 0.06,
        );
        const roofWeathering =
          roofStyle === 'flat'
            ? `<polygon points="${points(roofInset)}" fill="none" stroke="#282e2b" stroke-width=".65" opacity=".7"/>`
            : '';
        const roofPanels = ['platform', 'warehouse', 'station'].includes(landmark.type)
          ? [0.2, 0.4, 0.6, 0.8]
              .map((fraction) => {
                const line = [
                  {
                    x: landmark.x + landmark.width * fraction,
                    y: landmark.y + 1,
                    elevation: elevation + 0.08,
                  },
                  {
                    x: landmark.x + landmark.width * fraction,
                    y: landmark.y + landmark.height - 1,
                    elevation: elevation + 0.08,
                  },
                ];
                return `<polyline points="${points(line)}" fill="none" stroke="#c1c0ad" stroke-width=".42" opacity=".44"/>`;
              })
              .join('')
          : '';
        return `<g data-landmark="${escapeXml(landmark.id)}"><polygon points="${points(shadow)}" fill="#070b09" opacity=".42"/>${walls}${roofSvg}${roofWeathering}${roofPanels}${roofEquipment}${facade}</g>`;
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

    const materialRoot = '../../../materials';
    const defs = `<defs>
      <linearGradient id="sky" x2="0" y2="1"><stop stop-color="${atmosphere.sky}"/><stop offset="1" stop-color="${atmosphere.horizon}"/></linearGradient>
      <linearGradient id="metal"><stop stop-color="#758183"/><stop offset="1" stop-color="#384344"/></linearGradient>
      <linearGradient id="glass" x2="1" y2="1"><stop stop-color="#9bb5b6"/><stop offset=".5" stop-color="#314b52"/><stop offset="1" stop-color="#c5d0c9"/></linearGradient>
      <linearGradient id="windowGlass" x2="0" y2="1"><stop stop-color="#9eaaa4"/><stop offset=".42" stop-color="#303b3a"/><stop offset="1" stop-color="#171d1c"/></linearGradient>
      <linearGradient id="flatRoof" x2="0" y2="1"><stop stop-color="#77796f"/><stop offset="1" stop-color="#4b514d"/></linearGradient>
      <pattern id="asphaltReal" width="192" height="192" patternUnits="userSpaceOnUse"><image href="${materialRoot}/industrial-wet-asphalt.png" width="192" height="192" preserveAspectRatio="none"/></pattern>
      <pattern id="paversReal" width="150" height="150" patternUnits="userSpaceOnUse"><image href="${materialRoot}/old-town-pavers.png" width="150" height="150" preserveAspectRatio="none"/></pattern>
      <pattern id="masonryReal" width="180" height="180" patternUnits="userSpaceOnUse"><image href="${materialRoot}/weathered-masonry.png" width="180" height="180" preserveAspectRatio="none"/></pattern>
      <pattern id="roofReal" width="144" height="144" patternUnits="userSpaceOnUse"><image href="${materialRoot}/weathered-roof.png" width="144" height="144" preserveAspectRatio="none"/></pattern>
      <pattern id="roofRealDark" width="144" height="144" patternUnits="userSpaceOnUse"><rect width="144" height="144" fill="#1c1b19"/><image href="${materialRoot}/weathered-roof.png" width="144" height="144" preserveAspectRatio="none" opacity=".66"/></pattern>
      <pattern id="ballast" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#3b403d"/><circle cx="2" cy="3" r="1.6" fill="#77776d"/><circle cx="8" cy="7" r="2" fill="#5b5d56"/><circle cx="11" cy="1" r="1" fill="#8b887d"/></pattern>
      <radialGradient id="vignette"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#020604" stop-opacity=".55"/></radialGradient>
      <filter id="grain"><feTurbulence baseFrequency=".45" numOctaves="2" seed="19" result="n"/><feColorMatrix in="n" values=".08 0 0 0 .55 0 .08 0 0 .54 0 0 .08 0 .5 0 0 0 .13 0"/><feBlend in="SourceGraphic" mode="multiply"/></filter>
    </defs>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1280" viewBox="0 0 960 640">${defs}<rect width="960" height="640" fill="#1c2926"/><rect width="960" height="640" fill="url(#asphaltReal)" opacity=".72"/><rect width="960" height="640" fill="url(#sky)" opacity=".18"/><polygon points="${points(ground)}" fill="url(#asphaltReal)" opacity=".96" filter="url(#grain)"/>${surfaceSvg}${puddles}${buildingSvg}${treeSvg}${propSvg}<rect width="960" height="640" fill="url(#vignette)" pointer-events="none"/></svg>`;

    const sourceViewPath = path.join(locationRoot, manifest.sourceViews[viewIndex]!);
    await mkdir(path.dirname(sourceViewPath), {recursive: true});
    await writeFile(sourceViewPath, svg);
    const runtimeViewPath = path.join(locationRoot, manifest.views[viewIndex]!);
    const absoluteMaterialRoot = `${path.join(contentRoot, 'materials')}${path.sep}`;
    const renderableSvg = svg.replaceAll(`${materialRoot}/`, absoluteMaterialRoot);
    const renderedView = new Resvg(renderableSvg).render().asPng();
    await sharp(renderedView)
      .webp({quality: 86, smartSubsample: true})
      .toFile(runtimeViewPath);

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
