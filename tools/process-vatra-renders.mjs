/* global console */
import {readdir} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve('.');
const source = path.join(root, 'art/vatra/renders');
const output = path.join(root, 'public/content/locations/vatra-central-station');
const depthFiles = await readdir(path.join(source, 'depth'));

for (const view of ['view-0', 'view-90', 'view-180', 'view-270', 'view-top']) {
  await sharp(path.join(source, `${view}.png`))
    .resize(1920, 1280, {fit: 'fill'})
    .webp({quality: 86, effort: 6, smartSubsample: true})
    .toFile(path.join(output, 'views', `${view}.webp`));

  await sharp(path.join(source, 'occlusion', `${view}.png`))
    .resize(1920, 1280, {fit: 'fill'})
    .webp({quality: 88, alphaQuality: 100, effort: 6, smartSubsample: true})
    .toFile(path.join(output, 'occlusion-3d', `${view}.webp`));

  const depth = depthFiles.find((file) => file.startsWith(`${view}-`));
  if (!depth) throw new Error(`Missing Blender depth output for ${view}`);
  await sharp(path.join(source, 'depth', depth))
    .resize(960, 640, {fit: 'fill'})
    .webp({lossless: true, effort: 6})
    .toFile(path.join(output, 'depth', `${view}.webp`));
}

console.log('Processed five Gone Vatra beauty renders and five aligned depth maps.');
