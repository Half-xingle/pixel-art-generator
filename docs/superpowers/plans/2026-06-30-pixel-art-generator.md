# 像素画生成器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based pixel art generator with shared core logic used by both a GUI (Vite + vanilla JS) and a CLI (Node.js + Sharp), supporting image-to-pixel-art conversion, manual drawing, and AI-friendly CLI commands.

**Architecture:** Pure-function core (`src/core/`) operates on flat RGBA arrays — no DOM or Node deps. GUI wraps it with Canvas rendering and mouse interaction. CLI wraps it with Sharp for image I/O. Vite dev server serves the GUI; `node cli.js` runs standalone.

**Tech Stack:** Vanilla JS (ES modules), Vite (dev/build), Sharp (image I/O), Node 24 built-in test runner (`node:test` + `node:assert`).

## Global Constraints

- All source code in ES modules (`"type": "module"` in package.json)
- Zero runtime dependencies beyond Sharp for the CLI
- `src/core/` must not import from `src/gui/` or `src/cli/`
- All hex colors use `#rrggbb` format
- Node.js >= 20 (use built-in test runner)

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `.gitignore`
- Create: `src/core/` (empty)
- Create: `src/gui/` (empty)
- Create: `src/cli/` (empty)

**Interfaces:**
- Consumes: nothing
- Produces: project skeleton, installed deps, initialized git repo

- [ ] **Step 1: Create package.json**

```json
{
  "name": "pixel-art-generator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test src/",
    "cli": "node cli.js"
  },
  "dependencies": {
    "sharp": "^0.34.0"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
dist/
.DS_Store
*.local
```

- [ ] **Step 3: Create vite.config.js**

```js
import { defineConfig } from 'vite';
export default defineConfig({
  root: '.',
  build: { outDir: 'dist' }
});
```

- [ ] **Step 4: Create directory structure and install deps**

```bash
cd "D:/persenal program/像素画生成"
mkdir -p src/core src/gui src/cli
npm install
```

Expected: `npm install` completes with no errors, `node_modules/` and `package-lock.json` appear.

- [ ] **Step 5: Initialize git repo and commit**

```bash
git init
git add -A
git commit -m "chore: scaffold project structure with Vite + Sharp"
```

Expected: `git log` shows the initial commit.

---

### Task 2: Core Palette Module

**Files:**
- Create: `src/core/palette.js`
- Create: `src/core/palette.test.js`

**Interfaces:**
- Produces: `quantizeColor(r, g, b, a, palette)` → `{r, g, b, a}`, `DEFAULT_PALETTE` (string[])

- [ ] **Step 1: Write the failing test**

`src/core/palette.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { quantizeColor, DEFAULT_PALETTE } from './palette.js';

describe('palette', () => {
  it('provides default palette with 16 colors', () => {
    assert.equal(DEFAULT_PALETTE.length, 16);
    assert.ok(DEFAULT_PALETTE[0].startsWith('#'));
  });

  it('quantizeColor finds exact match', () => {
    const result = quantizeColor(255, 0, 0, 255, DEFAULT_PALETTE);
    assert.deepEqual(result, { r: 255, g: 0, b: 0, a: 255 });
  });

  it('quantizeColor finds nearest color', () => {
    // Dark red should map to red (#ff0000)
    const result = quantizeColor(200, 10, 10, 255, DEFAULT_PALETTE);
    assert.equal(result.r, 255);
    assert.equal(result.g, 0);
    assert.equal(result.b, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test src/core/palette.test.js
```

Expected: FAIL — `MODULE_NOT_FOUND` or similar for missing `./palette.js`.

- [ ] **Step 3: Write minimal implementation**

`src/core/palette.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node --test src/core/palette.test.js
```

Expected: PASS — all 3 tests pass, no failures.

- [ ] **Step 5: Commit**

```bash
git add src/core/palette.js src/core/palette.test.js
git commit -m "feat: add palette module with quantizeColor and 16-color palette"
```

---

### Task 3: Core Processor Module

**Files:**
- Create: `src/core/processor.js`
- Create: `src/core/processor.test.js`

**Interfaces:**
- Produces: `toPixelArt(data, width, height, gridSize)` → `{r,g,b,a}[][]`
- Produces: `renderGrid(grid, cellSize)` → `{data: Uint8ClampedArray, width, height}`
- Produces: `hexToRGBA(hex)` → `{r,g,b,a}`, `rgbaToHex(color)` → `string`
- Produces: `gridToJSON(grid)` → `{size, pixels: string[][]}`
- Produces: `jsonToGrid(json)` → `{r,g,b,a}[][]`

- [ ] **Step 1: Write the failing test**

