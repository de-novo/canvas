# 快速入门与优化指南

[English](./getting-started.md) | [한국어](./getting-started.ko.md) | **简体中文**

本指南介绍如何为你的应用选择合适的 Denovo Canvas 入口、如何在不触发多余
重渲染的前提下接入无头编辑器，以及如何充分利用内置的 2D / 3D 性能优化能力。
*（详细规范契约以英文 [文档索引](./README.md) 中的规范文档为准。）*

## 1. 选择合适的入口

| 应用类型 | 推荐导入路径 | 是否打包 Three.js |
| --- | --- | --- |
| 2D Vanilla / TypeScript | `@denovo/canvas/2d` + `@denovo/canvas/styles.css` | 否（`0 B`） |
| 2D React / Next.js | `@denovo/canvas/2d` + `@denovo/canvas/react/2d`（或 `@denovo/react-canvas/2d`） | 否（`0 B`） |
| 2D Vue 3 | `@denovo/canvas/2d` + `@denovo/vue-canvas/2d` | 否（`0 B`） |
| 2D Svelte | `@denovo/canvas/2d` + `@denovo/svelte-canvas/2d` | 否（`0 B`） |
| 2D Solid | `@denovo/canvas/2d` + `@denovo/solid-canvas/2d` | 否（`0 B`） |
| 3D 或动态 2D/3D | `@denovo/canvas` + 可选 `@denovo/react-canvas` / `vue` / `svelte` / `solid` | 是 |

## 2. 核心心智模型

1. **文档（`0.2.0` JSON）** — 与渲染器解耦的数据结构（`layers`、`nodes`、
   `mode: "2d" | "3d"`、`render`、`assets`、`metadata`），通过
   `defineDocument` 或 `parseDocument` 解析并校验。
2. **无头编辑器（`createEditor`）** — 统一管理事务、选中态、悬停态、工具以及
   有界 Undo/Redo 历史。推荐通过 **Named Operations**（`setNodeVisible`、
   `setLayerVisible`、`removeNode`、`removeEdge`、`stackBox` 等）或标准命令
   提交修改。
3. **运行时（`createCanvas` / 框架组件）** — 在 Canvas2D、2D WebGPU、WebGL2
   或 3D WebGPU 上渲染文档，并通过 `connectEditorToCanvas(editor, canvas)` 将
   指针与触摸拾取回传给编辑器。

## 3. 用细粒度选择器消除 UI 多余重渲染

鼠标在画布上移动时会高频更新 `state.selection.hoveredId`。不要让工具栏或
属性面板订阅整个编辑器状态，而应只订阅所需切片；返回派生对象或数组时传入
`shallowEqual`：

```ts
import { shallowEqual, subscribeCanvasSelector } from "@denovo/canvas/2d";

const stop = subscribeCanvasSelector(
  editor,
  (state) => ({
    canUndo: state.history.canUndo,
    canRedo: state.history.canRedo,
    selectedCount: state.selection.ids.length
  }),
  (slice) => renderToolbar(slice),
  { equals: shallowEqual }
);
```

各框架对应绑定：
- React：`useCanvasSelector(editor, selector, shallowEqual)`
- Vue：`useCanvasSelector(editor, selector, shallowEqual)`
- Svelte：`createCanvasSelectorStore(editor, selector, shallowEqual)`
- Solid：`useCanvasSelector(editor, selector, shallowEqual)`

## 4. 内置 2D 性能优化

绝大多数 2D 优化默认开启：

- **视口裁剪与 O(k) 增量空间索引**：仅渲染、拾取和框选视口内的可见节点；
  拖动或编辑少量节点时仅增量更新对应节点及其关联边，无需重建 10k 节点索引。
- **O(visible) 智能对齐吸附**：拖拽时调用
  `runtime.current.computeSnapGuides(targetBounds, { excludeNodeIds, threshold: 6 })`，
  只查询可见邻近节点即可计算对齐偏移（`dx`、`dy`）和辅助线；也可直接使用纯函数
  `computeCanvas2DSnapGuides(bounds, candidates)`。
- **虚拟化 HTML 覆盖层卡片**：`html` 节点仅在进入视口时挂载 DOM，且仅对内容
  真正发生变化的卡片重新调用 `renderNode`。
- **rAF 高频输入合并**：同一帧内的连续滚轮、指针、悬停与预览事件会合并为单次
  重绘，同时完整保留累计平移/缩放增量。
- **显式 2D WebGPU**：在超大规模 2D 场景下，可通过
  `renderer: { backend: "webgpu" }` 启用 GPU 常驻顶点与图集缓存。

## 5. 内置 3D 与 BIM 优化

- 在 3D 场景中开启 `render: { batch: true }`，即可将顶层 `box` 与 `sphere`
  合批为 `InstancedMesh`，并启用 BVH 射线拾取。
- `renderer: "auto"` 会在支持 3D WebGPU 的环境优先使用 WebGPU，不支持时平滑
  回退到 WebGL2；需要严格失败保障时可显式指定 `"webgpu"` 或 `"webgl2"`。
- 使用 `@denovo/canvas/worker` 将繁重几何转换移出主线程，用
  `createSceneChunkLoader` 流式加载分块场景，用 `@denovo/canvas-bim` 联邦加载
  多模型 IFC 文件。

## 6. 主题样式与自定义节点

- 引入 `@denovo/canvas/styles.css` 后，覆盖公开的 `--dc-*` CSS 变量即可定制
  外观（未设置时自动兼容 Tailwind v4 `--color-*` 与 shadcn 语义变量）。
- 通过 `@denovo/canvas/web` 中的 `registerPluginNodeDrawer` 注册自定义可视节点
  （`plugin.<org>.<kind>`），详情参阅 [Kind Drawer Seam](./kind-drawer-seam.md)
  与 [Public API Contract](./public-api-contract.md)。

## 延伸阅读

- [文档索引](./README.md)
- [Public API Contract](./public-api-contract.md)
- [Named Authoring Operations](./named-authoring-operations.md)
- [贡献指南 (Contributing)](../CONTRIBUTING.md)
