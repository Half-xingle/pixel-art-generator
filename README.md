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

## Agent 使用

CLI 面向 agent 调用设计，支持完整的"转换 → 修改 → 再渲染"回环：

```bash
# 1. 照片 → 像素画 + 量化 + 预览
node cli.js convert photo.jpg --size 16 --palette nes --preview -o art.png

# 2. 读回网格 JSON（或直接吃 stdout）
node cli.js pixels art.png --size 16 -o grid.json

# 3. 修改后的网格 → 新 PNG
node cli.js draw - -o v2.png --preview < grid.json
```

- `--json`：结果输出结构化 JSON；错误时 stderr 为 `{"ok":false,"error":...}`，退出码 0/1/2
- `--preview`：终端 ANSI 色块预览；`--no-color`（或 `NO_COLOR`）时输出 `#rrggbb` 网格
- `draw -`：从 stdin 读网格 JSON，绕开命令行长度上限（64×64 网格约 30KB）
- `--palette nes`：量化到经典 NES 16 色

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
│   │   └── processor.js
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
