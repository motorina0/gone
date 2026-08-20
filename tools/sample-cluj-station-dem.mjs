/* global console, process */
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const BOUNDS = {west: 23.5838, east: 23.5933, south: 46.7821, north: 46.7863};
const TILE = {west: 23, east: 24, south: 46, north: 47};
const SOURCE_URL =
  'https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N46_00_E023_00_DEM/Copernicus_DSM_COG_10_N46_00_E023_00_DEM.tif';
const OUTPUT = path.resolve('data/cluj-napoca-station/terrain-source.json');

const input = process.argv[2];
const retrievedAt = process.argv[3];
if (!input || !retrievedAt) {
  throw new Error(
    'Usage: node tools/sample-cluj-station-dem.mjs <Copernicus-DEM.tif> <retrieval-date-YYYY-MM-DD>',
  );
}

const inputPath = path.resolve(input);
const metadata = await sharp(inputPath, {page: 0}).metadata();
if (metadata.width !== 3600 || metadata.height !== 3600 || metadata.depth !== 'float') {
  throw new Error(
    `Expected a 3600 × 3600 float Copernicus DGED tile, received ${metadata.width} × ${metadata.height} ${metadata.depth}.`,
  );
}

const longitudeToColumn = (longitude) => (longitude - TILE.west) * metadata.width;
const latitudeToRow = (latitude) => (TILE.north - latitude) * metadata.height;
const left = Math.floor(longitudeToColumn(BOUNDS.west)) - 2;
const right = Math.ceil(longitudeToColumn(BOUNDS.east)) + 2;
const top = Math.floor(latitudeToRow(BOUNDS.north)) - 2;
const bottom = Math.ceil(latitudeToRow(BOUNDS.south)) + 2;
const {data, info} = await sharp(inputPath, {page: 0})
  .extract({left, top, width: right - left + 1, height: bottom - top + 1})
  .raw({depth: 'float'})
  .toBuffer({resolveWithObject: true});
const values = new Float32Array(data.buffer, data.byteOffset, data.byteLength / 4);

const valueAt = (column, row) => {
  const x = Math.max(0, Math.min(info.width - 1, column - left));
  const y = Math.max(0, Math.min(info.height - 1, row - top));
  return values[(y * info.width + x) * info.channels];
};

const median = (numbers) => {
  const ordered = [...numbers].sort((leftValue, rightValue) => leftValue - rightValue);
  return ordered[Math.floor(ordered.length / 2)];
};

const linearSlope = (pairs) => {
  const centerX = pairs.reduce((sum, [x]) => sum + x, 0) / pairs.length;
  const centerY = pairs.reduce((sum, [, y]) => sum + y, 0) / pairs.length;
  const numerator = pairs.reduce((sum, [x, y]) => sum + (x - centerX) * (y - centerY), 0);
  const denominator = pairs.reduce((sum, [x]) => sum + (x - centerX) ** 2, 0);
  return denominator === 0 ? 0 : numerator / denominator;
};

const metresPerDegree = (latitude) => {
  const radians = (latitude * Math.PI) / 180;
  return {
    longitude:
      111412.84 * Math.cos(radians) -
      93.5 * Math.cos(3 * radians) +
      0.118 * Math.cos(5 * radians),
    latitude:
      111132.92 -
      559.82 * Math.cos(2 * radians) +
      1.175 * Math.cos(4 * radians) -
      0.0023 * Math.cos(6 * radians),
  };
};

const sampledElevation = (longitude, latitude) => {
  const column = Math.round(longitudeToColumn(longitude));
  const row = Math.round(latitudeToRow(latitude));
  const neighbourhood = [];
  for (let y = -1; y <= 1; y += 1) {
    for (let x = -1; x <= 1; x += 1) neighbourhood.push(valueAt(column + x, row + y));
  }
  return median(neighbourhood);
};

const columns = 7;
const rows = 5;
const samples = [];
for (let row = 0; row < rows; row += 1) {
  const latitude = BOUNDS.south + (BOUNDS.north - BOUNDS.south) * (row / (rows - 1));
  for (let column = 0; column < columns; column += 1) {
    const longitude =
      BOUNDS.west + (BOUNDS.east - BOUNDS.west) * (column / (columns - 1));
    samples.push({
      column,
      row,
      longitude: Number(longitude.toFixed(7)),
      latitude: Number(latitude.toFixed(7)),
      elevationMeters: Number(sampledElevation(longitude, latitude).toFixed(3)),
    });
  }
}