`src/core/processor.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toPixelArt, renderGrid, hexToRGBA, rgbaToHex, gridToJSON, jsonToGrid } from './processor.js';

describe('processor', () => {
  it('hexToRGBA converts #ff0000', () => {
    assert.deepEqual(hexToRGBA('#ff0000'), { r: 255, g: 0, b: 0, a: 255 });
  });

  it('hexToRGBA converts #000000', () => {
    assert.deepEqual(hexToRGBA('#000000'), { r: 0, g: 0, b: 0, a: 255 });
  });

  it('rgbaToHex converts color', () => {
    assert.equal(rgbaToHex({ r: 255, g: 0, b: 0, a: 255 }), '#ff0000');
  });

  it('rgbaToHex handles zero alpha', () => {
    assert.equal(rgbaToHex({ r: 0, g: 0, b: 0, a: 0 }), '#000000');
  });

  it('toPixelArt downsamples 4x4 image to 2x2 grid', () => {
    // Create a 4x4 RGBA image: top-left half red, bottom-right half blue
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        const idx = (y * 4 + x) * 4;
        data[idx] = 255; data[idx + 1] = 0; data[idx + 2] = 0; data[idx + 3] = 255; // red
      }
    }
    for (let y = 2; y < 4; y++) {
      for (let x = 2; x < 4; x++) {
        const idx = (y * 4 + x) * 4;
        data[idx] = 0; data[idx + 1] = 0; data[idx + 2] = 255; data[idx + 3] = 255; // blue
      }
    }
    // Fill the rest with green
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === 0 && data[i + 2] === 0) {
        data[i] = 0; data[i + 1] = 255; data[i + 2] = 0; data[i + 3] = 255;
      }
    }

    const grid = toPixelArt(data, 4, 4, 2);
    assert.equal(grid.length, 2);
    assert.equal(grid[0].length, 2);
    // Top-left cell samples from 0,0 region → red
    assert.equal(grid[0][0].r, 255);
    assert.equal(grid[0][0].g, 0);
    // Bottom-right cell samples from 3,3 region → blue
    assert.equal(grid[1][1].r, 0);
    assert.equal(grid[1][1].b, 255);
  });

  it('renderGrid produces correct size output', () => {
    const grid = [
      [{ r: 255, g: 0, b: 0, a: 255 }, { r: 0, g: 255, b: 0, a: 255 }],
      [{ r: 0, g: 0, b: 255, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }],
    ];
    const result = renderGrid(grid, 4);
    assert.equal(result.width, 8);  // 2*4
    assert.equal(result.height, 8); // 2*4
    assert.equal(result.data.length, 8 * 8 * 4);
  });

  it('gridToJSON and jsonToGrid round-trips', () => {
    const grid = [
      [{ r: 255, g: 0, b: 0, a: 255 }, { r: 0, g: 255, b: 0, a: 255 }],
      [{ r: 0, g: 0, b: 255, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }],
    ];
    const json = gridToJSON(grid);
    assert.equal(json.size, 2);
    assert.equal(json.pixels[0][0], '#ff0000');
    const back = jsonToGrid(json);
    assert.deepEqual(back, grid);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test src/core/processor.test.js
```

Expected: FAIL — MODULE_NOT_FOUND for missing processor.js.

- [ ] **Step 3: Write the implementation**

`src/core/processor.js`:

