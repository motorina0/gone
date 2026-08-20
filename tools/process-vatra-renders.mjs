/* global console */
import {Buffer} from 'node:buffer';
import {mkdir, readdir} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve('.');
const source = path.join(root, 'art/vatra/renders');
const paintovers = path.join(root, 'art/vatra/paintovers');
const output = path.join(root, 'public/content/locations/vatra-central-station');
const depthFiles = await readdir(path.join(source, 'depth'));
await mkdir(path.join(output, 'backdrops'), {recursive: true});

for (const view of ['view-0', 'view-90', 'view-180', 'view-270', 'view-top']) {
  const isTactical = view !== 'view-top';
  const beauty = await sharp(
    isTactical ? path.join(paintovers, `${view}.png`) : path.join(source, `${view}.png`),
  )
    .resize(1920, 1280, {fit: 'fill', kernel: sharp.kernel.lanczos3})
    .png()
    .toBuffer();

  await sharp(beauty)
    .webp({quality: 86, effort: 6, smartSubsample: true})
    .toFile(path.join(output, 'views', `${view}.webp`));

  const backdrop = sharp(path.join(source, 'backdrops', `${view}.png`)).resize(1920, 1280, {
    fit: 'fill',
  });
  if (isTactical) {
    const mask = Buffer.from(`
      <svg width="480" height="320" xmlns="http://www.w3.org/2000/svg">
        <defs><filter id="feather"><feGaussianBlur stdDeviation="24"/></filter></defs>
        <rect x="28" y="28" width="424" height="264" fill="white" filter="url(#feather)"/>
      </svg>
    `);
    const inset = await sharp(beauty)
      .resize(480, 320, {fit: 'fill', kernel: sharp.kernel.lanczos3})
      .composite([{input: mask, blend: 'dest-in'}])
      .png()
      .toBuffer();
    backdrop.composite([{input: inset, left: 720, top: 480}]);
  }
  await backdrop
    .webp({quality: 82, effort: 6, smartSubsample: true})
    .toFile(path.join(output, 'backdrops', `${view}.webp`));

  const occlusionSource = path.join(source, 'occlusion', `${view}.png`);
  if (isTactical) {
    const occlusionAlpha = await sharp(occlusionSource)
      .resize(1920, 1280, {fit: 'fill'})
      .extractChannel('alpha')
      .toBuffer();
    const beautyRgb = await sharp(beauty)
      .removeAlpha()
      .png()
      .toBuffer();
    await sharp(beautyRgb)
      .joinChannel(occlusionAlpha)
      .webp({quality: 88, alphaQuality: 100, effort: 6, smartSubsample: true})
      .toFile(path.join(output, 'occlusion-3d', `${view}.webp`));
  } else {
    await sharp(occlusionSource)
      .resize(1920, 1280, {fit: 'fill'})
      .webp({quality: 88, alphaQuality: 100, effort: 6, smartSubsample: true})
      .toFile(path.join(output, 'occlusion-3d', `${view}.webp`));
  }

  const depth = depthFiles.find((file) => file.startsWith(`${view}-`));
  if (!depth) throw new Error(`Missing Blender depth output for ${view}`);
  await sharp(path.join(source, 'depth', depth))
    .resize(960, 640, {fit: 'fill'})
    .webp({lossless: true, effort: 6})
    .toFile(path.join(output, 'depth', `${view}.webp`));
}

console.log('Processed five Gone Vatra beauty, backdrop, occlusion, and depth render sets.');
