import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, readdirSync, readFileSync, rmSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {expect, it} from 'vitest';

it('validates every content resource against its schema', () => {
  expect(() => execFileSync('npm', ['run', 'validate:content'], {stdio: 'pipe'})).not.toThrow();
}, 15_000);

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
  const digest = (directory: string) =>
    createHash('sha256')
      .update(Buffer.concat(files.map((file) => readFileSync(path.join(directory, file)))))
      .digest('hex');
  const generatedRoot = mkdtempSync(path.join(tmpdir(), 'gone-cluj-generated-'));
  try {
    execFileSync('npm', ['run', 'generate:cluj', '--', '--output', generatedRoot], {
      stdio: 'pipe',
    });
    expect(filesIn(generatedRoot)).toEqual(files);
    expect(digest(generatedRoot)).toBe(digest(root));
  } finally {
    rmSync(generatedRoot, {recursive: true, force: true});
  }
}, 60_000);
