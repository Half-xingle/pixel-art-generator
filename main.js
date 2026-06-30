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

  const maxSize = Math.max(2, parseInt(convertSizeSelect.value) || 16);
  const { data, width, height } = lastImageData;

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

  lastConvertResult = { grid, cellSize };
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
