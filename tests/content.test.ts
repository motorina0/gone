import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readdirSync, readFileSync, rmSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {expect, it} from 'vitest';

it('validates every content resource against its schema', () => {
  expect(() => execFileSync('npm', ['run', 'validate:content'], {stdio: 'pipe'})).not.toThrow();
}, 15_000);

it('indexes a complete deterministic four-level Cluj PNG tile bundle', () => {
  const root = 'public/content/locations/cluj-napoca-station';
  const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const definition = manifest.highResolution;
  expect(definition).toMatchObject({
    stageWidth: 960,
    stageHeight: 640,
    tileSize: 2048,
    renderingIds: ['svg', 'raster'],
  });
  expect(definition.bundles.length).toBeGreaterThan(1);
  expect(definition.bundles.every((bundle: {mimeType: string}) => bundle.mimeType === 'image/png')).toBe(
    true,
  );
  const views = [definition.views, definition.detailOverlays, definition.occlusion];
  type Tile = {
    offset: number;
    bytes: number;
    width: number;
    height: number;
    bundle: number;
    cropX: number;
    cropY: number;
  };
  const tiles = views.flatMap((layer: Array<{levels: Array<{tiles: Tile[]}>}>) =>
    layer.flatMap((view) => view.levels.flatMap((level) => level.tiles)),
  );
  expect(tiles).toHaveLength(855);
  for (const layer of views) {
    expect(layer).toHaveLength(5);
    for (const view of layer) {
      expect(view.levels.map((level: {level: number}) => level.level)).toEqual([1, 2, 3, 4]);
      expect(view.levels.map((level: {sourceScale: number}) => level.sourceScale)).toEqual([
        2, 4, 8, 16,
      ]);
      for (const level of view.levels) {
        expect(
          level.tiles.reduce(
            (area: number, tile: {width: number; height: number}) =>
              area + tile.width * tile.height,
            0,
          ),
        ).toBe(960 * 640);
      }
    }
  }
  const ordered = [...tiles].sort(
    (left, right) => left.bundle - right.bundle || left.offset - right.offset,
  );
  const offsets = Array.from({length: definition.bundles.length}, () => 0);
  for (const tile of ordered) {
    expect(tile.bundle).toBeGreaterThanOrEqual(0);
    expect(tile.bundle).toBeLessThan(definition.bundles.length);
    expect(tile.offset).toBe(offsets[tile.bundle]);
    expect(tile.cropX === 0 || tile.cropX === 1).toBe(true);
    expect(tile.cropY === 0 || tile.cropY === 1).toBe(true);
    offsets[tile.bundle] = offsets[tile.bundle]! + tile.bytes;
  }
  for (const [index, bundle] of definition.bundles.entries()) {
    const size = statSync(path.join(root, bundle.path)).size;
    expect(size).toBe(offsets[index]);
    expect(size).toBeLessThanOrEqual(32 * 1024 * 1024);
    expect(
      manifest.preloadAssets.find((asset: {path: string}) => asset.path === bundle.path).bytes,
    ).toBe(size);
  }
});

it('regenerates the Cluj location idempotently from committed sources', () => {
  const root = 'public/content/locations/cluj-napoca-station';
  const filesIn = (directory: string, relative = ''): string[] =>
    readdirSync(path.join(directory, relative))
      .flatMap((name) => {
        const entryRelative = path.join(relative, name);
        const entry = path.join(directory, entryRelative);
        return statSync(entry).isDirectory()
          ? filesIn(directory, entryRelative)
          : [entryRelative];
      })
      .sort();
  const files = filesIn(root);
  const generatedFiles = files.filter(
    (file) => file !== 'manifest.json' && !file.startsWith('high-resolution/'),
  );
  const digest = (directory: string, selectedFiles: string[]) =>
    createHash('sha256')
      .update(Buffer.concat(selectedFiles.map((file) => readFileSync(path.join(directory, file)))))
      .digest('hex');
  const generatedRoot = mkdtempSync(path.join(tmpdir(), 'gone-cluj-generated-'));
  try {
    execFileSync(
      'npm',
      ['run', 'generate:cluj', '--', '--output', generatedRoot, '--skip-high-resolution'],
      {stdio: 'pipe'},
    );
    expect(filesIn(generatedRoot).filter((file) => file !== 'manifest.json')).toEqual(
      generatedFiles,
    );
    expect(digest(generatedRoot, generatedFiles)).toBe(digest(root, generatedFiles));
    const generatedManifest = JSON.parse(
      readFileSync(path.join(generatedRoot, 'manifest.json'), 'utf8'),
    );
    const committedManifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
    delete committedManifest.highResolution;
    delete committedManifest.preloadAssets;
    expect(generatedManifest).toEqual(committedManifest);
  } finally {
    rmSync(generatedRoot, {recursive: true, force: true});
  }
}, 60_000);
