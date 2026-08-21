/* global console */
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve('.');
const source = path.join(root, 'art/agent/renders');
const realisticSource = path.join(root, 'art/agent/realistic-sheets');
const frameWidth = 128;
const frameHeight = 160;
const columns = 9;
const rows = 8;
const closeFrameWidth = 1024;
const closeFrameHeight = 1280;
const closeColumns = 3;
const closeRows = 3;
const composites = [];
const locations = ['piata-unirii', 'vatra-central-station', 'cluj-napoca-station'];

const alphaBounds = async (input) => {
  const {data, info} = await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  let left = info.width;
  let right = -1;
  let top = info.height;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha <= 8) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error('Agent frame contains no visible pixels.');
  return {left, right, top, bottom, width: right - left + 1, height: bottom - top + 1};
};

const keepLargestAlphaComponent = async (input) => {
  const {data, info} = await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const pixelCount = info.width * info.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let largest = [];
  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] || data[start * info.channels + 3] <= 8) continue;
    const component = [];
    let head = 0;
    let tail = 1;
    queue[0] = start;
    visited[start] = 1;
    while (head < tail) {
      const pixel = queue[head];
      head += 1;
      component.push(pixel);
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextX >= info.width || nextY < 0 || nextY >= info.height) {
            continue;
          }
          const next = nextY * info.width + nextX;
          if (visited[next] || data[next * info.channels + 3] <= 8) continue;
          visited[next] = 1;
          queue[tail] = next;
          tail += 1;
        }
      }
    }
    if (component.length > largest.length) largest = component;
  }
  if (largest.length === 0) throw new Error('Agent frame contains no connected silhouette.');
  const retained = new Uint8Array(pixelCount);
  for (const pixel of largest) retained[pixel] = 1;
  const cleaned = Buffer.from(data);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    if (!retained[pixel]) cleaned[pixel * info.channels + 3] = 0;
  }
  return sharp(cleaned, {
    raw: {width: info.width, height: info.height, channels: info.channels},
  })
    .png()
    .toBuffer();
};

const realisticFrames = [];
for (let direction = 0; direction < rows; direction += 1) {
  const sheetPath = path.join(realisticSource, `direction-${direction}.png`);
  const sheet = sharp(sheetPath);
  const metadata = await sheet.metadata();
  for (let frame = 0; frame < columns; frame += 1) {
    const sourceColumn = frame % closeColumns;
    const sourceRow = Math.floor(frame / closeColumns);
    const left = Math.round((sourceColumn * metadata.width) / closeColumns);
    const right = Math.round(((sourceColumn + 1) * metadata.width) / closeColumns);
    const top = Math.round((sourceRow * metadata.height) / closeRows);
    const bottom = Math.round(((sourceRow + 1) * metadata.height) / closeRows);
    const extractedCell = await sharp(sheetPath)
      .extract({left, top, width: right - left, height: bottom - top})
      .ensureAlpha()
      .png()
      .toBuffer();
    const cell = await keepLargestAlphaComponent(extractedCell);
    const generatedBounds = await alphaBounds(cell);
    const generatedCharacter = await sharp(cell)
      .extract({
        left: generatedBounds.left,
        top: generatedBounds.top,
        width: generatedBounds.width,
        height: generatedBounds.height,
      })
      .png()
      .toBuffer();
    const targetPath = path.join(source, `direction-${direction}-frame-${frame}.png`);
    const targetBounds = await alphaBounds(targetPath);
    const scale = Math.min(
      targetBounds.height / generatedBounds.height,
      (closeFrameWidth - 16) / generatedBounds.width,
    );
    const width = Math.round(generatedBounds.width * scale);
    const height = Math.round(generatedBounds.height * scale);
    const character = await sharp(generatedCharacter)
      .resize(width, height, {fit: 'fill', kernel: sharp.kernel.lanczos3})
      .png()
      .toBuffer();
    const targetCenter = (targetBounds.left + targetBounds.right) / 2;
    const frameLeft = Math.max(
      0,
      Math.min(closeFrameWidth - width, Math.round(targetCenter - width / 2)),
    );
    const frameTop = targetBounds.bottom - height + 1;
    const aligned = await sharp({
      create: {
        width: closeFrameWidth,
        height: closeFrameHeight,
        channels: 4,
        background: {r: 0, g: 0, b: 0, alpha: 0},
      },
    })
      .composite([{input: character, left: frameLeft, top: frameTop}])
      .png()
      .toBuffer();
    realisticFrames.push(aligned);
  }
}

for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const input = realisticFrames[row * columns + column];
    const buffer = await sharp(input)
      .resize(frameWidth, frameHeight, {fit: 'fill'})
      .png({compressionLevel: 9})
      .toBuffer();
    composites.push({input: buffer, left: column * frameWidth, top: row * frameHeight});
  }
}

const atlas = await sharp({
  create: {
    width: columns * frameWidth,
    height: rows * frameHeight,
    channels: 4,
    background: {r: 0, g: 0, b: 0, alpha: 0},
  },
})
  .composite(composites)
  .png({compressionLevel: 9})
  .toBuffer();

for (const location of locations) {
  const output = path.join(root, 'public/content/locations', location, 'sprites');
  await mkdir(output, {recursive: true});
  await writeFile(path.join(output, 'agent-atlas.png'), atlas);
}

for (let direction = 0; direction < rows; direction += 1) {
  const closeComposites = [];
  for (let frame = 0; frame < columns; frame += 1) {
    closeComposites.push({
      input: realisticFrames[direction * columns + frame],
      left: (frame % closeColumns) * closeFrameWidth,
      top: Math.floor(frame / closeColumns) * closeFrameHeight,
    });
  }
  const closeSheet = await sharp({
    create: {
      width: closeColumns * closeFrameWidth,
      height: closeRows * closeFrameHeight,
      channels: 4,
      background: {r: 0, g: 0, b: 0, alpha: 0},
    },
  })
    .composite(closeComposites)
    .webp({quality: 80, alphaQuality: 100, effort: 6, smartSubsample: true})
    .toBuffer();
  for (const location of locations) {
    const output = path.join(root, 'public/content/locations', location, 'sprites');
    await writeFile(path.join(output, `agent-close-direction-${direction}.webp`), closeSheet);
  }
}

console.log(
  `Assembled ${columns * rows} standard frames and ${rows} high-resolution close-up sheets.`,
);
