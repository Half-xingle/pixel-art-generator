import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', '..', 'cli.js');

describe('cli palette', () => {
  const outFile = join(__dirname, '..', 'test-palette-output.png');
  const testInput = join(__dirname, '..', 'test-palette-input.png');

  before(async () => {
    const { writePNG } = await import('./image.js');
    const { renderGrid } = await import('../core/processor.js');
    // Noisy grid: many near-duplicate colors, far more than 16
    const grid = [];
    for (let y = 0; y < 8; y++) {
      const row = [];
      for (let x = 0; x < 8; x++) {
        row.push({ r: 200 + (x * 7) % 50, g: 30 + (y * 11) % 60, b: 100 + (x + y) % 40, a: 255 });
      }
      grid.push(row);
    }
    const { data, width, height } = renderGrid(grid, 4);
    await writePNG(data, width, height, testInput);
  });

  after(() => {
    try { unlinkSync(outFile); } catch {}
    try { unlinkSync(testInput); } catch {}
  });

  it('quantizes convert output to at most 16 colors', async () => {
    const result = spawnSync(process.execPath, [CLI, 'convert', testInput, '--size', '8', '--palette', 'nes', '-o', outFile], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    const { default: sharp } = await import('sharp');
    const { data, info } = await sharp(outFile).raw().toBuffer({ resolveWithObject: true });
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    assert.ok(colors.size <= 16, `expected <= 16 colors, got ${colors.size}`);
  });

  it('rejects unknown palettes', () => {
    const result = spawnSync(process.execPath, [CLI, 'convert', testInput, '--palette', 'bogus', '-o', outFile], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('未知调色板'));
  });
});
