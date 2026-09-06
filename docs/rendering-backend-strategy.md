# Rendering Backend Strategy

Last reviewed: 2026-09-02.

Implemented `auto` backends are Canvas2D (2D) and WebGPU or WebGL2 (3D).
3D `auto` prefers WebGPU when `capabilities.webgpu` is true. Explicit
`backend: "webgpu"` is valid for 2D and 3D and never falls back to
WebGL2 or Canvas2D. The product contract must keep that name in the
backend union without leaking any GPU API into persisted documents.

## Decision

Default renderer selection is progressive only through `auto`:

```ts
createCanvas("#stage", {
  renderer: {
    backend: "auto"
  },
  scene
});
```

The current built-in resolver applies these rules:

1. a 2D scene resolves to Canvas2D only when the Canvas2D capability is
   available;
2. a 3D scene resolves to WebGPU when `capabilities.webgpu` is true,
   otherwise to WebGL2 when WebGL2 is available;
3. if the required compatible built-in is unavailable, resolution fails;
4. `custom` requires an explicit adapter whose declared modes include the
   scene mode.

`navigator.gpu` is the 3D `auto` preference signal and the explicit
`webgpu` capability check. If `auto` selected WebGPU and device init
fails, the runtime falls back to WebGL2 and reports that result.
Pixel-sampling gates also disable WebGPU so they stay on WebGL2.

Every non-`auto` request is strict. An unavailable or mode-incompatible
`canvas2d`, `webgl2`, or `webgpu` request fails. `webgpu` is valid for
2D and 3D. `webgl2` stays 3D-only. `canvas2d` stays 2D-only.
`offscreen-canvas2d` stays unimplemented and fails with
`backend-unimplemented`. `custom` without an adapter fails with
`adapter-required`. No explicit request silently changes to another
backend. Three.js must not keep a WebGL2 fallback when `webgpu` was
requested. 2D WebGPU has no Canvas2D fallback on the same canvas.

The scene/document model must not store `webgpu`, `webgl2`, or `three` as
semantic requirements. Those are runtime adapter choices.

## Why WebGPU Stays In The Vocabulary

WebGPU is the successor path to WebGL. It maps better to modern native GPU APIs,
supports general-purpose GPU compute, reduces CPU-side overhead for many
rendering workloads, and opens room for GPU-side culling, picking, simulation,
post-processing, and large data visualization.

This matters for Denovo because the product goal includes:

- high-volume 3D scenes;
- instancing and batching;
- BIM-style large model viewing;
- chunk loading and culling;
- future GPU picking and selection acceleration;
- future WebGPU-powered 2D for large shape/annotation sets.

## Why Not WebGPU-Only

WebGPU support is now broad enough to plan around, but it is still not the
lowest-risk baseline for every app and device class. Browser version, operating
system, GPU driver, secure context, WebView, enterprise policy, and mobile
hardware can all affect availability.

Denovo should not force every application to handle that matrix directly.

The SDK should provide:

- capability detection;
- deterministic `auto` resolution over implemented compatible backends;
- explicit failure for unsupported, unavailable, or mode-incompatible choices;
- consistent runtime events;
- stable document serialization;
- clear escape hatches for apps that require a specific backend.

## Backend Vocabulary

Use these terms consistently:

- `mode`: document-level scene intent, currently `2d` or `3d`.
- `backend`: runtime implementation, such as `webgpu`, `webgl2`, `canvas2d`, or
  `custom`.
- `renderer adapter`: package/plugin that creates and owns backend resources.
- `engine`: lower-level dependency such as Three.js, Canvas2D, xeokit, or a
  WebGPU-native renderer.

The public API should converge on:

```ts
type CanvasBackend =
  | "auto"
  | "webgpu"
  | "webgl2"
  | "canvas2d"
  | "offscreen-canvas2d"
  | "custom";
```

The facade types and runtime selection API use this vocabulary. `auto` is a
selector; every other member identifies one exact backend contract.

## Three.js Strategy

Three.js remains the default 3D engine because it gives Denovo a mature scene
graph, material system, loaders, ecosystem knowledge, and a practical bridge
from WebGL2 to WebGPU.

The strategy is:

- keep `WebGLRenderer` as the 3D compatibility path when WebGPU is
  unavailable or explicitly requested;
- use Three.js `WebGPURenderer` for 3D `auto` when WebGPU is available
  and for explicit `backend: "webgpu"`;
- expose underlying Three.js resources as escape hatches;
- keep React Three Fiber as a React adapter, not the source of renderer truth;
- avoid depending on Drei for core behavior.

Three.js `WebGPURenderer` can target WebGPU and has a WebGL2 fallback path, but
that engine behavior does not authorize Denovo to silently substitute a
backend. Denovo owns capability checks and exact user-facing backend reporting.

## Camera Control Boundary

Camera interaction is a runtime concern, not a persisted backend requirement.
The public facade uses generic `controls` options for pan, rotate, zoom, and
distance constraints. The built-in Three.js runtime maps those options to
`OrbitControls`; custom renderers can implement equivalent behavior without
putting Three.js vocabulary into documents or facade config.

