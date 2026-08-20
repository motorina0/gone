/* global console, process */
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const SOURCE_BOUNDS = {
  west: 23.5838,
  east: 23.5933,
  south: 46.7821,
  north: 46.7863,
};
const OUTPUT = path.resolve('data/cluj-napoca-station/osm-source.json');

const input = process.argv[2];
const retrievedAt = process.argv[3];
if (!input || !retrievedAt) {
  throw new Error(
    'Usage: node tools/import-cluj-station-osm.mjs <map.osm> <retrieval-date-YYYY-MM-DD>',
  );
}

const xml = await readFile(path.resolve(input), 'utf8');

const decodeXml = (value) =>
  value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));

const attributes = (source) =>
  Object.fromEntries(
    [...source.matchAll(/([^\s=]+)="([^"]*)"/g)].map((match) => [
      match[1],
      decodeXml(match[2]),
    ]),
  );

const tags = (body = '') =>
  Object.fromEntries(
    [...body.matchAll(/<tag\s+([^>]*)\/>/g)]
      .map((match) => attributes(match[1]))
      .map((tag) => [tag.k, tag.v])
      .filter(([key, value]) => key && value)
      .sort(([left], [right]) => left.localeCompare(right)),
  );

const nodes = new Map();
const taggedNodes = [];
const nodePattern = /<node\b([^>]*)\/>|<node\b([^>]*)>([\s\S]*?)<\/node>/g;
for (const match of xml.matchAll(nodePattern)) {
  const data = attributes(match[1] ?? match[2]);
  const coordinate = [Number(data.lon), Number(data.lat)];
  nodes.set(data.id, coordinate);
  const nodeTags = tags(match[3]);
  if (Object.keys(nodeTags).length) taggedNodes.push({id: data.id, coordinate, tags: nodeTags});
}

const inside = ([longitude, latitude]) =>
  longitude >= SOURCE_BOUNDS.west &&
  longitude <= SOURCE_BOUNDS.east &&
  latitude >= SOURCE_BOUNDS.south &&
  latitude <= SOURCE_BOUNDS.north;

const relevantNode = (data) =>
  inside(data.coordinate) &&
  (data.tags.public_transport !== undefined ||
    data.tags.railway !== undefined ||
    data.tags.highway === 'bus_stop' ||
    data.tags.natural === 'tree' ||
    data.tags.entrance !== undefined ||
    ['bench', 'waste_basket', 'shelter', 'bicycle_parking'].includes(data.tags.amenity) ||
    ['gate', 'lift_gate'].includes(data.tags.barrier));

const clipSegment = (start, end) => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  let minimum = 0;
  let maximum = 1;
  for (const [p, q] of [
    [-dx, start[0] - SOURCE_BOUNDS.west],
    [dx, SOURCE_BOUNDS.east - start[0]],
    [-dy, start[1] - SOURCE_BOUNDS.south],
    [dy, SOURCE_BOUNDS.north - start[1]],
  ]) {
    if (p === 0 && q < 0) return undefined;
    if (p === 0) continue;
    const amount = q / p;
    if (p < 0) minimum = Math.max(minimum, amount);
    else maximum = Math.min(maximum, amount);
    if (minimum > maximum) return undefined;
  }
  return [
    [start[0] + dx * minimum, start[1] + dy * minimum],
    [start[0] + dx * maximum, start[1] + dy * maximum],
  ];
};

const sameCoordinate = (left, right) =>
  Math.abs(left[0] - right[0]) < 1e-10 && Math.abs(left[1] - right[1]) < 1e-10;

const clipLine = (coordinates) => {
  const chunks = [];
  let current = [];
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const segment = clipSegment(coordinates[index], coordinates[index + 1]);
    if (!segment) {
      if (current.length > 1) chunks.push(current);
      current = [];
      continue;
    }
    if (!current.length || !sameCoordinate(current.at(-1), segment[0])) {
      if (current.length > 1) chunks.push(current);
      current = [segment[0]];
    }
    current.push(segment[1]);
  }
  if (current.length > 1) chunks.push(current);
  return chunks;
};

const clipPolygonEdge = (coordinates, isInside, intersection) => {
  const result = [];
  for (let index = 0; index < coordinates.length; index += 1) {
    const current = coordinates[index];
    const previous = coordinates[(index + coordinates.length - 1) % coordinates.length];
    const currentInside = isInside(current);
    const previousInside = isInside(previous);
    if (currentInside) {
      if (!previousInside) result.push(intersection(previous, current));
      result.push(current);
    } else if (previousInside) result.push(intersection(previous, current));
  }
  return result;
};