```js
// ─── Color conversion utilities ────────────────────────────────────

export function hexToRGBA(hex) {
  const value = parseInt(hex.slice(1), 16);
  if (hex.length === 7) {
    return {
      r: (value >> 16) & 0xff,
      g: (value >> 8) & 0xff,
      b: value & 0xff,
      a: 255,
    };
  }
  // #rrggbbaa
  return {
    r: (value >> 24) & 0xff,
    g: (value >> 16) & 0xff,
    b: (value >> 8) & 0xff,
    a: value & 0xff,
  };
}

export function rgbaToHex({ r, g, b, a }) {
  if (a === 0) return '#000000';
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

// ─── Pixel art core algorithms ────────────────────────────────────

/**
 * Downsample an image to a pixel grid using nearest-neighbor sampling.
 * @param {Uint8ClampedArray} data - RGBA flat array
 * @param {number} width - Source image width in pixels
 * @param {number} height - Source image height in pixels
 * @param {number} gridSize - Target grid size (e.g. 16 = 16×16)
 * @returns {{r:number,g:number,b:number,a:number}[][]} grid[y][x]
 */
export function toPixelArt(data, width, height, gridSize) {
  const grid = [];
  for (let gy = 0; gy < gridSize; gy++) {
    const row = [];
    for (let gx = 0; gx < gridSize; gx++) {
      // Center of this grid cell in source coordinates
      const sx = Math.floor((gx + 0.5) * width / gridSize);
      const sy = Math.floor((gy + 0.5) * height / gridSize);
      const idx = (sy * width + sx) * 4;
      row.push({
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: data[idx + 3],
      });
    }
    grid.push(row);
  }
  return grid;
}

/**
 * Render a pixel grid to a full-size RGBA flat array.
 * @param {{r:number,g:number,b:number,a:number}[][]} grid
 * @param {number} cellSize - Output pixels per grid cell
 * @returns {{data:Uint8ClampedArray, width:number, height:number}}
 */
export function renderGrid(grid, cellSize = 32) {
  const gridSize = grid.length;
  const outSize = gridSize * cellSize;
  const data = new Uint8ClampedArray(outSize * outSize * 4);

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const { r, g, b, a } = grid[gy][gx];
      for (let dy = 0; dy < cellSize; dy++) {
        for (let dx = 0; dx < cellSize; dx++) {
          const px = (gy * cellSize + dy) * outSize + (gx * cellSize + dx);
          const idx = px * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = a;
        }
      }
    }
  }
  return { data, width: outSize, height: outSize };
}

// ─── JSON serialization ─────────────────────────────────────────────

export function gridToJSON(grid) {
  return {
    size: grid.length,
    pixels: grid.map(row => row.map(rgbaToHex)),
  };
}

export function jsonToGrid(json) {
  const { size, pixels } = json;
  const grid = [];
  for (let y = 0; y < size; y++) {
    grid.push(pixels[y].map(hex => hexToRGBA(hex)));
  }
  return grid;
}
```

- [ ] **Step 4: Run tests to verify passes**

```bash
node --test src/core/processor.test.js src/core/palette.test.js
```

Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/processor.js src/core/processor.test.js
git commit -m "feat: add core processor with pixel art conversion, rendering, JSON serialization"
```

---

### Task 4: CLI Image I/O Module

**Files:**
- Create: `src/cli/image.js`

**Interfaces:**
- Produces: `readImage(filePath)` → `{data: Uint8ClampedArray, width, height}`
- Produces: `writePNG(data, width, height, filePath)` → `Promise<void>`

- [ ] **Step 1: Write the implementation**

`src/cli/image.js`:

```js
import sharp from 'sharp';

/**
 * Read an image file and return raw RGBA pixel data.
 * @param {string} filePath
 * @returns {Promise<{data: Uint8ClampedArray, width: number, height: number}>}
 */
