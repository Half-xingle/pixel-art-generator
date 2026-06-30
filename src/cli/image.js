import sharp from 'sharp';

/**
 * Read an image file and return raw RGBA pixel data.
 * @param {string} filePath
 * @returns {Promise<{data: Uint8ClampedArray, width: number, height: number}>}
 */
export async function readImage(filePath) {
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
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