const anchor = {latitude: 46.784046304041595, longitude: 23.58642071485519};
const anchorSampleElevationMeters = Number(
  sampledElevation(anchor.longitude, anchor.latitude).toFixed(3),
);
const referenceElevationMeters = Number(
  median(samples.map((sample) => sample.elevationMeters)).toFixed(3),
);
const localScale = metresPerDegree(anchor.latitude);
const sampleOffset = (sample) => ({
  eastMeters: (sample.longitude - anchor.longitude) * localScale.longitude,
  northMeters: (sample.latitude - anchor.latitude) * localScale.latitude,
});
const columnMedians = Array.from({length: columns}, (_, column) => {
  const columnSamples = samples.filter((sample) => sample.column === column);
  const offset = sampleOffset(columnSamples[0]);
  return [offset.eastMeters, median(columnSamples.map((sample) => sample.elevationMeters))];
});
const rowMedians = Array.from({length: rows}, (_, row) => {
  const rowSamples = samples.filter((sample) => sample.row === row);
  const offset = sampleOffset(rowSamples[0]);
  return [offset.northMeters, median(rowSamples.map((sample) => sample.elevationMeters))];
});
const slopeEast = linearSlope(columnMedians);
const slopeNorth = linearSlope(rowMedians);
const anchorTerrainElevationMeters = median(
  samples.map((sample) => {
    const offset = sampleOffset(sample);
    return sample.elevationMeters - slopeEast * offset.eastMeters - slopeNorth * offset.northMeters;
  }),
);
const canonicalModel = {
  type: 'robust-planar-fit',
  anchorTerrainElevationMeters: Number(anchorTerrainElevationMeters.toFixed(3)),
  slopeEastMetersPerMeter: Number(slopeEast.toFixed(9)),
  slopeNorthMetersPerMeter: Number(slopeNorth.toFixed(9)),
  method:
    'Independent least-squares slopes through per-column and per-row medians, with a median residual intercept at the map anchor.',
};
const sourceBytes = await readFile(inputPath);
const terrain = {
  schemaVersion: '1.0.0',
  id: 'cluj-napoca-station-terrain-source',
  retrievedAt,
  sourceUrl: SOURCE_URL,
  sourceTile: 'Copernicus_DSM_COG_10_N46_00_E023_00_DEM',
  sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
  dataset: 'Copernicus DEM GLO-30 DGED, 30 metre Digital Surface Model',
  horizontalCrs: 'EPSG:4326 (WGS 84)',
  verticalCrs: 'EPSG:3855 (EGM2008 height)',
  geographicBounds: BOUNDS,
  grid: {columns, rows},
  anchor: {...anchor, anchorSampleElevationMeters},
  referenceElevationMeters,
  canonicalModel,
  samples,
  attribution:
    'produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved',
  licence: 'Copernicus WorldDEM-30 free licence',
  licenceUrl:
    'https://dataspace.copernicus.eu/sites/default/files/media/files/2025-06/copernicus_contributing_mission_data_access_v2_cop_dem_licenses.pdf',
  liabilityNotice:
    'The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30.',
  transformations: [
    'Selected the N46 E023 one-degree DGED tile.',
    'Sampled a deterministic 7 × 5 grid over the authored station bounds.',
    'Used the median of each nearest 3 × 3 source-pixel neighbourhood to reduce DSM building and vegetation spikes.',
    'Used the median of all 35 samples as the local gameplay datum because GLO-30 is a surface model and the anchor sample includes station infrastructure.',
    'Fitted a conservative canonical terrain plane from per-column and per-row sample medians so individual buildings and vegetation do not become gameplay slopes.',
    'Stored source elevations to three decimal places; gameplay terrain is relative to the fitted elevation at the map anchor.',
  ],
};

await mkdir(path.dirname(OUTPUT), {recursive: true});
await writeFile(OUTPUT, `${JSON.stringify(terrain, null, 2)}\n`);
console.log(
  `Sampled ${samples.length} Copernicus DEM points into ${OUTPUT}; anchor datum ${referenceElevationMeters} m.`,
);
