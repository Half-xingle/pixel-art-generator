import { PixelCanvas } from './src/gui/canvas.js';
import { setupUpload } from './src/gui/upload.js';
import { downloadPNG } from './src/gui/export.js';
import { toPixelArt, renderGrid } from './src/core/processor.js';

// ─── Helper: apply ratio constraint ──────────────────────────────────

/** Set up a pair of width/height inputs linked by a ratio constraint.
 *  `resolveRatio(aspect)` returns {w, h} given the aspect ratio (w/h).
 *  Called on upload to set initial values. */
function linkSizeInputs(wInput, hInput, getRatio) {
  let active = false; // whether ratio constraint is active

  function constrainFromWidth() {
    if (!active) return;
    const w = parseInt(wInput.value);
    if (!w || w < 1) return;
    const ratio = getRatio();
    if (!ratio) return;
    const h = w * ratio.rh / ratio.rw;
    if (!Number.isInteger(h)) {
      alert(`宽 ${w} 按 ${ratio.rw}:${ratio.rh} 比例计算高为 ${h}，不是整数。\n请调整宽度。`);
      wInput.value = '';
      wInput.focus();
      return;
    }
    hInput.value = h;
  }

  function constrainFromHeight() {
    if (!active) return;
    const h = parseInt(hInput.value);
    if (!h || h < 1) return;
    const ratio = getRatio();
    if (!ratio) return;
    const w = h * ratio.rw / ratio.rh;
    if (!Number.isInteger(w)) {
      alert(`高 ${h} 按 ${ratio.rw}:${ratio.rh} 比例计算宽为 ${w}，不是整数。\n请调整高度。`);
      hInput.value = '';
      hInput.focus();
      return;
    }
    wInput.value = w;
  }

  wInput.addEventListener('change', () => { constrainFromWidth(); });
  hInput.addEventListener('change', () => { constrainFromHeight(); });

  return {
    setActive(a) { active = a; },
    isActive() { return active; },
  };
}

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
const drawWidth = document.getElementById('draw-width');
const drawHeight = document.getElementById('draw-height');
const pixelCanvas = new PixelCanvas(drawCanvas, 16, 16);

let drawRatio = null; // {rw, rh} or null for free mode
const drawSizeLink = linkSizeInputs(drawWidth, drawHeight, () => drawRatio);

function applyDrawSize() {
  const w = Math.max(1, parseInt(drawWidth.value) || 16);
  const h = Math.max(1, parseInt(drawHeight.value) || 16);
  pixelCanvas.setGridSize(w, h);
}

drawWidth.addEventListener('change', applyDrawSize);
drawHeight.addEventListener('change', applyDrawSize);

// Ratio presets for draw tab
document.querySelectorAll('#tab-draw .ratio-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const alreadyActive = btn.classList.contains('active');
    document.querySelectorAll('#tab-draw .ratio-btn').forEach(b => b.classList.remove('active'));

    if (alreadyActive) {
      // Toggle off — free mode
      drawRatio = null;
      drawSizeLink.setActive(false);
      return;
    }

    btn.classList.add('active');
    const [rw, rh] = btn.dataset.ratio.split(':').map(Number);
    drawRatio = { rw, rh };
    drawSizeLink.setActive(true);

    // Apply ratio to current values
    const curW = parseInt(drawWidth.value) || 16;
    const h = curW * rh / rw;
    if (!Number.isInteger(h)) {
      // Try from height instead
      const curH = parseInt(drawHeight.value) || 16;
      const w = curH * rw / rh;
      if (Number.isInteger(w)) {
        drawWidth.value = w;
        drawHeight.value = curH;
      } else {
        // Default to a nice base size
        drawWidth.value = rw * 4;
        drawHeight.value = rh * 4;
      }
    } else {
      drawHeight.value = h;
    }
    applyDrawSize();
  });
});

document.getElementById('draw-color').addEventListener('input', (e) => {
  pixelCanvas.setColor(e.target.value);
});