export async function readImage(filePath) {
  const metadata = await sharp(filePath).metadata();
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
```

- [ ] **Step 2: Quick smoke test**

```bash
node --eval "
import { writePNG } from './src/cli/image.js';
import { renderGrid } from './src/core/processor.js';
const grid = [[{r:255,g:0,b:0,a:255},{r:0,g:255,b:0,a:255}],[{r:0,g:0,b:255,a:255},{r:255,g:255,b:255,a:255}]];
const {data,width,height} = renderGrid(grid, 16);
writePNG(data, width, height, 'test-output.png').then(() => console.log('OK: test-output.png created'));
"
```

Expected: `test-output.png` is created (4 color squares: red, green, blue, white). Clean it up after.

```bash
rm test-output.png
```

- [ ] **Step 3: Commit**

```bash
git add src/cli/image.js
git commit -m "feat: add CLI image I/O module wrapping Sharp"
```

---

### Task 5: CLI Draw Command

**Files:**
- Create: `cli.js` (shared CLI entry — draw + convert)
- Create: `src/cli/cli.test.js`

**Interfaces:**
- Produces: `parseArgs(argv)` → `{command, size, grid, file, output, input}`
- Produces: `cmdDraw(size, gridData, outputPath)` — orchestrates draw flow

- [ ] **Step 1: Write the failing test**

`src/cli/cli.test.js`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = join(__dirname, '..', 'cli.js');

describe('cli draw', () => {
  const outFile = join(__dirname, '..', 'test-draw-output.png');

  after(() => {
    try { unlinkSync(outFile); } catch {}
  });

  it('draws a 2x2 grid from inline JSON', () => {
    const grid = '[["#ff0000","#00ff00"],["#0000ff","#ffffff"]]';
    const result = execSync(`node "${CLI}" draw --size 2 --grid '${grid}' -o "${outFile}"`, { encoding: 'utf-8' });
    assert.ok(result.includes('OK'));
    assert.ok(existsSync(outFile));
    const stat = import('node:fs').then(fs => {
      const stats = fs.statSync(outFile);
      assert.ok(stats.size > 0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify fails**

```bash
node --test src/cli/cli.test.js
```

Expected: FAIL — CLI not implemented yet.

- [ ] **Step 3: Write implementation**

`cli.js` — partial (draw command only for now):

```js
#!/usr/bin/env node
import { jsonToGrid, renderGrid } from './src/core/processor.js';
import { writePNG } from './src/cli/image.js';
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

async function main() {
  const { command, size, grid, file, output } = parseArgs(process.argv);

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
```

- [ ] **Step 4: Run test to verify passes**

```bash
node --test src/cli/cli.test.js
```

Expected: PASS.

- [ ] **Step 5: Manual test with varied input**

```bash
node cli.js draw --size 2 --grid '[["#ff0000","#00ff00"],["#0000ff","#ffffff"]]' -o test-draw.png
```

Expected: `test-draw.png` created with 64×64 image (2×2 grid, 32px per cell). Red top-left, green top-right, blue bottom-left, white bottom-right.

```bash
rm test-draw.png
```

- [ ] **Step 6: Commit**

```bash
git add cli.js src/cli/cli.test.js
git commit -m "feat: add CLI draw command with --grid and --file support"
```

---

### Task 6: CLI Convert Command

**Files:**
- Modify: `cli.js`
- Modify: `src/cli/cli.test.js`

**Interfaces:**
- Consumes: `readImage(filePath)` from Task 4, `toPixelArt()` from Task 3
- Produces: `cmdConvert(filePath, size, outputPath)` — orchestrates convert flow

- [ ] **Step 1: Add test for convert**

Add to `src/cli/cli.test.js`:

```js
describe('cli convert', () => {
  const outFile = join(__dirname, '..', 'test-convert-output.png');
  // Create a small test PNG with sharp
  const testInput = join(__dirname, '..', 'test-input.png');

  before(async () => {
    // Create a small test image (4 red pixels, 4 green, 4 blue, 4 white)
    const { writePNG } = await import('./image.js');
    const { renderGrid } = await import('../core/processor.js');
    const grid = [
      [{ r: 255, g: 0, b: 0, a: 255 }, { r: 0, g: 255, b: 0, a: 255 }],
      [{ r: 0, g: 0, b: 255, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }],
    ];
    const { data, width, height } = renderGrid(grid, 4);
    await writePNG(data, width, height, testInput);
  });

  after(() => {
    try { unlinkSync(outFile); } catch {}
    try { unlinkSync(testInput); } catch {}
  });

  it('converts an image to pixel art', () => {
    const result = execSync(
      `node "${CLI}" convert "${testInput}" --size 2 -o "${outFile}"`,
      { encoding: 'utf-8' }
    );
    assert.ok(result.includes('OK'));
    assert.ok(existsSync(outFile));
  });
});
```

- [ ] **Step 2: Run test to verify fails**

```bash
node --test src/cli/cli.test.js
```

Expected: FAIL — `cmdConvert` not implemented.

- [ ] **Step 3: Add convert command to cli.js**

Add to the `main()` function after the `draw` block:

```js
  } else if (command === 'convert') {
    if (!input) {
      console.error('Error: provide an image path');
      console.error('Usage: node cli.js convert <image> --size <n> -o <file>');
      process.exit(1);
    }
    await cmdConvert(input, size, output);
  } else if (command === '--help' || command === '-h' || command === undefined) {
    showHelp();
```

Add `cmdConvert` function:

```js
import { readImage } from './src/cli/image.js';

async function cmdConvert(imagePath, size, outputPath) {
  const { data, width, height } = await readImage(imagePath);
  const grid = toPixelArt(data, width, height, size);
  const result = renderGrid(grid, CELL_SIZE);
  await writePNG(result.data, result.width, result.height, outputPath);
  console.log(`OK: pixel art saved to ${outputPath}`);
}
```

Add import for `toPixelArt` at top:

```js
import { jsonToGrid, renderGrid, toPixelArt } from './src/core/processor.js';
```

- [ ] **Step 4: Run test to verify passes**

```bash
node --test src/cli/cli.test.js
```

Expected: PASS.

- [ ] **Step 5: Manual test**

```bash
# Pick any image to test, e.g.:
# node cli.js convert some-photo.jpg --size 16 -o output.png
```

- [ ] **Step 6: Commit**

```bash
git add cli.js src/cli/cli.test.js
git commit -m "feat: add CLI convert command for image-to-pixel-art"
```

---

### Task 7: CLI Help and Polish

**Files:**
- Modify: `cli.js`

- [ ] **Step 1: Add showHelp function and wire it up**

In `cli.js`, add:

```js
function showHelp() {
  console.log(`
🎨 像素画生成器 CLI — Pixel Art Generator

用法:
  node cli.js draw --size <n> --grid <json> -o <file>
  node cli.js draw --size <n> --file <path> -o <file>
  node cli.js convert <image> --size <n> -o <file>
  node cli.js --help

命令:
  draw      从颜色网格生成像素画
  convert   将图片转换为像素画

选项:
  --size <n>     网格尺寸（如 16 = 16×16），默认 16
  --grid <json>  颜色二维数组 JSON
  --file <path>  JSON 文件路径（格式同 draw）
  -o <file>      输出图片路径，默认 output.png
  --help         显示帮助信息

示例:
  node cli.js draw --size 2 --grid '[["#ff0000","#00ff00"],["#0000ff","#ffffff"]]' -o art.png
  node cli.js convert photo.jpg --size 32 -o pixel-art.png
`);
}
```

Update the `main()` error handling to pass through Sharp error messages clearly:

```js
main().catch(err => {
  if (err.code === 'ENOENT') {
    console.error(`Error: 文件不存在 — ${err.path}`);
    process.exit(2);
  }
  if (err.message?.includes('input file')) {
    console.error(`Error: 无法读取图片 — ${err.message}`);
    process.exit(2);
  }
  console.error('Error:', err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Verify --help works**

```bash
node cli.js --help
```

Expected: colored/bordered help text displaying all commands.

- [ ] **Step 3: Verify error handling**

```bash
node cli.js draw --size 16 -o out.png
# Expected: Error: use --grid <json> or --file <path>

node cli.js convert nonexistent.jpg
# Expected: Error: 文件不存在
```

- [ ] **Step 4: Commit**

```bash
git add cli.js
git commit -m "feat: add --help and polish error handling with Chinese messages"
```

---

### Task 8: GUI HTML/CSS Structure

**Files:**
- Create: `index.html`
- Create: `style.css`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🎨 像素画工坊</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header>
    <h1>🎨 像素画工坊</h1>
    <nav class="tabs">
      <button class="tab-btn active" data-tab="convert">转换</button>
      <button class="tab-btn" data-tab="draw">绘画</button>
    </nav>
  </header>

  <main>
    <!-- Convert Tab -->
    <section id="tab-convert" class="tab-content active">
      <div class="convert-layout">
        <div class="upload-area" id="upload-area">
          <div class="upload-placeholder">
            <p>拖拽图片到这里，或点击选择</p>
            <input type="file" id="file-input" accept="image/*" hidden>
          </div>
          <img id="preview-original" class="preview-img" hidden>
        </div>
        <div class="result-area">
          <canvas id="canvas-convert" hidden></canvas>
          <p class="empty-hint" id="convert-hint">上传图片后点击"转换"</p>
        </div>
      </div>
      <div class="controls">
        <label>网格尺寸：
          <select id="convert-size">
            <option value="8">8×8</option>
            <option value="16" selected>16×16</option>
            <option value="24">24×24</option>
            <option value="32">32×32</option>
            <option value="48">48×48</option>
            <option value="64">64×64</option>
          </select>
        </label>
        <button id="btn-convert" class="btn-primary">转换</button>
        <button id="btn-export-convert" class="btn-secondary" disabled>导出 PNG</button>
      </div>
    </section>

    <!-- Draw Tab -->
    <section id="tab-draw" class="tab-content">
      <div class="draw-area">
        <canvas id="canvas-draw"></canvas>
      </div>
      <div class="controls">
        <label>颜色：<input type="color" id="draw-color" value="#ff0000"></label>
        <button id="btn-eraser" class="btn-secondary">橡皮擦</button>
        <button id="btn-clear" class="btn-secondary">清空</button>
        <label>网格尺寸：
          <select id="draw-size">
            <option value="8">8×8</option>
            <option value="16" selected>16×16</option>
            <option value="24">24×24</option>
            <option value="32">32×32</option>
          </select>
        </label>
        <button id="btn-export-draw" class="btn-primary">导出 PNG</button>
      </div>
    </section>
  </main>

  <script type="module" src="/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create style.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #1a1a2e;
  color: #e0e0e0;
  min-height: 100vh;
}

header {
  background: #16213e;
  padding: 1rem 2rem;
  display: flex;
  align-items: center;
  gap: 2rem;
  border-bottom: 2px solid #0f3460;
}

header h1 { font-size: 1.5rem; }

.tabs { display: flex; gap: 0.5rem; }

.tab-btn {
  padding: 0.5rem 1.5rem;
  border: 1px solid #0f3460;
  background: transparent;
  color: #a0a0b0;
  cursor: pointer;
  border-radius: 4px;
  font-size: 1rem;
}
.tab-btn.active {
  background: #0f3460;
  color: #fff;
  border-color: #e94560;
}

.tab-content { display: none; padding: 2rem; }
.tab-content.active { display: block; }

.convert-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 1rem;
}

.upload-area {
  border: 2px dashed #0f3460;
  border-radius: 8px;
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}
.upload-area:hover { border-color: #e94560; }

.upload-placeholder { text-align: center; color: #666; }
.preview-img { max-width: 100%; max-height: 300px; object-fit: contain; }

.result-area {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0d0d1a;
  border-radius: 8px;
  overflow: hidden;
}

.empty-hint { color: #555; font-size: 1.1rem; }

canvas { image-rendering: pixelated; image-rendering: crisp-edges; }

.controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  padding: 1rem 0;
}

.controls label { display: flex; align-items: center; gap: 0.5rem; }

select, input[type="color"] {
  background: #16213e;
  color: #e0e0e0;
  border: 1px solid #0f3460;
  padding: 0.4rem;
  border-radius: 4px;
}

.btn-primary, .btn-secondary {
  padding: 0.5rem 1.2rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.95rem;
}
.btn-primary { background: #e94560; color: #fff; }
.btn-primary:hover { background: #d63850; }
.btn-primary:disabled { background: #555; cursor: not-allowed; }
.btn-secondary { background: #0f3460; color: #e0e0e0; }
.btn-secondary:hover { background: #1a4a80; }

.draw-area {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  background: #0d0d1a;
  border-radius: 8px;
}
```

- [ ] **Step 3: Verify Vite serves the page**

```bash
# In a separate terminal or as a background task:
npx vite --open
```

Expected: Browser opens showing "🎨 像素画工坊" with two tabs and the converter/drawer interface.

- [ ] **Step 4: Commit**

```bash
git add index.html style.css
git commit -m "feat: add GUI structure with dual-tab layout and styling"
```

---

### Task 9: GUI Canvas Drawing Module

**Files:**
- Create: `src/gui/canvas.js`

**Interfaces:**
- Produces: `class PixelCanvas` — manages a pixel grid with mouse drawing

- [ ] **Step 1: Write the implementation**

`src/gui/canvas.js`:

```js
import { renderGrid, gridToJSON, jsonToGrid, hexToRGBA, rgbaToHex } from '../core/processor.js';

const CELL_SIZE = 24; // Display pixels per grid cell on screen

export class PixelCanvas {
  /**
   * @param {HTMLCanvasElement} canvasEl
   * @param {number} gridSize - Width and height of the pixel grid
   */
  constructor(canvasEl, gridSize = 16) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.gridSize = gridSize;
    this.drawing = false;
    this.color = '#ff0000';
    this.eraser = false;

    // Initialize empty grid (all white/transparent)
    this.grid = this.createEmptyGrid(gridSize);

    this.setupCanvas();
    this.setupEvents();
    this.render();
  }

  createEmptyGrid(size) {
    return Array.from({ length: size }, () =>
      Array.from({ length: size }, () => ({ r: 255, g: 255, b: 255, a: 255 }))
    );
  }

  setupCanvas() {
    const displaySize = this.gridSize * CELL_SIZE;
    this.canvas.width = displaySize;
    this.canvas.height = displaySize;
    // CSS size matches canvas size exactly
    this.canvas.style.width = displaySize + 'px';
    this.canvas.style.height = displaySize + 'px';
  }

  setupEvents() {
    const getCell = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
      const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);
      return { x, y };
    };

    const paint = (x, y) => {
      if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return;
      if (this.eraser) {
        this.grid[y][x] = { r: 255, g: 255, b: 255, a: 255 };
      } else {
        const { r, g, b } = hexToRGBA(this.color);
        this.grid[y][x] = { r, g, b, a: 255 };
      }
    };

    this.canvas.addEventListener('mousedown', (e) => {
      this.drawing = true;
      const { x, y } = getCell(e);
      paint(x, y);
      this.render();
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.drawing) return;
      const { x, y } = getCell(e);
      paint(x, y);
      this.render();
    });

    window.addEventListener('mouseup', () => { this.drawing = false; });
    this.canvas.addEventListener('mouseleave', () => { this.drawing = false; });
  }

  render() {
    const ctx = this.ctx;
    const size = this.gridSize * CELL_SIZE;

    // Draw grid using renderGrid for the pixel blocks
    const { data } = renderGrid(this.grid, CELL_SIZE);
    const imageData = new ImageData(data, size, size);
    ctx.putImageData(imageData, 0, 0);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= this.gridSize; i++) {
      const pos = i * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }
  }

  setGridSize(newSize) {
    const oldGrid = this.grid;
    const newGrid = this.createEmptyGrid(newSize);
    // Copy overlapping pixels
    for (let y = 0; y < Math.min(oldGrid.length, newSize); y++) {
      for (let x = 0; x < Math.min(oldGrid[0].length, newSize); x++) {
        newGrid[y][x] = oldGrid[y][x];
      }
    }
    this.grid = newGrid;
    this.gridSize = newSize;
    this.setupCanvas();
    this.render();
  }

  setColor(color) {
    this.color = color;
    this.eraser = false;
  }

  toggleEraser() {
    this.eraser = !this.eraser;
  }

  clear() {
    this.grid = this.createEmptyGrid(this.gridSize);
    this.render();
  }

  loadJSON(json) {
    this.grid = jsonToGrid(json);
    this.gridSize = json.size;
    this.setupCanvas();
    this.render();
  }

  toJSON() {
    return gridToJSON(this.grid);
  }

  /** Export current grid as PNG download */
  exportPNG() {
    const exportCellSize = 32; // Higher res for export
    const { data, width, height } = renderGrid(this.grid, exportCellSize);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = new ImageData(data, width, height);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }
}
```

- [ ] **Step 2: Verify by importing in browser (next task wires it)**

No test for GUI — visual verification in Task 11.

- [ ] **Step 3: Commit**

```bash
git add src/gui/canvas.js
git commit -m "feat: add PixelCanvas class for drawing pixel art with mouse"
```

---

### Task 10: GUI Upload & Export Modules

**Files:**
- Create: `src/gui/upload.js`
- Create: `src/gui/export.js`

**Interfaces:**
- Produces: `setupUpload(onImageData)` → handles file input, calls back with ImageData
- Produces: `downloadPNG(dataURL, filename)` → triggers browser download

- [ ] **Step 1: Create upload.js**

```js
/**
 * Set up drag-and-drop and click-to-upload for image files.
 * @param {HTMLElement} area - Upload drop zone element
 * @param {HTMLInputElement} input - Hidden file input
 * @param {(data: ImageData, img: HTMLImageElement) => void} onLoad - Callback with image data
 */
export function setupUpload(area, input, onLoad) {
  area.addEventListener('click', () => input.click());

  input.addEventListener('change', () => {
    if (input.files[0]) loadFile(input.files[0]);
  });

  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.style.borderColor = '#e94560';
  });
  area.addEventListener('dragleave', () => {
    area.style.borderColor = '#0f3460';
  });
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.style.borderColor = '#0f3460';
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });

  function loadFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('图片太大（超过 10MB），请压缩后重试');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Draw image to a hidden canvas to get ImageData
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        onLoad(imageData, img);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}
```

- [ ] **Step 2: Create export.js**

```js
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
```

- [ ] **Step 3: Commit**

```bash
git add src/gui/upload.js src/gui/export.js
git commit -m "feat: add image upload and PNG download modules"
```

---

### Task 11: GUI Main Integration

**Files:**
- Create: `main.js`

- [ ] **Step 1: Write main.js**

```js
import { PixelCanvas } from './src/gui/canvas.js';
import { setupUpload } from './src/gui/upload.js';
import { downloadPNG } from './src/gui/export.js';
import { toPixelArt, renderGrid } from './src/core/processor.js';

// ─── Tab switching ─────────────────────────────────────────────────

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = {
  convert: document.getElementById('tab-convert'),
  draw: document.getElementById('tab-draw'),
};

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    Object.values(tabContents).forEach(tc => tc.classList.remove('active'));
    tabContents[btn.dataset.tab].classList.add('active');
  });
});

