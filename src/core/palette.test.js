import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { quantizeColor, DEFAULT_PALETTE } from './palette.js';

describe('palette', () => {
  it('provides default palette with 16 colors', () => {
    assert.equal(DEFAULT_PALETTE.length, 16);
    assert.ok(DEFAULT_PALETTE[0].startsWith('#'));
  });

  it('quantizeColor finds exact match', () => {
    const result = quantizeColor(255, 0, 0, 255, DEFAULT_PALETTE);
    assert.deepEqual(result, { r: 255, g: 0, b: 0, a: 255 });
  });

  it('quantizeColor finds nearest color', () => {
    // Dark red should map to red (#ff0000)
    const result = quantizeColor(200, 10, 10, 255, DEFAULT_PALETTE);
    assert.equal(result.r, 255);
    assert.equal(result.g, 0);
    assert.equal(result.b, 0);
  });
});
