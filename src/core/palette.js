// Classic NES-inspired 16-color palette
export const DEFAULT_PALETTE = [
  '#000000', '#ffffff', '#888888', '#aaaaaa',
  '#ff0000', '#ff8800', '#ffff00', '#88ff00',
  '#00ff00', '#00ff88', '#00ffff', '#0088ff',
  '#0000ff', '#8800ff', '#ff00ff', '#ff0088',
];

function hexToRGB(hex) {
  const value = parseInt(hex.slice(1), 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
}

export function quantizeColor(r, g, b, a, palette = DEFAULT_PALETTE) {
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };

  let best = null;
  let bestDist = Infinity;

  for (const hex of palette) {
    const { r: pr, g: pg, b: pb } = hexToRGB(hex);
    const dist = colorDistance(r, g, b, pr, pg, pb);
    if (dist < bestDist) {
      bestDist = dist;
      best = { r: pr, g: pg, b: pb, a: 255 };
    }
  }
  return best;
}