// ─── Draw tab ──────────────────────────────────────────────────────

const drawCanvas = document.getElementById('canvas-draw');
const pixelCanvas = new PixelCanvas(drawCanvas, 16);

document.getElementById('draw-color').addEventListener('input', (e) => {
  pixelCanvas.setColor(e.target.value);
});

document.getElementById('btn-eraser').addEventListener('click', () => {
  pixelCanvas.toggleEraser();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  if (confirm('确定清空画布？')) pixelCanvas.clear();
});

document.getElementById('draw-size').addEventListener('change', (e) => {
  pixelCanvas.setGridSize(parseInt(e.target.value));
});

document.getElementById('btn-export-draw').addEventListener('click', () => {
  const dataURL = pixelCanvas.exportPNG();
  downloadPNG(dataURL, 'pixel-art-draw.png');
});

// ─── Convert tab ───────────────────────────────────────────────────

const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');
const previewImg = document.getElementById('preview-original');
const canvasConvert = document.getElementById('canvas-convert');
const convertHint = document.getElementById('convert-hint');
const btnConvert = document.getElementById('btn-convert');
const btnExportConvert = document.getElementById('btn-export-convert');
const convertSizeSelect = document.getElementById('convert-size');

let lastImageData = null;
let lastConvertResult = null;

