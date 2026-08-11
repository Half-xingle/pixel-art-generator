import { renderGrid } from '../core/processor.js';

/**
 * Render a pixel grid to a PNG data URL at the given cell size.
 * Shared by the draw-tab export and the convert-tab export.
 * @param {{r:number,g:number,b:number,a:number}[][]} grid
 * @param {number} cellSize - Output pixels per grid cell
 * @returns {string} PNG data URL
 */
export function gridToPNGDataURL(grid, cellSize) {
  const { data, width, height } = renderGrid(grid, cellSize);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.putImageData(new ImageData(data, width, height), 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Trigger a PNG file download in the browser.
 * @param {string} dataURL - PNG data URL from canvas.toDataURL()
 * @param {string} filename - e.g. "pixel-art.png"
 */
export function downloadPNG(dataURL, filename = 'pixel-art.png') {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataURL;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
