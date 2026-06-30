// ─── Color conversion utilities ────────────────────────────────────

export function hexToRGBA(hex) {
  const value = parseInt(hex.slice(1), 16);
  if (hex.length === 7) {
    return {
      r: (value >> 16) & 0xff,
      g: (value >> 8) & 0xff,
      b: value & 0xff,
      a: 255,
    };
  }
  // #rrggbbaa
  return {
    r: (value >> 24) & 0xff,
    g: (value >> 16) & 0xff,
    b: (value >> 8) & 0xff,
    a: value & 0xff,
  };
}

export function rgbaToHex({ r, g, b, a }) {
  return '#' + [r, g, b, a].map(c => c.toString(16).padStart(2, '0')).join('');
}

// ─── Pixel art core algorithms ────────────────────────────────────

/**
 * Downsample an image to a pixel grid using nearest-neighbor sampling.
 * @param {Uint8ClampedArray} data - RGBA flat array
 * @param {number} width - Source image width in pixels
 * @param {number} height - Source image height in pixels
 * @param {number} gridWidth - Target grid width (e.g. 16)
 * @param {number} gridHeight - Target grid height (e.g. 12)
 * @returns {{r:number,g:number,b:number,a:number}[][]} grid[y][x]
 */
export function toPixelArt(data, width, height, gridWidth, gridHeight = gridWidth) {
  if (gridWidth < 1 || gridHeight < 1 || !Number.isInteger(gridWidth) || !Number.isInteger(gridHeight)) {
    throw new RangeError('grid dimensions must be positive integers');
  }
  const grid = [];
  for (let gy = 0; gy < gridHeight; gy++) {
    const row = [];
    for (let gx = 0; gx < gridWidth; gx++) {
      // Center of this grid cell in source coordinates
      const sx = Math.floor((gx + 0.5) * width / gridWidth);
      const sy = Math.floor((gy + 0.5) * height / gridHeight);
      const idx = (sy * width + sx) * 4;
      row.push({
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: data[idx + 3],
      });
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Render a pixel grid to a full-size RGBA flat array.
 * @param {{r:number,g:number,b:number,a:number}[][]} grid
 * @param {number} cellSize - Output pixels per grid cell
 * @returns {{data:Uint8ClampedArray, width:number, height:number}}
 */
export function renderGrid(grid, cellSize = 32) {
  const gridHeight = grid.length;
  if (gridHeight < 1) throw new RangeError('grid must not be empty');
  if (cellSize < 1) throw new RangeError('cellSize must be positive');
  const gridWidth = grid[0].length;
  const outWidth = gridWidth * cellSize;
  const outHeight = gridHeight * cellSize;
  const data = new Uint8ClampedArray(outWidth * outHeight * 4);

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const { r, g, b, a } = grid[gy][gx];
      for (let dy = 0; dy < cellSize; dy++) {
        for (let dx = 0; dx < cellSize; dx++) {
          const px = (gy * cellSize + dy) * outWidth + (gx * cellSize + dx);
          const idx = px * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = a;
        }
      }
    }
  }
  return { data, width: outWidth, height: outHeight };
}

// ─── JSON serialization ─────────────────────────────────────────────

export function gridToJSON(grid) {
  return {
    width: grid[0].length,
    height: grid.length,
    pixels: grid.map(row => row.map(rgbaToHex)),
  };
}

export function jsonToGrid(json) {
  const { width, height, size, pixels } = json;
  const h = height || size;
  const w = width || size;
  const grid = [];
  for (let y = 0; y < h; y++) {
    grid.push(pixels[y].map(hex => hexToRGBA(hex)));
  }
  return grid;
}
