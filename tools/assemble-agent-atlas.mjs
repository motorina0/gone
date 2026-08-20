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
const composites = [];

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

for (const location of ['piata-unirii', 'vatra-central-station']) {
  const output = path.join(root, 'public/content/locations', location, 'sprites');
  await mkdir(output, {recursive: true});
  await sharp(atlas).toFile(path.join(output, 'agent-atlas.png'));
}

console.log(`Assembled ${columns * rows} Gone operative frames into a ${columns}x${rows} atlas.`);
