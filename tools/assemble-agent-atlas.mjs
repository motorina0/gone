/* global console */
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve('.');
const source = path.join(root, 'art/agent/renders');
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

for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const input = path.join(source, `direction-${row}-frame-${column}.png`);
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
  await sharp(atlas).toFile(path.join(output, 'agent-atlas.png'));
}

for (let direction = 0; direction < rows; direction += 1) {
  const closeComposites = [];
  for (let frame = 0; frame < columns; frame += 1) {
    closeComposites.push({
      input: path.join(source, `direction-${direction}-frame-${frame}.png`),
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
    .webp({quality: 95, alphaQuality: 100, effort: 6, smartSubsample: true})
    .toBuffer();
  for (const location of locations) {
    const output = path.join(root, 'public/content/locations', location, 'sprites');
    await sharp(closeSheet).toFile(
      path.join(output, `agent-close-direction-${direction}.webp`),
    );
  }
}

console.log(
  `Assembled ${columns * rows} standard frames and ${rows} high-resolution close-up sheets.`,
);
