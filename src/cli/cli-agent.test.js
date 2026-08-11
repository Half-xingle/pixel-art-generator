import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync } from 'node:fs';
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
    const { data } = await sharp(outFile).raw().toBuffer({ resolveWithObject: true });
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    assert.ok(colors.size <= 16, `expected <= 16 colors, got ${colors.size}`);
  });

  it('rejects unknown palettes', () => {
    const result = spawnSync(process.execPath, [CLI, 'convert', testInput, '--palette', 'bogus', '-o', outFile], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('未知调色板'));
  });

  it('pixels --palette nes outputs at most 16 distinct colors', () => {
    const result = spawnSync(process.execPath, [CLI, 'pixels', testInput, '--size', '8', '--palette', 'nes'], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    const json = JSON.parse(result.stdout);
    const distinct = new Set(json.pixels.flat());
    assert.ok(distinct.size <= 16, `expected <= 16 distinct colors, got ${distinct.size}`);
  });
});

describe('cli pixels round-trip', () => {
  const gridFile = join(__dirname, '..', 'test-grid.json');
  const gridFile2 = join(__dirname, '..', 'test-grid2.json');
  const pngOut = join(__dirname, '..', 'test-roundtrip-out.png');
  const pipeOut = join(__dirname, '..', 'test-roundtrip-pipe.png');
  const testInput = join(__dirname, '..', 'test-roundtrip-input.png');

  before(async () => {
    const { writePNG } = await import('./image.js');
    const { renderGrid } = await import('../core/processor.js');
    const grid = [
      [{ r: 255, g: 0, b: 0, a: 255 }, { r: 0, g: 255, b: 0, a: 255 }],
      [{ r: 0, g: 0, b: 255, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }],
    ];
    const { data, width, height } = renderGrid(grid, 8);
    await writePNG(data, width, height, testInput);
  });

  after(() => {
    for (const f of [gridFile, gridFile2, pngOut, pipeOut, testInput]) {
      try { unlinkSync(f); } catch {}
    }
  });

  it('outputs grid JSON to stdout by default', () => {
    const result = spawnSync(process.execPath, [CLI, 'pixels', testInput, '--size', '2'], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    const json = JSON.parse(result.stdout);
    assert.equal(json.width, 2);
    assert.equal(json.height, 2);
    assert.equal(json.pixels[0][0], '#ff0000');
    assert.equal(json.pixels[1][1], '#ffffff');
  });

  it('writes grid JSON to a file with -o', () => {
    const result = spawnSync(process.execPath, [CLI, 'pixels', testInput, '--size', '2', '-o', gridFile], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes('OK'));
    assert.equal(JSON.parse(readFileSync(gridFile, 'utf-8')).pixels[0][0], '#ff0000');
  });

  it('round-trips: pixels → draw → pixels keeps the grid identical', () => {
    spawnSync(process.execPath, [CLI, 'pixels', testInput, '--size', '2', '-o', gridFile], { encoding: 'utf-8' });
    const draw = spawnSync(process.execPath, [CLI, 'draw', '--file', gridFile, '--size', '8', '-o', pngOut], { encoding: 'utf-8' });
    assert.strictEqual(draw.status, 0, `stderr: ${draw.stderr}`);
    const back = spawnSync(process.execPath, [CLI, 'pixels', pngOut, '--size', '2', '-o', gridFile2], { encoding: 'utf-8' });
    assert.strictEqual(back.status, 0, `stderr: ${back.stderr}`);
    const a = JSON.parse(readFileSync(gridFile, 'utf-8'));
    const b = JSON.parse(readFileSync(gridFile2, 'utf-8'));
    assert.deepEqual(a, b);
  });

  it('fails with exit 1 when no image is given', () => {
    const result = spawnSync(process.execPath, [CLI, 'pixels'], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 1);
  });

  it('pixels -o --json prints a parseable result object', () => {
    const result = spawnSync(process.execPath, [CLI, 'pixels', testInput, '--size', '2', '--json', '-o', gridFile], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    const json = JSON.parse(result.stdout);
    assert.equal(json.ok, true);
    assert.equal(json.file, gridFile);
    assert.equal(json.grid.width, 2);
    assert.equal(json.grid.height, 2);
    assert.equal(json.colors, 4);
  });

  it('pixels --json without -o keeps stdout a pure grid payload', () => {
    const result = spawnSync(process.execPath, [CLI, 'pixels', testInput, '--size', '2', '--json'], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.width, 2);
    assert.equal(payload.height, 2);
    assert.equal(payload.pixels[0][0], '#ff0000');
    const summary = JSON.parse(result.stderr);
    assert.equal(summary.ok, true);
    assert.equal(summary.file, null);
    assert.equal(summary.grid.width, 2);
    assert.equal(summary.colors, 4);
  });

  it('pixels --preview without -o keeps stdout a pure JSON payload (C1 regression)', () => {
    const result = spawnSync(process.execPath, [CLI, 'pixels', testInput, '--size', '2', '--preview'], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    const json = JSON.parse(result.stdout);
    assert.equal(json.pixels[0][0], '#ff0000');
    assert.ok(result.stderr.length > 0, 'preview should be routed to stderr');
  });

  it('pixels stdout pipes into draw - for a full round-trip', () => {
    const pixels = spawnSync(process.execPath, [CLI, 'pixels', testInput, '--size', '2'], { encoding: 'utf-8' });
    assert.strictEqual(pixels.status, 0, `stderr: ${pixels.stderr}`);
    const draw = spawnSync(process.execPath, [CLI, 'draw', '-', '--size', '8', '-o', pipeOut], { encoding: 'utf-8', input: pixels.stdout });
    assert.strictEqual(draw.status, 0, `stderr: ${draw.stderr}`);
    assert.ok(readFileSync(pipeOut).length > 0, 'output PNG should exist');
  });

  it('convert --json prints a parseable result object', () => {
    const result = spawnSync(process.execPath, [CLI, 'convert', testInput, '--size', '2', '--json', '-o', pngOut], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    const json = JSON.parse(result.stdout);
    assert.equal(json.ok, true);
    assert.equal(json.file, pngOut);
    assert.equal(json.grid.width, 2);
    assert.equal(json.grid.height, 2);
    assert.equal(json.colors, 4);
  });
});

describe('cli --json', () => {
  const outFile = join(__dirname, '..', 'test-json-output.png');

  after(() => {
    try { unlinkSync(outFile); } catch {}
  });

  it('draw --json prints a parseable result object', () => {
    const grid = '[["#ff0000","#00ff00"],["#0000ff","#ffffff"]]';
    const result = spawnSync(process.execPath, [CLI, 'draw', '--size', '2', '--grid', grid, '--json', '-o', outFile], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    const json = JSON.parse(result.stdout);
    assert.equal(json.ok, true);
    assert.equal(json.grid.width, 2);
    assert.equal(json.grid.height, 2);
    assert.equal(json.colors, 4);
  });

  it('draw --json counts distinct colors (dedups repeats)', () => {
    const grid = '[["#ff0000","#00ff00"],["#0000ff","#00ff00"]]';
    const result = spawnSync(process.execPath, [CLI, 'draw', '--size', '2', '--grid', grid, '--json', '-o', outFile], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    const json = JSON.parse(result.stdout);
    assert.equal(json.colors, 3);
  });

  it('convert --json prints error JSON on stderr with exit 2 for missing file', () => {
    const result = spawnSync(process.execPath, [CLI, 'convert', join(__dirname, '..', 'no-such-file.png'), '--json', '-o', outFile], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 2);
    const err = JSON.parse(result.stderr);
    assert.equal(err.ok, false);
    assert.ok(typeof err.error === 'string' && err.error.length > 0);
  });

  it('stdout stays empty of non-JSON on error', () => {
    const result = spawnSync(process.execPath, [CLI, 'draw', '--json', '-o', outFile], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 1);
    assert.equal(result.stdout, '');
  });
});

describe('cli --preview', () => {
  const outFile = join(__dirname, '..', 'test-preview-output.png');
  const grid = '[["#ff0000","#00ff00"],["#0000ff","#ffffff"]]';

  after(() => {
    try { unlinkSync(outFile); } catch {}
  });

  it('draw --preview prints ANSI blocks', () => {
    const result = spawnSync(process.execPath, [CLI, 'draw', '--size', '2', '--grid', grid, '--preview', '-o', outFile], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes('\x1b[48;2;255;0;0m'));
  });

  it('draw --preview --no-color prints a hex grid', () => {
    const result = spawnSync(process.execPath, [CLI, 'draw', '--size', '2', '--grid', grid, '--preview', '--no-color', '-o', outFile], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes('#ff0000'));
    assert.ok(!result.stdout.includes('\x1b['));
  });

  it('draw --preview --json keeps stdout pure JSON', () => {
    const result = spawnSync(process.execPath, [CLI, 'draw', '--size', '2', '--grid', grid, '--preview', '--json', '-o', outFile], { encoding: 'utf-8' });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    const json = JSON.parse(result.stdout);
    assert.equal(json.ok, true);
    assert.ok(result.stderr.includes('\x1b[48;2;255;0;0m'));
  });
});
