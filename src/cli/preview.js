import { rgbaToHex } from '../core/processor.js';

/**
 * Render a pixel grid as terminal text.
 * color=true: ANSI truecolor blocks (transparent cells render as blank).
 * color=false: one #rrggbb hex per cell, space-separated (agent-parseable).
 * @param {{r:number,g:number,b:number,a:number}[][]} grid
 * @param {{color?: boolean}} [opts]
 * @returns {string}
 */
export function gridToText(grid, { color = true } = {}) {
  if (color) {
    return grid.map(row =>
      row.map(({ r, g, b, a }) =>
        a < 128 ? '  ' : `\x1b[48;2;${r};${g};${b}m  \x1b[0m`
      ).join('')
    ).join('\n');
  }
  return grid.map(row => row.map(rgbaToHex).join(' ')).join('\n');
}