document.getElementById('btn-eraser').addEventListener('click', () => {
  pixelCanvas.toggleEraser();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  if (confirm('确定清空画布？')) pixelCanvas.clear();
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
const convertWidth = document.getElementById('convert-width');
const convertHeight = document.getElementById('convert-height');

let lastImageData = null;
let lastConvertResult = null;
let originalAspect = null; // uploaded image's aspect ratio

const convertSizeLink = linkSizeInputs(convertWidth, convertHeight, () => {
  // If "auto" is active, use the image's original ratio
  const autoBtn = document.querySelector('#tab-convert .ratio-btn[data-ratio="auto"]');
  if (autoBtn?.classList.contains('active') && originalAspect) {
    return { rw: Math.round(originalAspect * 100), rh: 100 };
  }
  // Otherwise use the selected ratio preset
  const active = document.querySelector('#tab-convert .ratio-btn.active');
  if (active && active.dataset.ratio !== 'auto') {
    const [rw, rh] = active.dataset.ratio.split(':').map(Number);
    return { rw, rh };
  }
  return null;
});

setupUpload(uploadArea, fileInput, (imageData, img) => {
  lastImageData = imageData;
  originalAspect = imageData.width / imageData.height;

  // Auto-detect: keep current width, calculate height from ratio
  const curW = parseInt(convertWidth.value) || 32;
  const h = Math.round(curW / originalAspect);
  if (h > 0) convertHeight.value = h;

  // Activate "自动" button
  document.querySelectorAll('#tab-convert .ratio-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('#tab-convert .ratio-btn[data-ratio="auto"]').classList.add('active');

  previewImg.src = img.src;
  previewImg.hidden = false;
  uploadArea.querySelector('.upload-placeholder').style.display = 'none';
  convertHint.hidden = false;
  canvasConvert.hidden = true;
  btnExportConvert.disabled = true;
});

// Ratio presets for convert tab
document.querySelectorAll('#tab-convert .ratio-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const alreadyActive = btn.classList.contains('active');

    if (alreadyActive) {
      // Toggle off — free mode
      document.querySelectorAll('#tab-convert .ratio-btn').forEach(b => b.classList.remove('active'));
      return;
    }

    document.querySelectorAll('#tab-convert .ratio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (btn.dataset.ratio === 'auto' && originalAspect) {
      const curW = parseInt(convertWidth.value) || 32;
      const h = Math.round(curW / originalAspect);
      if (h > 0) convertHeight.value = h;
    } else if (btn.dataset.ratio !== 'auto') {
      const [rw, rh] = btn.dataset.ratio.split(':').map(Number);
      const curW = parseInt(convertWidth.value) || 32;
      const h = curW * rh / rw;
      if (!Number.isInteger(h)) {
        // Try from height
        const curH = parseInt(convertHeight.value) || 32;
        const w = curH * rw / rh;
        if (Number.isInteger(w)) {
          convertWidth.value = w;
        } else {
          convertHeight.value = curW * rh / rw; // will be caught by input listener
          return;
        }
      } else {
        convertHeight.value = h;
      }
    }
  });
});

btnConvert.addEventListener('click', async () => {
  if (!lastImageData) {
    alert('请先上传图片');
    return;
  }

  const gridWidth = Math.max(1, parseInt(convertWidth.value) || 16);
  const gridHeight = Math.max(1, parseInt(convertHeight.value) || 16);
  const { data, width, height } = lastImageData;

  const grid = toPixelArt(data, width, height, gridWidth, gridHeight);
  const cellSize = Math.max(2, Math.floor(512 / Math.max(gridWidth, gridHeight)));
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

  lastConvertResult = { grid };
});

btnExportConvert.addEventListener('click', () => {
  if (!lastConvertResult) return;
  const { grid } = lastConvertResult;
  const exportCellSize = 16;
  const { data, width, height } = renderGrid(grid, exportCellSize);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  ctx.putImageData(new ImageData(data, width, height), 0, 0);
  downloadPNG(c.toDataURL('image/png'), 'pixel-art-convert.png');
});