Interactive camera state is transient. Scene updates restore the document
camera, while control changes render the current runtime view. Demand-mode
renderers must invalidate or render on input without starting a permanent frame
loop. Frame loops and pointer handling remain imperative TypeScript renderer hot
paths under the internal Effect policy.

## 2D Strategy

Canvas2D is the default lightweight 2D backend. It is simple, broadly
available, and good enough for early shape editing, annotations, diagrams, and
small authoring tools.

Explicit `backend: "webgpu"` is the optional high-scale 2D backend.
2D `auto` stays Canvas2D. Use WebGPU when the workload needs:

- thousands or millions of repeated shapes;
- large CAD-like overlays;
- large BIM annotations;
- tiled or chunked 2D documents;
- GPU-accelerated picking or hit regions;
- custom shader-based visualization.

The API should let an app start with Canvas2D and move to WebGPU-backed 2D
without changing persisted documents.

## BIM Strategy

BIM rendering should stay extension-owned.

Denovo core should define selection, ids, metadata, assets, and command
contracts. BIM packages can choose xeokit, web-ifc, Three.js, WebGPU-native
rendering, or hybrid pipelines behind adapter boundaries.

IFC parsing and model conversion should run in workers or WASM-backed extension
packages. Large derived geometry should not be embedded directly in the core
document JSON.

## Capability Detection

Runtime selection should check the capabilities required by the selected
implementation:

- Canvas2D context creation for the built-in 2D runtime;
- WebGL2 context creation for the built-in 3D runtime;
- an explicit custom adapter and its declared modes for `custom`;
- secure context and `navigator.gpu` for explicit `webgpu`; adapter and
  device creation happen during `runtime.ready`;
- OffscreenCanvas transfer and context support when an OffscreenCanvas runtime
  is added.

Applications can inspect capabilities before creating a canvas:

```ts
const capabilities = detectCanvasBackendCapabilities();
if (capabilities.webgpu) {
  createCanvas("#stage", {
    renderer: { backend: "webgpu" },
    scene
  });
}
```

3D `auto` uses `capabilities.webgpu` as the preference signal. A true
flag is not a device; `runtime.ready` can still fail.

Applications should be able to inspect the resolved backend:

```ts
const canvas = createCanvas("#stage", {
  renderer: {
    backend: "auto"
  },
  scene
});

console.log(canvas.config.renderer);
```

`canvas.config.renderer` reports `requested`, `resolved`, `adapterName`, and
detected `capabilities`. It does not expose `fallbackReason`, because an
explicit request is never replaced and `auto` resolution is the requested
behavior. Resolution failures throw `CanvasBackendResolutionError` with
`adapter-required`, `backend-unimplemented`, `capability-unavailable`, or
`mode-mismatch`.

## Performance Direction

Backend choice alone is not enough. Denovo performance should be built from:

- demand-based render loops by default;
- explicit invalidation;
- instancing for repeated 3D nodes;
- direct `BufferGeometry` builders;
- material and geometry batching;
- LOD controls;
- frustum culling;
- chunk loading;
- BVH or spatial indexes for picking;
- worker pipelines for parsing and indexing;
- optional GPU compute for high-scale culling/picking when WebGPU is available.
  The first landed compute is `plugin.denovo.field` streak travel.
  On WebGPU that travel stays GPU-resident and copies into the
  renderer vertex buffer.

WebGPU makes some of these stronger, but the architecture should keep useful
performance features available on WebGL2 where possible.

## API Implications

Short term:

- keep `@denovo/canvas` as the default entrypoint;
- keep `backend: "auto"` deterministic: Canvas2D for 2D, WebGPU then
  WebGL2 for 3D;
- keep Three.js WebGL2 as the 3D compatibility path;
- keep explicit `backend: "webgpu"` strict for 2D and 3D;
- keep mesh and instance `resolveSurfacePoint` on WebGPU and WebGL2.

Medium term:

- add explicit backend-resolution and capability events if consumers need
  asynchronous observability beyond the existing error boundary;
- add examples for an explicit WebGL2-forced usage.

3D `auto` may select WebGPU. Capability reporting before `createCanvas`
is `detectCanvasBackendCapabilities()`.

Long term:

- evaluate WebGPU-native 2D rendering;
- expand GPU compute past field streaks (letters, culling, picking);
- support worker/offscreen rendering where browsers make it practical.

## Source References

- MDN WebGPU API: WebGPU is the successor path to WebGL and supports modern GPU
  rendering and general-purpose GPU compute.
  <https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API>
- Three.js `WebGPURenderer`: the renderer can use WebGPU and fall back to a
  WebGL2 backend.
  <https://threejs.org/docs/pages/WebGPURenderer.html>
- Chrome WebGPU overview: browser and library support notes.
  <https://developer.chrome.com/docs/web-platform/webgpu/overview>
- GPUWeb implementation status: current browser/platform support matrix.
  <https://github.com/gpuweb/gpuweb/wiki/Implementation-Status>
- Canvas UI rendering docs: neighbor product. WebGL (GLSL) and WebGPU
  (vgpu + WGSL) as two builds with the same public props. Not a
  facade dependency. See
  [2026-09-02 Canvas UI reference](./history/2026-09-02-canvas-ui-reference.md).
  <https://canvasui.dev/docs/rendering>
