# 🎨 像素画工坊 — Pixel Art Generator

纯前端像素画生成器，支持图片转换、手动绘画、AI 调用。

## 快速开始

```bash
npm install
npm run dev      # 启动 GUI（浏览器）
node cli.js --help  # CLI 帮助
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
    ["#ff0000", "#00ff00", ...]
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
node --test src/core/*.test.js src/cli/*.test.js  # 运行测试
npm run build           # 构建生产版本
```
