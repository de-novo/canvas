# Denovo Canvas

[![CI](https://github.com/de-novo/canvas/actions/workflows/ci.yml/badge.svg)](https://github.com/de-novo/canvas/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-GitHub%20Pages-0284c7.svg)](https://de-novo.github.io/canvas/)

[English](./README.md) | [한국어](./README.ko.md) | **简体中文** | [在线演示站](https://de-novo.github.io/canvas/)

Denovo Canvas 是一个框架无关的 TypeScript SDK，用于构建高性能、可编辑的 2D
与 3D 画布应用。就像 TanStack Table 和 TanStack Virtual 在 DOM 生态中的定位，
Denovo Canvas 通过轻量的无头核心与薄框架适配层，替应用处理最棘手的画布底层优化：
视口裁剪、空间索引与增量更新、HTML 覆盖层虚拟化、GPU 绘制调用合批、rAF
帧合并、细粒度选择器订阅、命令/事务撤销重做，以及渲染器无关的 JSON 持久化。

UI 控件、设计系统和存储位置完全由你的应用决定。你可以在 Vanilla JavaScript、
React / Next.js、Vue、Svelte 或 Solid 中共用同一套编辑器与文档模型。

> 刚接触 Denovo Canvas？欢迎阅读
> [快速入门与优化指南](./docs/getting-started.zh-CN.md)
> （[English](./docs/getting-started.md) | [한국어](./docs/getting-started.ko.md)）
> 或浏览 [文档索引](./docs/README.md)。
> *（若译文与规范存在差异，以英文 `docs/` 规范文档为准。）*

## 当前能力一览

- **大规模 2D 无限画布、流程图、看板与标注编辑器**
  - 内置 2D 节点：`rect`、`circle`、`edge`（直线、二次曲线、正交端口路由与箭头）、
    `text`、`html`（宿主渲染的 DOM 卡片，支持缩放与视口外裁剪）、`group`、
    `measurement`、`annotation`，以及自定义 `plugin.<org>.<kind>` 绘制器。
  - 均匀网格空间索引（`Canvas2DSpatialIndex`）与 O(k) 增量编辑同步、渲染/拾取/框选
    （`getNodesInBounds`）视口裁剪、O(visible) 智能对齐吸附辅助线
    （`computeSnapGuides` / `computeCanvas2DSnapGuides`）、O(visible) HTML
    覆盖层 DOM 虚拟化与增量 diff `renderNode`、O(1) 离屏缓存小地图、rAF
    高频输入帧合并，以及带 GPU 常驻顶点/图集缓存的可选 2D WebGPU 渲染器。
  - 门面包与四大框架适配器均提供零 Three.js 的轻量 2D 入口（`@denovo/canvas/2d`、
    `@denovo/canvas/react/2d`、`@denovo/react-canvas/2d`、`@denovo/vue-canvas/2d`、
    `@denovo/svelte-canvas/2d`、`@denovo/solid-canvas/2d`），确保 2D 应用打包体积
    完全不包含 3D 引擎代码。
- **高性能 3D 查看器、编辑器与 BIM 工作流**
  - 内置 3D 节点：`box`、`sphere`、`mesh`（内联或外部几何资产）、`instances`、
    `group`、`measurement`、`annotation`，以及官方 `plugin.denovo.field`。
  - 自动 `auto` 后端解析（支持时优先 WebGPU，否则 WebGL2）、可选实例化合批
    （`render.batch: true`）与 BVH 射线拾取、基于距离的球体 LOD、剖切平面、
    包围盒/网格表面贴合放置与测距、Web Worker 几何转换（`@denovo/canvas/worker`）、
    分块场景流式加载（`createSceneChunkLoader`）以及可选多模型 IFC 联邦
    （`@denovo/canvas-bim`）。
- **细粒度框架状态订阅（悬停零多余重渲染）**
  - 无头 `subscribeCanvasSelector` + `shallowEqual`，并内置 React
    （`useCanvasSelector`，基于 `useSyncExternalStore`）、Vue（`useCanvasSelector`，
    返回 `ComputedRef`）、Svelte（`createCanvasSelectorStore`，兼容 `$store`）、
    Solid（`useCanvasSelector`，返回 `Accessor`）。
- **标准化编辑模型、命名操作与持久化**
  - 规范 `0.2.0` JSON 文档（含 `0.1.0` 确定性迁移）、强校验命令、原子事务、
    有界 Undo/Redo 历史、内置工具集（`Select`、`Pan/Orbit`、`Transform`、
    `Connector`、`2D Shape`、`3D Primitive`、`3D Surface Placement`、
    `Distance Measurement`、`Annotation`）、供宿主 UI 与 AI Agent 共用的 22 个
    Named Operations（`alignNodes`、`distributeNodes`、`setLayerVisible`、
    `setNodeVisible`、`removeEdge`、`removeNode`、`stackBox`、`listNodes` 等），
    以及内存、文件系统与 IndexedDB 存储适配器。

## 快速上手

### 1. 轻量 2D 编辑器（`@denovo/canvas/2d` — 零 Three.js）

```html
<div id="stage" style="height: 320px"></div>
<button id="hide">隐藏矩形</button>
<button id="undo">撤销</button>
```

```ts
import {
  connectEditorToCanvas,
  createCanvas,
  createEditor,
  defineDocument,
  setNodeVisible
} from "@denovo/canvas/2d";
import "@denovo/canvas/styles.css";

const documentModel = defineDocument({
  id: "drawing",
  scene: {
    id: "page",
    mode: "2d",
    layers: [{ id: "shapes", name: "Shapes" }],
    nodes: [
      {
        id: "rect",
        type: "rect",
        layerId: "shapes",
        position: [40, 40],
        size: [120, 80],
        fill: "#22c55e"
      }
    ]
  }
});

const editor = createEditor({ document: documentModel });
const canvas = createCanvas("#stage", { editor });

document.querySelector("#hide")!.addEventListener("click", () =>
  editor.apply([setNodeVisible({ nodeId: "rect", visible: false })])
);
document.querySelector("#undo")!.addEventListener("click", () => editor.undo());

// 卸载时调用：canvas.destroy()（会自动断开编辑器连接）
```

### 2. React / Next.js 2D 视图与细粒度选择器

使用 `@denovo/canvas/react/2d`（或 `@denovo/react-canvas/2d`），2D React 应用不会打包
任何 Three.js、React Three Fiber 或 Drei 代码，工具栏组件在高频指针悬停期间也不会触发
多余重渲染：

```tsx
"use client";

import {
  connectEditorToCanvas,
  createEditor,
  defineDocument,
  shallowEqual
} from "@denovo/canvas/2d";
import { Canvas2DView, useCanvasSelector } from "@denovo/canvas/react/2d";
import "@denovo/canvas/styles.css";
import { useMemo } from "react";

export function Board() {
  const editor = useMemo(
    () =>
      createEditor({
        document: defineDocument({
          id: "board",
          scene: {
            id: "scene",
            mode: "2d",
            layers: [{ id: "default", name: "Default" }],
            nodes: [
              {
                id: "card-1",
                type: "rect",
                layerId: "default",
                position: [40, 40],
                size: [160, 88],
                fill: "#38bdf8"
              }
            ]
          }
        })
      }),
    []
  );

  const { canUndo, canRedo } = useCanvasSelector(
    editor,
    (s) => ({ canRedo: s.history.canRedo, canUndo: s.history.canUndo }),
    shallowEqual
  );

  return (
    <div>
      <Canvas2DView editor={editor} />
      <button disabled={!canUndo} onClick={() => void editor.undo()}>
        Undo
      </button>
      <button disabled={!canRedo} onClick={() => void editor.redo()}>
        Redo
      </button>
    </div>
  );
}
```

### 3. Vue、Svelte、Solid 与 Vanilla 选择器

```ts
// Vanilla / 任意运行时
import { shallowEqual, subscribeCanvasSelector } from "@denovo/canvas/2d";
const stop = subscribeCanvasSelector(
  editor,
  (s) => ({ canUndo: s.history.canUndo, canRedo: s.history.canRedo }),
  (next) => console.log(next),
  { equals: shallowEqual }
);

// Vue 3（@denovo/vue-canvas 或零 Three.js 的 @denovo/vue-canvas/2d）
import { useCanvasSelector } from "@denovo/vue-canvas/2d";
const undoDepth = useCanvasSelector(editor, (s) => s.history.undoDepth);

// Svelte（@denovo/svelte-canvas 或零 Three.js 的 @denovo/svelte-canvas/2d）
import { createCanvasSelectorStore } from "@denovo/svelte-canvas/2d";
const selectedId = createCanvasSelectorStore(editor, (s) => s.selection.primaryId);

// Solid（@denovo/solid-canvas 或零 Three.js 的 @denovo/solid-canvas/2d）
import { useCanvasSelector } from "@denovo/solid-canvas/2d";
const undoDepthSignal = useCanvasSelector(editor, (s) => s.history.undoDepth);
```

### 4. 动态 2D + 3D 场景（`@denovo/canvas`）

```ts
import { createCanvas } from "@denovo/canvas";
import "@denovo/canvas/styles.css";

const canvas = createCanvas("#stage", {
  scene: {
    id: "scene-3d",
    mode: "3d",
    layers: [{ id: "default", name: "Default" }],
    render: { batch: true },
    nodes: [
      { id: "box-1", type: "box", layerId: "default", position: [0, 0, 0], color: "#22c55e" },
      { id: "box-2", type: "box", layerId: "default", position: [2, 0, 0], color: "#22c55e" }
    ]
  }
});
```

### 示例应用与在线演示站

- [10k 2D 实时基准测试与智能吸附（`@denovo/canvas/2d`，零 Three.js）](./apps/playground-flow/src/bench-2d.ts)
- [Release Board（2D 卡片、连线、保存/重置，`@denovo/canvas/2d`）](./apps/playground-flow/src/main.ts)
- [Service Map（2D 图布局，`@denovo/canvas/2d`）](./apps/playground-network/src/main.ts)
- [Next.js 遮罩编辑器（React `Canvas2DView` + `useCanvasSelector` + shadcn/Tailwind v4）](./apps/playground/app/mask-host.tsx)
- [Vanilla 2D/3D 编辑工作台](./apps/vanilla/src/main.ts)
- [3D Warp Field 示例](./apps/playground-field/src/main.ts)

使用 `pnpm build:pages` 和 `pnpm verify:pages` 可在本地构建并验证静态 GitHub Pages 演示站。

## 实测性能与包体积数据

以下数据由仓库确定性验证脚本（`pnpm verify:2d-performance`、`pnpm verify:performance`、
`pnpm verify:selectors`、`pnpm verify:public-api`）实测得到：

| 场景 / 负载 | 优化机制 | 实测结果 |
| --- | --- | --- |
| 2D `10k-2d-rects`（Canvas2D + 小地图） | 空间索引 + 视口裁剪 + O(1) 小地图缓存 | `drawCalls` 10,001 → **28**，平移 p50 3.70 ms → **0.00 ms**，200 次拾取 118.5 ms → **0.5 ms** |
| 2D `10k` 单节点编辑 / 智能吸附 / `100k` 对比 | 增量 Zod 校验 + O(k) 空间/对象更新 + O(visible) 吸附 | 10k `editor.apply` 79.3 ms → **4.05 ms**，10k `update()` 51.8 ms → **5.6–7.9 ms**，100k 200 次拾取 51.8 ms → **0.30 ms**（**172×**），100k 平移 **0.00 ms**（`28` drawCalls） |
| 2D `10k-2d-webgpu`（显式 2D WebGPU） | GPU 常驻顶点/图集/绑定组缓存 + 空间裁剪 | 平移 p50 6.90 ms → **0.00 ms**，p95 14.40 ms → **0.10–0.20 ms**，三角形 20,002 → **210** |
| 2D `1k-2d-overlays`（HTML 卡片） | O(visible) DOM 虚拟化 + diff `rebuildObjects` | 平移 p50 0.80 ms → **0.10 ms**，单卡编辑仅调用 `renderNode` **1 次**（非 1,001 次） |
| 2D 高频滚轮突发（20 次 / tick） | rAF 帧合并 | 20 次事件 → **1 次 Canvas2D 渲染**（完整保留累计位移） |
| React / Vue / Headless 选择器 | `useCanvasSelector` / `subscribeCanvasSelector` + `shallowEqual` | 100 次悬停更新中无关组件重渲染 **0 次** |
| 3D `1k-boxes` / `10k-boxes` / `1k-spheres` | `render.batch: true` 实例化 + BVH 拾取（Metal WebGL2） | `drawCalls=1`，`geometries=1`，**8.30 ms p50**（低于 16 ms GPU 门禁） |
| 2D 专用生产构建（`playground-flow`、`playground-network`） | `@denovo/canvas/2d`（不含 Three.js / WebGPU） | **1.87 MB → 352–361 kB**（**体积减少 80.6%–81.2%**，Three.js 0 B） |

*（3D 硬件 GPU 耗时在 macOS Apple Silicon ANGLE Metal 测得；2D Canvas2D 裁剪、增量同步、智能吸附、HTML diff、rAF 合并、选择器隔离及全部浏览器示例均在 GitHub Actions `ubuntu-latest` CI 中持续验证。）*

## 包与子路径目录

| 包 / 子路径 | 说明 |
| --- | --- |
| `@denovo/canvas` | 完整 2D/3D 门面包（`createCanvas`、`createEditor`、工具、命名操作、选择器、`./styles.css`、`./worker`、`./indexed-db`、`./react-query`、`./web`、`./react`、`./react/2d`）。 |
| `@denovo/canvas/2d` | 轻量 2D 专用门面，零 `three`、`three/webgpu`、`three-mesh-bvh` 导入。 |
| `@denovo/canvas-core` | 框架无关的 `0.2.0` 文档/场景/命令/存储/插件 Schema 与校验。 |
| `@denovo/canvas-editor` | 命令分发器、事务、Undo/Redo、工具、命名操作及 `subscribeCanvasSelector` / `shallowEqual`。 |
| `@denovo/canvas-web` | 浏览器 2D（Canvas2D + 2D WebGPU）与 3D（WebGL2 + WebGPU）运行时、空间索引、智能吸附与覆盖层虚拟化（`./2d`、`./3d`、`./indexed-db`）。 |
| `@denovo/canvas-three` | Three.js 优化原语（按需渲染、实例化、BVH 射线拾取、官方 Field 绘制器）。 |
| `@denovo/react-canvas` | React 适配器（`CanvasView`、`CanvasStage3D`、`useCanvasSelector`）及零 Three.js/R3F/Drei 的 `./2d`（`Canvas2DView`、`useCanvasSelector`）。 |
| `@denovo/vue-canvas` | Vue 3 适配器（`DenovoCanvas`、`useCanvasSelector`）及零 Three.js 的 `./2d`（`DenovoCanvas2D`、`useCanvasSelector`）。 |
| `@denovo/svelte-canvas` | Svelte 适配器（`DenovoCanvas`、`createCanvasSelectorStore`）及零 Three.js 的 `./2d`（`DenovoCanvas2D`、`createCanvasSelectorStore`）。 |
| `@denovo/solid-canvas` | Solid 适配器（`DenovoCanvas`、`useCanvasSelector`）及零 Three.js 的 `./2d`（`DenovoCanvas2D`、`useCanvasSelector`）。 |
| `@denovo/canvas-server` | 服务端场景存储适配器与乐观锁冲突校验持久化。 |
| `@denovo/canvas-worker` | Web Worker 任务队列与主线程外几何转换。 |
| `@denovo/canvas-bim` | 可选 BIM 协议及 `./web-ifc` 多模型 IFC 解析适配器。 |

## 开发与验证

```sh
pnpm install
pnpm build
pnpm typecheck

# 确定性验证套件
pnpm verify:docs
pnpm verify:public-api
pnpm verify:pack-smoke
pnpm verify:document-schema
pnpm verify:editor-core
pnpm verify:hit-testing
pnpm verify:selectors
pnpm verify:2d-performance
pnpm verify:flow-showcase
pnpm verify:network-showcase
pnpm verify:diagram-rendering
pnpm verify:region-mask
```

## 开源协议与治理

Denovo Canvas 基于 [Apache License 2.0](./LICENSE) 开源。
版权与第三方声明请参阅 [NOTICE](./NOTICE)。

- [更新日志 (Changelog)](./CHANGELOG.md)
- [贡献指南 (Contributing)](./CONTRIBUTING.md)
- [行为准则 (Code of Conduct)](./CODE_OF_CONDUCT.md)
- [安全政策 (Security Policy)](./SECURITY.md)
- [完整文档索引](./docs/README.md)