const clipPolygon = (coordinates) => {
  let clipped = coordinates.slice(0, -1);
  const verticalIntersection = (longitude) => (start, end) => {
    const amount = (longitude - start[0]) / (end[0] - start[0]);
    return [longitude, start[1] + (end[1] - start[1]) * amount];
  };
  const horizontalIntersection = (latitude) => (start, end) => {
    const amount = (latitude - start[1]) / (end[1] - start[1]);
    return [start[0] + (end[0] - start[0]) * amount, latitude];
  };
  clipped = clipPolygonEdge(
    clipped,
    ([longitude]) => longitude >= SOURCE_BOUNDS.west,
    verticalIntersection(SOURCE_BOUNDS.west),
  );
  clipped = clipPolygonEdge(
    clipped,
    ([longitude]) => longitude <= SOURCE_BOUNDS.east,
    verticalIntersection(SOURCE_BOUNDS.east),
  );
  clipped = clipPolygonEdge(
    clipped,
    ([, latitude]) => latitude >= SOURCE_BOUNDS.south,
    horizontalIntersection(SOURCE_BOUNDS.south),
  );
  clipped = clipPolygonEdge(
    clipped,
    ([, latitude]) => latitude <= SOURCE_BOUNDS.north,
    horizontalIntersection(SOURCE_BOUNDS.north),
  );
  return clipped.length >= 3 ? [...clipped, clipped[0]] : [];
};

const relevantWay = (wayTags) =>
  wayTags.building !== undefined ||
  wayTags.railway !== undefined ||
  wayTags.highway !== undefined ||
  wayTags.public_transport !== undefined ||
  wayTags.landuse !== undefined ||
  wayTags.natural !== undefined ||
  wayTags.leisure !== undefined ||
  wayTags.barrier !== undefined ||
  ['parking', 'taxi'].includes(wayTags.amenity);

const areaWay = (wayTags, coordinates) =>
  sameCoordinate(coordinates[0], coordinates.at(-1)) &&
  (wayTags.area === 'yes' ||
    wayTags.building !== undefined ||
    wayTags.landuse !== undefined ||
    wayTags.natural !== undefined ||
    wayTags.leisure !== undefined ||
    ['platform'].includes(wayTags.railway) ||
    ['platform'].includes(wayTags.public_transport) ||
    ['parking', 'taxi'].includes(wayTags.amenity));

const features = taggedNodes.filter(relevantNode).map((node) => ({
  id: `node/${node.id}`,
  geometry: {type: 'Point', coordinates: node.coordinate},
  tags: node.tags,
}));

for (const match of xml.matchAll(/<way\b([^>]*)>([\s\S]*?)<\/way>/g)) {
  const data = attributes(match[1]);
  const body = match[2];
  const wayTags = tags(body);
  if (!relevantWay(wayTags)) continue;
  const coordinates = [...body.matchAll(/<nd\s+ref="([^"]+)"\s*\/>/g)]
    .map((reference) => nodes.get(reference[1]))
    .filter(Boolean);
  if (coordinates.length < 2) continue;
  if (areaWay(wayTags, coordinates)) {
    const polygon = clipPolygon(coordinates);
    if (polygon.length) {
      features.push({
        id: `way/${data.id}`,
        geometry: {type: 'Polygon', coordinates: [polygon]},
        tags: wayTags,
      });
    }
    continue;
  }
  clipLine(coordinates).forEach((line, index, chunks) => {
    features.push({
      id: `way/${data.id}${chunks.length > 1 ? `#${index + 1}` : ''}`,
      geometry: {type: 'LineString', coordinates: line},
      tags: wayTags,
    });
  });
}

const roundedCoordinates = (coordinates) =>
  typeof coordinates[0] === 'number'
    ? coordinates.map((value) => Number(value.toFixed(7)))
    : coordinates.map(roundedCoordinates);

const source = {
  schemaVersion: '1.0.0',
  id: 'cluj-napoca-station-osm-source',
  retrievedAt,
  endpoint: `https://api.openstreetmap.org/api/0.6/map?bbox=${SOURCE_BOUNDS.west},${SOURCE_BOUNDS.south},${SOURCE_BOUNDS.east},${SOURCE_BOUNDS.north}`,
  requestBounds: SOURCE_BOUNDS,
  sourceSha256: createHash('sha256').update(xml).digest('hex'),
  attribution: '© OpenStreetMap contributors',
  licence: 'Open Data Commons Open Database License 1.0 (ODbL-1.0)',
  licenceUrl: 'https://www.openstreetmap.org/copyright',
  transformations: [
    'Selected buildings, rail, tram, road, footway, barrier, land-use, transport, and furniture features.',
    'Clipped geometries to the documented station bounds.',
    'Rounded WGS84 coordinates to seven decimal places and sorted features deterministically.',
  ],
  features: features
    .map((feature) => ({
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: roundedCoordinates(feature.geometry.coordinates),
      },
    }))
    .sort((left, right) => left.id.localeCompare(right.id, 'en', {numeric: true})),
};

await mkdir(path.dirname(OUTPUT), {recursive: true});
await writeFile(OUTPUT, `${JSON.stringify(source, null, 2)}\n`);
console.log(`Imported ${source.features.length} clipped OSM features into ${OUTPUT}.`);
