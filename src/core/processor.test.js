import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toPixelArt, renderGrid, hexToRGBA, rgbaToHex, gridToJSON, jsonToGrid } from './processor.js';

describe('processor', () => {
  it('hexToRGBA converts #ff0000', () => {
    assert.deepEqual(hexToRGBA('#ff0000'), { r: 255, g: 0, b: 0, a: 255 });
  });

  it('hexToRGBA converts #000000', () => {
    assert.deepEqual(hexToRGBA('#000000'), { r: 0, g: 0, b: 0, a: 255 });
  });

  it('rgbaToHex converts color with alpha', () => {
    assert.equal(rgbaToHex({ r: 255, g: 0, b: 0, a: 255 }), '#ff0000');
  });

  it('rgbaToHex handles zero alpha', () => {
    assert.equal(rgbaToHex({ r: 0, g: 0, b: 0, a: 0 }), '#00000000');
  });

  it('toPixelArt downsamples 4x4 image to 2x2 grid', () => {
    // Create a 4x4 RGBA image: top-left half red, bottom-right half blue
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        const idx = (y * 4 + x) * 4;
        data[idx] = 255; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 255; // red
      }
    }
    for (let y = 2; y < 4; y++) {
      for (let x = 2; x < 4; x++) {
        const idx = (y * 4 + x) * 4;
        data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 255; data[idx + 3] = 255; // blue
      }
    }
    // Fill the rest with green
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 0 && data[i + 2] === 0) {
        data[i] = 0; data[i + 1] = 255; data[i + 2] = 0; data[i + 3] = 255;
      }
    }

    const grid = toPixelArt(data, 4, 4, 2, 2);
    assert.equal(grid.length, 2);
    assert.equal(grid[0].length, 2);
    // Top-left cell samples from 0,0 region → red
    assert.equal(grid[0][0].r, 255);
    assert.equal(grid[0][0].g, 0);
    // Bottom-right cell samples from 3,3 region → blue
    assert.equal(grid[1][1].r, 0);
    assert.equal(grid[1][1].b, 255);
  });

  it('toPixelArt preserves 4:3 aspect ratio', () => {
    // Create a 4x3 image: 4 columns, 3 rows
    const data = new Uint8ClampedArray(4 * 3 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0; data[i + 1] = 255; data[i + 2] = 0; data[i + 3] = 255; // green
    }
    // Make top-left pixel red
    data[0] = 255; data[1] = 0; data[2] = 0;

    const grid = toPixelArt(data, 4, 3, 4, 3);
    assert.equal(grid.length, 3);
    assert.equal(grid[0].length, 4);
    assert.equal(grid[0][0].r, 255); // top-left is red
    assert.equal(grid[2][3].r, 0); // bottom-right is green
  });

  it('renderGrid produces correct size output', () => {
    const grid = [
      [{ r: 255, g: 0, b: 0, a: 255 }, { r: 0, g: 255, b: 0, a: 255 }],
      [{ r: 0, g: 0, b: 255, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }],
    ];
    const result = renderGrid(grid, 4);
    assert.equal(result.width, 8);  // 2*4
    assert.equal(result.height, 8); // 2*4
    assert.equal(result.data.length, 8 * 8 * 4);
  });

  it('gridToJSON and jsonToGrid round-trips rectangular', () => {
    // 3×2 grid (3 columns, 2 rows)
    const grid = [
      [{ r: 255, g: 0, b: 0, a: 255 }, { r: 0, g: 255, b: 0, a: 255 }, { r: 0, g: 0, b: 255, a: 255 }],
      [{ r: 255, g: 255, b: 255, a: 255 }, { r: 128, g: 128, b: 128, a: 255 }, { r: 0, g: 0, b: 0, a: 255 }],
    ];
    const json = gridToJSON(grid);
    assert.equal(json.width, 3);
    assert.equal(json.height, 2);
    assert.equal(json.pixels[0][0], '#ff0000');
    const back = jsonToGrid(json);
    assert.deepEqual(back, grid);
  });

  it('jsonToGrid handles legacy {size, pixels} format', () => {
    const json = {
      size: 2,
      pixels: [['#ff0000', '#00ff00'], ['#0000ff', '#ffffff']],
    };
    const grid = jsonToGrid(json);
    assert.equal(grid.length, 2);
    assert.equal(grid[0].length, 2);
    assert.equal(grid[0][0].r, 255);
  });

  it('jsonToGrid rejects a height larger than the pixels array', () => {
    assert.throws(
      () => jsonToGrid({ width: 2, height: 2, pixels: [['#ff0000']] }),
      /invalid grid JSON: expected pixels array/
    );
  });
});
