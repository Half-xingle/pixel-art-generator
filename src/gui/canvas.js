import { renderGrid, gridToJSON, jsonToGrid, hexToRGBA } from '../core/processor.js';

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
    const displayW = this.gridWidth * CELL_SIZE;
    const displayH = this.gridHeight * CELL_SIZE;

    const { data } = renderGrid(this.grid, CELL_SIZE);
    const imageData = new ImageData(data, displayW, displayH);
    ctx.putImageData(imageData, 0, 0);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= this.gridWidth; i++) {
      const pos = i * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, displayH);
      ctx.stroke();
    }
    for (let i = 0; i <= this.gridHeight; i++) {
      const pos = i * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(displayW, pos);
      ctx.stroke();
    }
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

  loadJSON(json) {
    this.grid = jsonToGrid(json);
    this.gridWidth = this.grid[0].length;
    this.gridHeight = this.grid.length;
    this.setupCanvas();
    this.render();
  }

  toJSON() {
    return gridToJSON(this.grid);
  }

  /** Export current grid as PNG download */
  exportPNG() {
    const exportCellSize = 32;
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
