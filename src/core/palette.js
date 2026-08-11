// Classic NES-inspired 16-color palette
export const DEFAULT_PALETTE = [
  '#000000', '#ffffff', '#888888', '#aaaaaa',
  '#ff0000', '#ff8800', '#ffff00', '#88ff00',
  '#00ff00', '#00ff88', '#00ffff', '#0088ff',
  '#0000ff', '#8800ff', '#ff00ff', '#ff0088',
];

function parseHex(hex) {
  const value = parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff };
}

// Pre-parsed once at module load — quantize runs per pixel
const DEFAULT_RGB = DEFAULT_PALETTE.map(parseHex);

function colorDistance(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

/** Map an RGBA color to the nearest palette color. Transparent stays transparent. */
export function quantizeColor(r, g, b, a, palette = DEFAULT_PALETTE) {
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const colors = palette === DEFAULT_PALETTE ? DEFAULT_RGB : palette.map(parseHex);
  let best = null;
  let bestDist = Infinity;
  for (const c of colors) {
    const dist = colorDistance(r, g, b, c.r, c.g, c.b);
    if (dist < bestDist) {
      bestDist = dist;
      best = { r: c.r, g: c.g, b: c.b, a: 255 };
    }
  }
  return best;
}

/** Map every cell of a grid onto the palette. */
export function quantizeGrid(grid, palette = DEFAULT_PALETTE) {
  return grid.map(row => row.map(({ r, g, b, a }) => quantizeColor(r, g, b, a, palette)));
}
