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

    // Initialize empty grid (all white)
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
