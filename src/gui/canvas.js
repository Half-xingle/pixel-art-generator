import { renderGrid, hexToRGBA } from '../core/processor.js';
import { gridToPNGDataURL } from './export.js';

const CELL_SIZE = 24; // Display pixels per grid cell on screen

export class PixelCanvas {
  /**
   * @param {HTMLCanvasElement} canvasEl
   * @param {number} gridWidth - Width of the pixel grid
   * @param {number} gridHeight - Height of the pixel grid
   */
  constructor(canvasEl, gridWidth = 16, gridHeight = 16) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.drawing = false;
    this.color = '#ff0000';
    this.eraser = false;

    this.grid = this.createEmptyGrid(gridWidth, gridHeight);

    this.setupCanvas();
    this.setupEvents();
    this.render();
  }

  createEmptyGrid(w, h) {
    return Array.from({ length: h }, () =>
      Array.from({ length: w }, () => ({ r: 255, g: 255, b: 255, a: 255 }))
    );
  }

  setupCanvas() {
    const displayW = this.gridWidth * CELL_SIZE;
    const displayH = this.gridHeight * CELL_SIZE;
    this.canvas.width = displayW;
    this.canvas.height = displayH;
    this.canvas.style.width = displayW + 'px';
    this.canvas.style.height = displayH + 'px';
  }

  setupEvents() {
    const getCell = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
      const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);
      return { x, y };
    };

    const paint = (x, y) => {
      if (x < 0 || x >= this.gridWidth || y < 0 || y >= this.gridHeight) return;
      if (this.eraser) {
        this.grid[y][x] = { r: 255, g: 255, b: 255, a: 255 };
      } else {
        const { r, g, b } = hexToRGBA(this.color);
        this.grid[y][x] = { r, g, b, a: 255 };
      }
      this.paintCell(x, y);
    };

    this.canvas.addEventListener('mousedown', (e) => {
      this.drawing = true;
      const { x, y } = getCell(e);
      paint(x, y);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.drawing) return;
      const { x, y } = getCell(e);
      paint(x, y);
    });

    window.addEventListener('mouseup', () => { this.drawing = false; });
    this.canvas.addEventListener('mouseleave', () => { this.drawing = false; });
  }

  render() {
    const ctx = this.ctx;
    const displayW = this.gridWidth * CELL_SIZE;
    const displayH = this.gridHeight * CELL_SIZE;

    const { data } = renderGrid(this.grid, CELL_SIZE);
    const imageData = new ImageData(data, displayW, displayH);
    ctx.putImageData(imageData, 0, 0);

    // Draw grid lines — one path so the canvas strokes once, not per line
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i <= this.gridWidth; i++) {
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, displayH);
    }
    for (let i = 0; i <= this.gridHeight; i++) {
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(displayW, i * CELL_SIZE);
    }
    ctx.stroke();
  }

  /** Repaint a single cell and its four grid lines (drag-painting hot path). */
  paintCell(x, y) {
    const { r, g, b, a } = this.grid[y][x];
    const ctx = this.ctx;
    const x0 = x * CELL_SIZE;
    const y0 = y * CELL_SIZE;
    ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
    ctx.fillRect(x0, y0, CELL_SIZE, CELL_SIZE);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + CELL_SIZE);
    ctx.moveTo(x0 + CELL_SIZE, y0); ctx.lineTo(x0 + CELL_SIZE, y0 + CELL_SIZE);
    ctx.moveTo(x0, y0); ctx.lineTo(x0 + CELL_SIZE, y0);
    ctx.moveTo(x0, y0 + CELL_SIZE); ctx.lineTo(x0 + CELL_SIZE, y0 + CELL_SIZE);
    ctx.stroke();
  }

  setGridSize(newW, newH) {
    const oldGrid = this.grid;
    const newGrid = this.createEmptyGrid(newW, newH);
    for (let y = 0; y < Math.min(oldGrid.length, newH); y++) {
      for (let x = 0; x < Math.min(oldGrid[0].length, newW); x++) {
        newGrid[y][x] = oldGrid[y][x];
      }
    }
    this.grid = newGrid;
    this.gridWidth = newW;
    this.gridHeight = newH;
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
    this.grid = this.createEmptyGrid(this.gridWidth, this.gridHeight);
    this.render();
  }

  /** Export current grid as PNG data URL */
  exportPNG() {
    return gridToPNGDataURL(this.grid, 32);
  }
}
