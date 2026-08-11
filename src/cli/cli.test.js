import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', '..', 'cli.js');

describe('cli draw', () => {
  const outFile = join(__dirname, '..', 'test-draw-output.png');

  after(() => {
    try { unlinkSync(outFile); } catch {}
  });

  it('draws a 2x2 grid from inline JSON', () => {
    const grid = '[["#ff0000","#00ff00"],["#0000ff","#ffffff"]]';
    const result = spawnSync(process.execPath, [CLI, 'draw', '--size', '2', '--grid', grid, '-o', outFile], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes('OK'));
    assert.ok(existsSync(outFile));
    const stats = statSync(outFile);
    assert.ok(stats.size > 0);
  });
});

describe('cli convert', () => {
  const outFile = join(__dirname, '..', 'test-convert-output.png');
  const testInput = join(__dirname, '..', 'test-input.png');

  before(async () => {
    const { writePNG } = await import('./image.js');
    const { renderGrid } = await import('../core/processor.js');
    const grid = [
      [{ r: 255, g: 0, b: 0, a: 255 }, { r: 0, g: 255, b: 0, a: 255 }],
      [{ r: 0, g: 0, b: 255, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }],
    ];
    const { data, width, height } = renderGrid(grid, 4);
    await writePNG(data, width, height, testInput);
  });

  after(() => {
    try { unlinkSync(outFile); } catch {}
    try { unlinkSync(testInput); } catch {}
  });

  it('converts an image to pixel art', () => {
    const result = spawnSync(process.execPath, [CLI, 'convert', testInput, '--size', '2', '-o', outFile], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes('OK'));
    assert.ok(existsSync(outFile));
  });
});

describe('cli draw stdin', () => {
  const outFile = join(__dirname, '..', 'test-stdin-output.png');

  after(() => {
    try { unlinkSync(outFile); } catch {}
  });

  it('reads grid JSON from stdin with -', () => {
    const grid = JSON.stringify({
      width: 2, height: 2,
      pixels: [['#ff0000', '#00ff00'], ['#0000ff', '#ffffff']],
    });
    const result = spawnSync(process.execPath, [CLI, 'draw', '-', '--size', '2', '-o', outFile], { input: grid, encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    assert.ok(existsSync(outFile));
  });

  it('accepts a large 64x64 grid via stdin', () => {
    const rows = [];
    for (let y = 0; y < 64; y++) {
      rows.push(Array.from({ length: 64 }, (_, x) => ((x + y) % 2 ? '#ff0000' : '#0000ff')));
    }
    const grid = JSON.stringify({ width: 64, height: 64, pixels: rows });
    assert.ok(grid.length > 30000, `stdin payload is ${grid.length} chars, should exceed 32k arg limit argument`);
    const result = spawnSync(process.execPath, [CLI, 'draw', '-', '--size', '2', '-o', outFile], { input: grid, encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
  });
});
