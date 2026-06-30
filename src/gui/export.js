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
