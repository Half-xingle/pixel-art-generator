import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gridToText } from './preview.js';

const grid = [
  [{ r: 255, g: 0, b: 0, a: 255 }, { r: 0, g: 255, b: 0, a: 0 }],
  [{ r: 0, g: 0, b: 255, a: 255 }],
];

describe('gridToText', () => {
  it('renders ANSI color blocks by default', () => {
    const out = gridToText(grid);
    assert.ok(out.includes('\x1b[48;2;255;0;0m'), 'red block escape');
    assert.ok(!out.includes('\x1b[48;2;0;255;0m'), 'transparent cell has no fill');
    assert.equal(out.split('\n').length, 2);
  });

  it('renders hex grid when color is disabled', () => {
    const out = gridToText(grid, { color: false });
    assert.ok(out.includes('#ff0000'));
    assert.ok(!out.includes('\x1b['));
    assert.ok(out.includes('#00ff0000'), 'transparent cell shows 8-char hex');
  });
});