setupUpload(uploadArea, fileInput, (imageData, img) => {
  lastImageData = imageData;
  previewImg.src = img.src;
  previewImg.hidden = false;
  uploadArea.querySelector('.upload-placeholder').style.display = 'none';
  convertHint.hidden = false;
  canvasConvert.hidden = true;
  btnExportConvert.disabled = true;
});

btnConvert.addEventListener('click', async () => {
  if (!lastImageData) {
    alert('请先上传图片');
    return;
  }

  const size = parseInt(convertSizeSelect.value);
  const img = previewImg;

  // Compute source image dimensions (from the original image data)
  const { data, width, height } = lastImageData;

  // Use toPixelArt via dynamic import to avoid circular issues, or directly
  const { toPixelArt, renderGrid } = await import('./src/core/processor.js');

  const grid = toPixelArt(data, width, height, size);
  const cellSize = Math.max(2, Math.floor(512 / size));
  const result = renderGrid(grid, cellSize);

  // Display on canvas
  canvasConvert.width = result.width;
  canvasConvert.height = result.height;
  canvasConvert.style.width = Math.min(result.width, 512) + 'px';
  canvasConvert.style.height = Math.min(result.height, 512) + 'px';
  const ctx = canvasConvert.getContext('2d');
  const imageData = new ImageData(result.data, result.width, result.height);
  ctx.putImageData(imageData, 0, 0);

  canvasConvert.hidden = false;
  convertHint.hidden = true;
  btnExportConvert.disabled = false;

  lastConvertResult = { grid, cellSize };
});

