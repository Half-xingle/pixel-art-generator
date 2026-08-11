#!/usr/bin/env node
import { jsonToGrid, renderGrid, toPixelArt } from './src/core/processor.js';
import { readImage, readImageSize, writePNG } from './src/cli/image.js';
import { readFileSync } from 'node:fs';

const CELL_SIZE = 32;

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0];

  function getValue(flag) {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : null;
  }

  return {
    command: cmd,
    size: parseInt(getValue('--size') || '16', 10),
    grid: getValue('--grid'),
    file: getValue('--file'),
    output: getValue('-o') || getValue('--output') || 'output.png',
    input: cmd !== 'draw' && cmd !== '--help' ? args[1] : null,
  };
}

async function cmdDraw(gridData, outputPath, cellSize) {
  // jsonToGrid accepts a bare 2D array (--grid), {width,height,pixels}, or legacy {size,pixels}
  const grid = jsonToGrid(gridData);
  const cs = cellSize || CELL_SIZE;
  const { data, width, height } = renderGrid(grid, cs);
  await writePNG(data, width, height, outputPath);
  const gw = grid[0].length;
  const gh = grid.length;
  console.log(`OK: pixel art saved to ${outputPath} (${gw}×${gh})`);
}

function showHelp() {
  console.log(`
🎨 像素画生成器 CLI — Pixel Art Generator

用法:
  node cli.js draw --grid <json> [--size <n>] -o <file>
  node cli.js draw --file <path> -o <file>
  node cli.js convert <image> --size <n> -o <file>
  node cli.js --help

命令:
  draw      从颜色网格生成像素画
  convert   将图片转换为像素画（自动保留宽高比）

选项:
  --size <n>     draw: 每个像素的显示大小（默认 32，越大输出图越精细）
                 convert: 最长边的网格数（默认 16），另一侧自动按比例计算
  --grid <json>  颜色二维数组 JSON
  --file <path>  JSON 文件路径（含 width/height/pixels 字段）
  -o <file>      输出图片路径，默认 output.png
  --help         显示帮助信息

示例:
  node cli.js draw --grid '[["#ff0000","#00ff00"],["#0000ff","#ffffff"]]' -o art.png
  node cli.js convert photo.jpg --size 32 -o pixel-art.png
`);
}

async function cmdConvert(imagePath, maxSize, outputPath) {
  const { width, height } = await readImageSize(imagePath);
  // Compute grid dimensions preserving aspect ratio
  const aspect = width / height;
  let gridWidth, gridHeight;
  if (aspect >= 1) {
    gridWidth = maxSize;
    gridHeight = Math.max(1, Math.round(maxSize / aspect));
  } else {
    gridWidth = Math.max(1, Math.round(maxSize * aspect));
    gridHeight = maxSize;
  }
  // Decode already downscaled to the grid — avoids decoding the full image
  const { data, width: decodedW, height: decodedH } = await readImage(imagePath, gridWidth, gridHeight);
  const grid = toPixelArt(data, decodedW, decodedH, gridWidth, gridHeight);
  const result = renderGrid(grid, CELL_SIZE);
  await writePNG(result.data, result.width, result.height, outputPath);
  console.log(`OK: pixel art saved to ${outputPath} (${gridWidth}×${gridHeight})`);
}

async function main() {
  const { command, input, size, grid, file, output } = parseArgs(process.argv);

  if (command === 'draw') {
    let gridData;
    if (grid) {
      try {
        gridData = JSON.parse(grid);
      } catch {
        console.error('Error: JSON 格式无效');
        process.exit(1);
      }
    } else if (file) {
      let content, json;
      try {
        content = readFileSync(file, 'utf-8');
      } catch {
        console.error(`Error: 无法读取文件 — ${file}`);
        process.exit(2);
      }
      try {
        json = JSON.parse(content);
      } catch {
        console.error('Error: JSON 文件格式无效');
        process.exit(1);
      }
      gridData = json; // Pass entire JSON object (includes width/height/pixels)
    } else {
      console.error('Error: use --grid <json> or --file <path>');
      process.exit(1);
    }
    await cmdDraw(gridData, output, size);
  } else if (command === 'convert') {
    if (!input) {
      console.error('Error: provide an image path');
      console.error('Usage: node cli.js convert <image> --size <n> -o <file>');
      process.exit(1);
    }
    await cmdConvert(input, size, output);
  } else if (command === '--help' || command === '-h' || command === undefined) {
    showHelp();
  } else {
    console.error(`Unknown command: ${command}`);
    console.error('Run "node cli.js --help" for usage.');
    process.exit(1);
  }
}

main().catch(err => {
  if (err.code === 'ENOENT') {
    console.error(`Error: 文件不存在 — ${err.path}`);
    process.exit(2);
  }
  if (err.message?.toLowerCase().includes('input file')) {
    console.error(`Error: 无法读取图片 — ${err.message}`);
    process.exit(2);
  }
  console.error('Error:', err.message);
  process.exit(1);
});
