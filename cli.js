#!/usr/bin/env node
import { jsonToGrid, renderGrid, toPixelArt } from './src/core/processor.js';
import { readImage, writePNG } from './src/cli/image.js';
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

async function cmdDraw(size, gridData, outputPath) {
  const grid = jsonToGrid({ size, pixels: gridData });
  const { data, width, height } = renderGrid(grid, CELL_SIZE);
  await writePNG(data, width, height, outputPath);
  console.log(`OK: pixel art saved to ${outputPath}`);
}

function showHelp() {
  console.log(`
Usage: node cli.js <command> [options]

Commands:
  draw      Generate pixel art from a grid
  convert   Convert an image to pixel art

Options:
  --size <n>    Grid size (default: 16)
  --grid <json> Grid data for draw command
  --file <path> JSON file for draw command
  -o <file>     Output file path (default: output.png)
  --help        Show this help
`);
}

async function cmdConvert(imagePath, size, outputPath) {
  const { data, width, height } = await readImage(imagePath);
  const grid = toPixelArt(data, width, height, size);
  const result = renderGrid(grid, CELL_SIZE);
  await writePNG(result.data, result.width, result.height, outputPath);
  console.log(`OK: pixel art saved to ${outputPath}`);
}

async function main() {
  const { command, input, size, grid, file, output } = parseArgs(process.argv);

  if (command === 'draw') {
    let gridData;
    if (grid) {
      gridData = JSON.parse(grid);
    } else if (file) {
      const content = readFileSync(file, 'utf-8');
      const json = JSON.parse(content);
      gridData = json.pixels;
    } else {
      console.error('Error: use --grid <json> or --file <path>');
      process.exit(1);
    }
    await cmdDraw(size, gridData, output);
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
  console.error('Error:', err.message);
  process.exit(1);
});
