# 像素画生成器 — 设计文档

> 2026-06-30
> 项目：练手项目，测试 skill 与 git 流程

## 概述

一个网页版像素画生成器，支持上传图片转像素画、手动绘画，以及 CLI 接口方便 AI 调用。

## 技术栈

| 层面 | 技术 |
|------|------|
| 前端 | 纯 HTML/CSS/JS + Vite |
| 后端/CLI | Node.js + Sharp |
| 核心算法 | 纯函数，不依赖 DOM 或 Node API |
| 包管理 | npm |

**依赖：** 仅 `vite`（dev）和 `sharp`（runtime），共 2 个。

## 项目结构

```
像素画生成/
├── index.html              # GUI 单页应用
├── style.css               # 样式
├── main.js                 # GUI 入口
├── cli.js                  # CLI 入口（bin）
├── package.json
├── vite.config.js
├── .gitignore
├── src/
│   ├── core/               # ★ 共享核心算法
│   │   ├── processor.js    #   像素化算法、网格缩放
│   │   └── palette.js      #   调色板工具
│   ├── gui/                # GUI 专属逻辑
│   │   ├── canvas.js       #   画布渲染、鼠标交互
│   │   ├── upload.js       #   图片上传处理
│   │   └── export.js       #   PNG 导出
│   └── cli/                # CLI 专属逻辑
│       └── image.js        #   Sharp 封装（图片 I/O）
└── docs/superpowers/specs/ # 设计文档
```

## 核心算法

### `processor.js`

```
toPixelArt(imageData, width, height, gridSize)
  → grid[y][x] = {r, g, b, a}
```

- 最近邻采样：对每个网格单元取源图对应区域中心点颜色
- 输入：`ImageData`（GUI）/ 原始像素数组（CLI）
- 输出：`grid[y][x]` 二维颜色数组

```
renderGrid(grid, gridSize, cellSize)
  → ImageData
```

- 将像素网格放大为输出图片（如 16×16 网格 → 512×512 图片）
- 每个网格单元渲染为 `cellSize × cellSize` 像素块
- 可选：绘制网格线

### `palette.js`

- `quantizeColor(r, g, b, palette)` — 颜色量化（找最近颜色）
- `DEFAULT_PALETTE` — 经典 16 色 NES 风格调色板

## GUI 设计

### 布局

单页应用，两个 Tab 切换：

**[转换 Tab]**
- 上传区：拖拽或点击选图
- 参数：网格尺寸下拉（8/16/24/32/48/64）
- 预览：原图缩略图 + 像素画实时预览（带网格线）
- 操作：[转换] [导出 PNG]

**[绘画 Tab]**
- 画布：Canvas 渲染的像素网格，鼠标拖拽绘制
- 工具：颜色选择器、橡皮擦（白/透明）、清空画布
- 参数：网格尺寸
- 切换网格尺寸时保留已画内容（超出部分裁剪）
- 导出 PNG

### 交互细节

- 绘画：`mousedown` 开始 → `mousemove` 连续画 → `mouseup` 停止
- 上传：`<input type=file accept="image/*">`
- 导出：生成 PNG 并通过 `<a download>` 触发下载

## CLI 设计

### 命令

```
cli draw --size <n> --grid <json> -o <file>    # AI 生成网格 → PNG
cli draw --size <n> --file <path> -o <file>     # 从 JSON 文件读网格
cli convert <image> --size <n> -o <file>        # 图片 → 像素画
cli --help                                       # 帮助信息
```

### JSON 格式

```json
{
  "size": 16,
  "pixels": [
    ["#ff0000", "#00ff00", "#0000ff", ...]
  ]
}
```

### 数据流

```
[draw] JSON → 解析 → processor.renderGrid() → sharp 写 PNG
[convert] 图片 → sharp 读 → processor.toPixelArt() → sharp 写 PNG
```

### 错误处理

- 退出码：0=成功, 1=参数/格式错误, 2=文件错误
- 清晰的中文错误信息

## 边界情况

- 上传非图片文件 → 提示
- 超大图片 → 建议压缩
- 空画布导出 → 提示
- 网格尺寸不匹配 → 自动裁剪或明确报错
- 颜色格式无效 → 指示具体位置

## 实现顺序

1. 初始化项目（package.json, vite, git）
2. 核心算法 `processor.js` + `palette.js`
3. CLI `draw` 命令
4. CLI `convert` 命令
5. GUI 上传转像素画
6. GUI 绘画画布
7. GUI 导出功能
8. 完善文档、自测
