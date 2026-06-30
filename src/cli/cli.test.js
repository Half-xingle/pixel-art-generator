import { describe, it, after } from 'node:test';
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