btnExportConvert.addEventListener('click', () => {
  if (!lastConvertResult) return;
  const { grid, cellSize } = lastConvertResult;
  const exportCellSize = 16;
  const { data, width, height } = renderGrid(grid, exportCellSize);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  ctx.putImageData(new ImageData(data, width, height), 0, 0);
  downloadPNG(c.toDataURL('image/png'), 'pixel-art-convert.png');
});
```

- [ ] **Step 2: Verify the full GUI works**

```bash
npx vite --open
```

Test flow:
1. **Convert tab**: Click upload area → select an image → click "转换" → pixel art preview appears → click "导出 PNG"
2. **Draw tab**: Pick color → draw on canvas → resize grid → toggle eraser → export
3. **Tab switching**: Verify both tabs work independently

Expected: All interactions work smoothly.

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "feat: integrate GUI with tab switching, drawing, upload, and export"
```

---

### Task 12: Final Polish & Verification

**Files:**
- Create: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Write README.md**

```markdown
# 🎨 像素画工坊 — Pixel Art Generator

纯前端像素画生成器，支持图片转换、手动绘画、AI 调用。

## 快速开始

```bash
npm install
npm run dev      # 启动 GUI（浏览器）
npm run cli      # CLI 帮助信息
```

## GUI 使用

- **转换 Tab**：上传图片 → 选择像素尺寸 → 转换 → 导出 PNG
- **绘画 Tab**：选择颜色 → 在画布上绘画 → 导出 PNG

## CLI 使用

```bash
# AI 自主创作
node cli.js draw --size 16 --grid '[["#ff0000","#00ff00"],["#0000ff","#ffffff"]]' -o art.png

