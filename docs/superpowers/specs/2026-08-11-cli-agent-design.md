# CLI 面向 Agent 改造 — 设计文档

> 2026-08-11
> 在 2026-06-30 基础设计之上，针对 agent 使用场景增强 CLI。

## 概述

现有 CLI（`draw` / `convert`）可用，但面向人类用户设计。agent 使用时存在三个核心短板：

1. **看不到结果**——无文本预览，无视觉 agent 全盲
2. **无法回环**——没有 PNG → 网格 JSON 的反向命令，无法"转换 → 修改 → 再渲染"
3. **内联 JSON 上限**——Windows 命令行约 32k 字符，64×64 网格放不下

本次改造目标：把 CLI 变成 **agent 可迭代的工具**（方案 A）。MCP server 包装（方案 B）作为第二步，在 A 验证后基于同一核心实现。

## 消费方与用途（已确认）

- Agent 类型：Claude Code / Claude 系 与 自有/第三方框架 **都要** → CLI 增强是两者共用的基础层
- 主要用途：**从零创作**（agent 自设计网格 → 渲染）与**迭代修改已有作品**（回环）
- 视觉能力：混合 → `--preview` 必须做成可选开关，两种模式都覆盖

## 命令面

```
# 回环核心：图片 → 网格 JSON（新增）
node cli.js pixels <image> [--size <n>] [--palette nes] [--preview] [--json]
    # 默认输出网格 JSON 到 stdout；-o <file> 可写文件

# 渲染：网格 → PNG（升级现有 draw）
node cli.js draw [--grid <json> | --file <path> | -（stdin）] [--size <n>] -o out.png [--preview] [--json]

# 转换（升级现有 convert）
node cli.js convert <image> [--size <n>] [--palette nes] -o out.png [--preview] [--json]
```

- `--preview`：终端 ANSI 色块预览；`NO_COLOR` 或 `--no-color` 时降级为 hex 网格（agent 可解析）。颜色模式只由 `NO_COLOR` / `--no-color` 决定，不做 TTY 检测（管道输出中的 ANSI 无害，需要纯文本时用 `--no-color`）
- `--json`：结果输出结构化 JSON；错误时 stderr 也是 JSON
- `--palette nes`：量化到经典 NES 16 色（恢复 palette.js 的 quantizeColor）
- `-` 作为 `draw` 的文件参数时从 stdin 读取网格 JSON，绕开命令行长度上限

### 典型 agent 工作流

```
# 1. 照片 → 像素画 + 量化 + 预览
node cli.js convert photo.jpg --size 16 --palette nes --preview -o art.png

# 2. 读回网格 JSON，修改颜色/形状
node cli.js pixels art.png --size 16 -o grid.json   # 或直接吃 stdout

# 3. 修改后的网格 → 新 PNG
node cli.js draw - -o v2.png --preview < grid.json
```

## 数据流

```
pixels:  图片 → sharp 缩放解码 → toPixelArt → [quantize nes] → gridToJSON → stdout 或 -o 文件
draw:    [stdin | --grid | --file] → jsonToGrid → renderGrid → sharp 写 PNG → [--preview] [--json]
convert: 图片 → sharp 缩放解码 → toPixelArt → [quantize nes] → renderGrid → sharp 写 PNG → [--preview] [--json]
```

## 内部结构

```
src/core/palette.js    # 恢复：DEFAULT_PALETTE（NES 16 色）+ quantizeColor
                       # 改进：模块加载时预解析 palette 为 RGB 数组，避免每像素重复 parseInt
src/cli/preview.js     # 新增：gridToText(grid, {color}) → ANSI 色块 / hex 网格
cli.js                 # 三个命令统一入口，共用参数解析与输出
```

- 恢复 `palette.js` 是 2026-06-30 设计文档规划的 AI 功能（本会话早期因无生产调用者而删除，现在有了明确消费者）
- `--preview` 用 24-bit truecolor ANSI（`\x1b[48;2;r;g;bm`），颜色模式由 `NO_COLOR` 环境变量 / `--no-color` 开关决定；hex 模式每个格子输出 `#rrggbb`
- 不引入新依赖：ANSI 输出手写，量化复用 palette.js

## 输出契约

成功（stdout）：
```json
{"ok": true, "file": "out.png", "grid": {"width": 16, "height": 16}, "colors": 5}
```
- `pixels` 命令无 `-o` 时，stdout 就是网格 JSON 本身（`{"width":…,"height":…,"pixels":[…]}`）——它是 payload，不受 `--json` 影响；此时 `--json` 仅在 stderr 附加一行摘要
- **stdout 通道规则**：只要 stdout 承载 payload（`pixels` 无 `-o`），任何非 payload 输出（`--preview` 预览文本等）一律走 stderr，无论是否 `--json`；`--json` 模式下 stdout 必须保持纯 JSON
- `colors` 为网格中不同颜色的去重计数
- `draw` / `convert` 的 stdout 只有结果信息（中文或 `--json` 包装）

错误（stderr）：
```json
{"ok": false, "error": "JSON 格式无效"}
```

无 `--json` 时保持现有中文错误信息。

## 错误处理

- 退出码不变：0=成功, 1=参数/格式错误, 2=文件错误
- `--json` 模式下错误信息仍走 stderr，且为 JSON，agent 可统一解析
- `pixels` 读不到图片、`draw` stdin 为空、`--palette` 未知名称等，均给出明确中文错误

## 测试

- 恢复 `palette.test.js`：量化最近色、透明色、预解析正确性
- 回环测试：`pixels` 输出 → 修改 JSON → `draw`，像素与期望一致
- `--preview` 两种模式（ANSI / hex）输出测试
- `--json` 成功 / 错误输出测试
- stdin `draw -` 测试（含 64×64 大网格）
- 全部 node:test，零新依赖

## 兼容性

- `--grid` / `--file` / `convert` 老用法全部保留
- 退出码语义不变
- 现有 GUI 不受影响（核心函数签名不变）

## 实现顺序

1. 恢复 `palette.js`（含预解析优化）+ 测试
2. `preview.js` + 测试
3. `draw` 支持 stdin 输入
4. `convert` / `pixels` 支持 `--palette nes`
5. 新增 `pixels` 命令
6. `--json` 输出契约（三个命令统一）
7. CLI 冒烟 + 回环自测
8. 更新 README（agent 用法示例）

## 第二步（方案 B，暂不实现）

MCP server 包装同一核心：`draw_pixel_art` / `convert_to_pixel_art` / `read_grid` 等工具，Claude Code 原生调用。在方案 A 验证后再设计。
