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
const drawWidth = document.getElementById('draw-width');
const drawHeight = document.getElementById('draw-height');
const pixelCanvas = new PixelCanvas(drawCanvas, 16, 16);

// Apply size change when width or height input changes
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
    const [w, h] = btn.dataset.ratio.split(':').map(Number);
    drawWidth.value = w * 4; // scale up for reasonable grid size
    drawHeight.value = h * 4;
    btn.closest('.controls').querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
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

function applyAspectRatio(aspect) {
  const w = parseInt(convertWidth.value) || 16;
  let gw, gh;
  if (aspect >= 1) {
    gw = w;
    gh = Math.max(1, Math.round(w / aspect));
  } else {
    gw = Math.max(1, Math.round(w * aspect));
    gh = w;
  }
  convertWidth.value = gw;
  convertHeight.value = gh;
}

setupUpload(uploadArea, fileInput, (imageData, img) => {
  lastImageData = imageData;

  // Auto-detect aspect ratio from uploaded image
  const aspect = imageData.width / imageData.height;
  applyAspectRatio(aspect);

  // Show "自动" as active
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
    document.querySelectorAll('#tab-convert .ratio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (btn.dataset.ratio === 'auto' && lastImageData) {
      // Re-apply from original aspect ratio
      const aspect = lastImageData.width / lastImageData.height;
      applyAspectRatio(aspect);
    } else if (btn.dataset.ratio !== 'auto') {
      const [rw, rh] = btn.dataset.ratio.split(':').map(Number);
      const curW = parseInt(convertWidth.value) || 16;
      // Keep the set width, calculate height from ratio
      const h = Math.max(1, Math.round(curW * rh / rw));
      convertHeight.value = h;
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