# 从 JSON 文件读取
node cli.js draw --size 32 --file design.json -o art.png

# 图片转像素画
node cli.js convert photo.jpg --size 32 -o pixel-art.png

# 帮助
node cli.js --help
```

## CLI JSON 格式

```json
{
  "size": 16,
  "pixels": [
    ["#ff0000", "#00ff00", ...],
    ...
  ]
}
```

## 技术栈

- 前端：Vite + 原生 JS + Canvas API
- CLI：Node.js + Sharp
- 测试：Node 内置 test runner

## 项目结构

```
├── index.html          # GUI 页面
├── style.css           # GUI 样式
├── main.js             # GUI 入口
├── cli.js              # CLI 入口
├── src/
│   ├── core/           # 核心算法（GUI + CLI 共享）
│   │   ├── processor.js
│   │   └── palette.js
│   ├── gui/            # GUI 模块
│   │   ├── canvas.js
│   │   ├── upload.js
│   │   └── export.js
│   └── cli/            # CLI 模块
│       └── image.js
└── docs/
```

## 开发

```bash
npm test                # 运行测试
npm run build           # 构建生产版本
```
```

- [ ] **Step 2: Update .gitignore** (add dist output reference if needed)

```bash
# .gitignore already has node_modules/ and dist/
echo "" >> .gitignore
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 4: Final git commit**

```bash
git add README.md
git commit -m "docs: add README with usage instructions"
```

- [ ] **Step 5: View git log**

```bash
git log --oneline
```

Expected: clean commit history showing incremental development.

```bash
git status
```

Expected: working tree clean, no untracked files.
```

