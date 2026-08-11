import { PixelCanvas } from './src/gui/canvas.js';
import { setupUpload } from './src/gui/upload.js';
import { downloadPNG, gridToPNGDataURL } from './src/gui/export.js';
import { toPixelArt, renderGrid } from './src/core/processor.js';

// ─── Ratio helpers ────────────────────────────────────────────────

/**
 * Derived dimension for a ratio. `ratio` is either an integer pair {rw,rh}
 * (strict: null when the result is not an integer) or a float aspect (w/h,
 * rounded result).
 */
function derivedFromWidth(ratio, w) {
  if (typeof ratio === 'number') return Math.round(w / ratio);
  const h = w * ratio.rh / ratio.rw;
  return Number.isInteger(h) ? h : null;
}

function derivedFromHeight(ratio, h) {
  if (typeof ratio === 'number') return Math.round(h * ratio);
  const w = h * ratio.rw / ratio.rh;
  return Number.isInteger(w) ? w : null;
}

/** Fit the current input values to `ratio`; returns true if a fit was applied. */
function fitToRatio(ratio, wInput, hInput) {
  const w = parseInt(wInput.value);
  const h = parseInt(hInput.value);
  if (w && w >= 1) {
    const d = derivedFromWidth(ratio, w);
    if (d !== null && d >= 1) { hInput.value = d; return true; }
  }
  if (h && h >= 1) {
    const d = derivedFromHeight(ratio, h);
    if (d !== null && d >= 1) { wInput.value = d; return true; }
  }
  return false;
}

/**
 * Link a width/height input pair to a ratio constraint.
 * `getRatio()` returns {rw,rh}, a float aspect (w/h), or null for free mode.
 * Returns { fit() } to apply the current ratio to the inputs programmatically.
 */
function linkSizeInputs(wInput, hInput, getRatio) {
  function constrainFromWidth() {
    const ratio = getRatio();
    if (!ratio) return;
    const w = parseInt(wInput.value);
    if (!w || w < 1) return;
    const h = derivedFromWidth(ratio, w);
    if (h === null) {
      alert(`宽 ${w} 按 ${ratio.rw}:${ratio.rh} 比例计算高不为整数。\n请调整宽度。`);
      wInput.value = '';
      wInput.focus();
      return;
    }
    hInput.value = h;
  }

  function constrainFromHeight() {
    const ratio = getRatio();
    if (!ratio) return;
    const h = parseInt(hInput.value);
    if (!h || h < 1) return;
    const w = derivedFromHeight(ratio, h);
    if (w === null) {
      alert(`高 ${h} 按 ${ratio.rw}:${ratio.rh} 比例计算宽不为整数。\n请调整高度。`);
      hInput.value = '';
      hInput.focus();
      return;
    }
    wInput.value = w;
  }

  wInput.addEventListener('change', constrainFromWidth);
  hInput.addEventListener('change', constrainFromHeight);

  return {
    fit() {
      const ratio = getRatio();
      return ratio !== null && fitToRatio(ratio, wInput, hInput);
    },
  };
}

/** One ratio-button group: toggle active, then hand the button to `apply` (null = free mode). */
function setupRatioButtons(scope, apply) {
  const buttons = document.querySelectorAll(`${scope} .ratio-btn`);
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const alreadyActive = btn.classList.contains('active');
      buttons.forEach(b => b.classList.remove('active'));
      if (alreadyActive) { apply(null); return; } // toggled off — free mode
      btn.classList.add('active');
      apply(btn);
    });
  });
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
linkSizeInputs(drawWidth, drawHeight, () => drawRatio);

function applyDrawSize() {
  const w = Math.max(1, parseInt(drawWidth.value) || 16);
  const h = Math.max(1, parseInt(drawHeight.value) || 16);
  pixelCanvas.setGridSize(w, h);
}

drawWidth.addEventListener('change', applyDrawSize);
drawHeight.addEventListener('change', applyDrawSize);

// Ratio presets for draw tab
setupRatioButtons('#tab-draw', (btn) => {
  if (btn === null) { drawRatio = null; return; }
  const [rw, rh] = btn.dataset.ratio.split(':').map(Number);
  drawRatio = { rw, rh };
  if (!fitToRatio(drawRatio, drawWidth, drawHeight)) {
    // Neither dimension fits the ratio — fall back to a base size
    drawWidth.value = rw * 4;
    drawHeight.value = rh * 4;
  }
  applyDrawSize();
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
  downloadPNG(pixelCanvas.exportPNG(), 'pixel-art-draw.png');
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
let lastConvertGrid = null;

const convertSizeLink = linkSizeInputs(convertWidth, convertHeight, () => {
  const active = document.querySelector('#tab-convert .ratio-btn.active');
  if (!active) return null;
  if (active.dataset.ratio === 'auto') {
    // The uploaded image's aspect ratio (w/h), or null if none uploaded
    return lastImageData ? lastImageData.width / lastImageData.height : null;
  }
  const [rw, rh] = active.dataset.ratio.split(':').map(Number);
  return { rw, rh };
});

setupUpload(uploadArea, fileInput, (imageData, img) => {
  lastImageData = imageData;

  // Activate 自动 and fit the height to the image's aspect
  document.querySelectorAll('#tab-convert .ratio-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('#tab-convert .ratio-btn[data-ratio="auto"]').classList.add('active');
  convertSizeLink.fit();

  previewImg.src = img.src;
  previewImg.hidden = false;
  uploadArea.querySelector('.upload-placeholder').style.display = 'none';
  convertHint.hidden = false;
  canvasConvert.hidden = true;
  btnExportConvert.disabled = true;
});

// Ratio presets for convert tab
setupRatioButtons('#tab-convert', (btn) => {
  if (btn === null) return; // free mode — nothing to reset
  if (btn.dataset.ratio === 'auto') {
    convertSizeLink.fit(); // fit to the uploaded image's aspect
  } else {
    const [rw, rh] = btn.dataset.ratio.split(':').map(Number);
    if (!fitToRatio({ rw, rh }, convertWidth, convertHeight)) {
      convertWidth.value = rw * 4;
      convertHeight.value = rh * 4;
    }
  }
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

  lastConvertGrid = grid;
});

btnExportConvert.addEventListener('click', () => {
  if (!lastConvertGrid) return;
  downloadPNG(gridToPNGDataURL(lastConvertGrid, 16), 'pixel-art-convert.png');
});
