import sharp from 'sharp';

/**
 * Read image dimensions without decoding the full image.
 * @param {string} filePath
 * @returns {Promise<{width: number, height: number}>}
 */
export async function readImageSize(filePath) {
  const { width, height } = await sharp(filePath).metadata();
  return { width, height };
}

/**
 * Read an image file and return raw RGBA pixel data.
 * When a target dimension is given, the image is downscaled with
 * nearest-neighbor sampling before decoding (pixel-art friendly), so
 * huge photos never get decoded at full resolution.
 * @param {string} filePath
 * @param {number} [targetWidth] - Resize width; height follows proportionally
 * @param {number} [targetHeight] - Resize height; width follows proportionally
 * @returns {Promise<{data: Uint8ClampedArray|Buffer, width: number, height: number}>}
 */
export async function readImage(filePath, targetWidth, targetHeight) {
  let pipeline = sharp(filePath).ensureAlpha();
  if (targetWidth || targetHeight) {
    // fit: 'inside' keeps the aspect ratio and never crops; the decoded size
    // may differ from the targets by a pixel, so callers must use info.width/height
    pipeline = pipeline.resize(targetWidth, targetHeight, { kernel: 'nearest', fit: 'inside' });
  }
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/**
 * Write raw RGBA pixel data to a PNG file.
 * @param {Uint8ClampedArray} data
 * @param {number} width
 * @param {number} height
 * @param {string} filePath
 */
export async function writePNG(data, width, height, filePath) {
  await sharp(Buffer.from(data), {
    raw: { width, height, channels: 4 },
  }).png().toFile(filePath);
}
