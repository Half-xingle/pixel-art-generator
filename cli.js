#!/usr/bin/env node
import { jsonToGrid, renderGrid, toPixelArt, gridToJSON, rgbaToHex } from './src/core/processor.js';
import { readImage, readImageSize, writePNG } from './src/cli/image.js';
import { quantizeGrid, DEFAULT_PALETTE } from './src/core/palette.js';
import { gridToText } from './src/cli/preview.js';
import { readFileSync, writeFileSync } from 'node:fs';

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
    output: getValue('-o') || getValue('--output') || null,
    input: args[1],
    palette: getValue('--palette'),
    preview: args.includes('--preview'),
    json: args.includes('--json'),
    noColor: args.includes('--no-color') || process.env.NO_COLOR !== undefined,
  };
}

/** Read all of stdin as UTF-8 text. */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

const opts = parseArgs(process.argv);

/** Print an error message; JSON mode emits {"ok":false,...} on stderr. */
function fail(message, code) {
  if (opts.json) console.error(JSON.stringify({ ok: false, error: message }));
  else console.error(`Error: ${message}`);
  process.exit(code);
}

/** Distinct color count in a grid. */
function countColors(grid) {
  return new Set(grid.flat().map(rgbaToHex)).size;
}

/** Print the grid as terminal text; JSON mode routes it to stderr to keep stdout pure. */
function printPreview(grid) {
  if (!opts.preview) return;
  const text = gridToText(grid, { color: !opts.noColor });
  if (opts.json) console.error(text);
  else console.log(text);
}

async function cmdDraw(gridData, outputPath, cellSize) {
  // jsonToGrid accepts a bare 2D array (--grid), {width,height,pixels}, or legacy {size,pixels}
  const grid = jsonToGrid(gridData);
  printPreview(grid);
  const cs = cellSize || CELL_SIZE;
  const { data, width, height } = renderGrid(grid, cs);
  await writePNG(data, width, height, outputPath);
  const gw = grid[0].length;
  const gh = grid.length;
  if (opts.json) {
    console.log(JSON.stringify({ ok: true, file: outputPath, grid: { width: gw, height: gh }, colors: countColors(grid) }));
  } else {
    console.log(`OK: pixel art saved to ${outputPath} (${gw}×${gh})`);
  }
}

function showHelp() {
  console.log(`
🎨 像素画生成器 CLI — Pixel Art Generator

用法:
  node cli.js draw [--grid <json> | --file <path> | -] [--size <n>] -o <file> [--preview] [--json] [--no-color]
  node cli.js convert <image> [--size <n>] -o <file> [--palette nes] [--preview] [--json] [--no-color]
  node cli.js pixels <image> [--size <n>] [-o <file>] [--palette nes] [--preview] [--json] [--no-color]
  node cli.js --help

命令:
  draw      网格 JSON → 像素画 PNG（- 表示从 stdin 读网格）
  convert   图片 → 像素画 PNG（自动保留宽高比）
  pixels    图片 → 网格 JSON（-o 缺省时输出到 stdout，供读取与修改）

选项:
  --size <n>     draw: 每个像素的显示大小（默认 16）
                 convert/pixels: 最长边的网格数（默认 16），另一侧自动按比例计算
  --grid <json>  颜色二维数组 JSON
  --file <path>  JSON 文件路径（含 width/height/pixels 字段）
  -o <file>      输出路径；draw/convert 默认 output.png，pixels 缺省输出到 stdout
  --palette <n>  量化到调色板（支持: nes = 经典 NES 16 色）
  --preview      终端预览网格（ANSI 色块；--no-color 时输出 #rrggbb 网格）
  --json         结果输出为 JSON（错误时 stderr 输出 {"ok":false,...}）
  --no-color     禁用 ANSI 颜色（同 NO_COLOR 环境变量）
  --help         显示帮助信息

示例:
  node cli.js draw --grid '[["#ff0000","#00ff00"],["#0000ff","#ffffff"]]' -o art.png
  node cli.js draw - -o art.png < grid.json
  node cli.js convert photo.jpg --size 32 --palette nes --preview -o pixel-art.png
  node cli.js pixels art.png -o grid.json
`);
}

/** Grid dimensions preserving aspect ratio; maxSize applies to the longest edge. */
function computeGridDims(width, height, maxSize) {
  const aspect = width / height;
  if (aspect >= 1) {
    return { gridWidth: maxSize, gridHeight: Math.max(1, Math.round(maxSize / aspect)) };
  }
  return { gridWidth: Math.max(1, Math.round(maxSize * aspect)), gridHeight: maxSize };
}

