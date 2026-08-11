import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { quantizeColor, quantizeGrid, DEFAULT_PALETTE } from './palette.js';

describe('palette', () => {
  it('provides default palette with 16 colors', () => {
    assert.equal(DEFAULT_PALETTE.length, 16);
    assert.ok(DEFAULT_PALETTE[0].startsWith('#'));
  });

  it('quantizeColor finds exact match', () => {
    assert.deepEqual(quantizeColor(255, 0, 0, 255), { r: 255, g: 0, b: 0, a: 255 });
  });

  it('quantizeColor finds nearest color', () => {
    assert.deepEqual(quantizeColor(200, 10, 10, 255), { r: 255, g: 0, b: 0, a: 255 });
  });

  it('quantizeColor keeps transparent pixels transparent', () => {
    assert.deepEqual(quantizeColor(255, 0, 0, 0), { r: 0, g: 0, b: 0, a: 0 });
  });

  it('quantizeGrid maps every cell onto the palette', () => {
    const grid = [
      [{ r: 12, g: 34, b: 56, a: 255 }, { r: 200, g: 200, b: 200, a: 255 }],
      [{ r: 1, g: 2, b: 3, a: 255 }, { r: 99, g: 88, b: 77, a: 255 }],
    ];
    const out = quantizeGrid(grid);
    const colors = new Set(out.flat().map(c => `${c.r},${c.g},${c.b}`));
    assert.ok(colors.size <= 16);
    assert.ok(out.every(row => row.every(c => c.a === 255)));
  });
});