/** Resolve a --palette name to a palette array; unknown names exit(1). */
function resolvePalette(name) {
  if (!name) return null;
  if (name === 'nes') return DEFAULT_PALETTE;
  fail(`未知调色板: ${name}（支持: nes）`, 1);
}

async function cmdConvert(imagePath, maxSize, palette, outputPath) {
  const { width, height } = await readImageSize(imagePath);
  const { gridWidth, gridHeight } = computeGridDims(width, height, maxSize);
  // Decode already downscaled to the grid — avoids decoding the full image
  const { data, width: decodedW, height: decodedH } = await readImage(imagePath, gridWidth, gridHeight);
  let grid = toPixelArt(data, decodedW, decodedH, gridWidth, gridHeight);
  if (palette) grid = quantizeGrid(grid, palette);
  printPreview(grid);
  const result = renderGrid(grid, CELL_SIZE);
  await writePNG(result.data, result.width, result.height, outputPath);
  if (opts.json) {
    console.log(JSON.stringify({ ok: true, file: outputPath, grid: { width: gridWidth, height: gridHeight }, colors: countColors(grid) }));
  } else {
    console.log(`OK: pixel art saved to ${outputPath} (${gridWidth}×${gridHeight})`);
  }
}

async function cmdPixels(imagePath, maxSize, palette, outputPath, json) {
  const { width, height } = await readImageSize(imagePath);
  const { gridWidth, gridHeight } = computeGridDims(width, height, maxSize);
  const { data, width: decodedW, height: decodedH } = await readImage(imagePath, gridWidth, gridHeight);
  let grid = toPixelArt(data, decodedW, decodedH, gridWidth, gridHeight);
  if (palette) grid = quantizeGrid(grid, palette);
  printPreview(grid);
  const payload = JSON.stringify(gridToJSON(grid));
  if (outputPath) {
    writeFileSync(outputPath, payload, 'utf-8');
    if (opts.json) {
      console.log(JSON.stringify({ ok: true, file: outputPath, grid: { width: gridWidth, height: gridHeight }, colors: countColors(grid) }));
    } else {
      console.log(`OK: grid saved to ${outputPath} (${gridWidth}×${gridHeight})`);
    }
  } else {
    // stdout is the payload itself — nothing else may be printed
    process.stdout.write(payload + '\n');
    if (opts.json) {
      console.error(JSON.stringify({ ok: true, file: null, grid: { width: gridWidth, height: gridHeight }, colors: countColors(grid) }));
    }
  }
}

async function main() {
  const { command, input, size, grid, file, output, palette, json } = opts;

  if (command === 'draw') {
    let gridData;
    if (grid) {
      try {
        gridData = JSON.parse(grid);
      } catch {
        fail('JSON 格式无效', 1);
      }
    } else if (file) {
      let content, json;
      try {
        content = readFileSync(file, 'utf-8');
      } catch {
        fail(`无法读取文件 — ${file}`, 2);
      }
      try {
        json = JSON.parse(content);
      } catch {
        fail('JSON 文件格式无效', 1);
      }
      gridData = json; // Pass entire JSON object (includes width/height/pixels)
    } else if (input === '-') {
      let content, json;
      try {
        content = await readStdin();
      } catch {
        fail('无法读取 stdin', 2);
      }
      try {
        json = JSON.parse(content);
      } catch {
        fail('stdin JSON 格式无效', 1);
      }
      gridData = json;
    } else {
      fail('use --grid <json>, --file <path>, or - (stdin)', 1);
    }
    await cmdDraw(gridData, output || 'output.png', size);
  } else if (command === 'convert') {
    if (!input) {
      fail('provide an image path', 1);
    }
    await cmdConvert(input, size, resolvePalette(palette), output || 'output.png');
  } else if (command === 'pixels') {
    if (!input) {
      fail('provide an image path', 1);
    }
    await cmdPixels(input, size, resolvePalette(palette), output, json);
  } else if (command === '--help' || command === '-h' || command === undefined) {
    showHelp();
  } else {
    fail(`Unknown command: ${command}`, 1);
  }
}

main().catch(err => {
  if (err.code === 'ENOENT') {
    fail(`文件不存在 — ${err.path}`, 2);
  }
  if (err.message?.toLowerCase().includes('input file')) {
    fail(`无法读取图片 — ${err.message}`, 2);
  }
  fail(err.message, 1);
});
