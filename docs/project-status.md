# Project Status

Last updated: 2026-11-21.

This is the canonical project status index. Keep milestone definitions in
[Vision and Milestones](./vision-and-milestones.md); keep chronological evidence
under [History](./history/README.md).

## Current Phase

M0–M8 are all milestone-verified: product contract, view runtime, editor
core, authoring tools, surface placement (M0–M3.1), performance layer
(M4), framework adapters (M5), persistence (M6), BIM extension (M7), and
the diagram layer (M8). Verification completed 2026-08-22 across three
entries:

- [2026-08-22 M5, M6, and M8 milestone verification](./history/2026-08-22-m5-m6-m8-milestone-verification.md)
- [2026-08-22 M4 worker task queue + LOD controls, chunk loading, and batching gate](./history/2026-08-22-m4-lod-chunk-loading.md)
- [2026-08-22 M7 worker parsing and section plane](./history/2026-08-22-m7-worker-parsing-section-plane.md)

Recorded descopes inside those 2026-08-22 verdicts, with later landings
called out: the 16 ms frame-budget gate needed a pinned measurement
environment — 2026-09-06 gates 1k-boxes p50 on this machine's Apple M5
Pro via ANGLE Metal WebGL2; 2026-09-07 also gates explicit 3D WebGPU
1k-boxes p50 on that GPU. Linux and Windows remain unmeasured. An
OffscreenCanvas rendering path is not an M4 deliverable. The XKT/xeokit
viewer adapter stays out of M7 (AGPL). Mesh-surface-picked measurement
endpoints were listed as a future M3.1 extension and landed the same
day as the M4/M7 verdicts.

v1 focus remains the framework-agnostic 2D/3D editor engine. Diagram and
BIM stay optional packages, not a second product identity. See
[2026-08-17 review-hardening](./history/2026-08-17-review-hardening.md).

Product identity is now recorded: we restate open-source impressiveness
as our documents. Hosting an upstream room is not absorption. See
[Product Identity](./product-identity.md) and
[2026-08-25 product identity](./history/2026-08-25-product-identity.md).
The editor engine is verified. The first absorbed diagram catalog case
is the release board in `apps/playground-flow`. The first absorbed hero
case is Warp Field restated as `plugin.denovo.field` in
`apps/playground-field`. The first absorbed graph catalog case is the
service map in `apps/playground-network`. See
[Framework Surface](./framework-surface.md).

The extension surface is decided (2026-09-04): the kind is the only
product-level extension seam, `CanvasPlugin` is a host bundle, and
`pluginState` is bookkeeping. See
[Extension Surface Decision](./extension-surface-decision.md).

## Complete

- Monorepo scaffold exists with framework-agnostic core/web packages, optional
  React adapter, server, worker, BIM, and examples.
- `@denovo/canvas` facade package exists as the current public entrypoint.
- Public API contract verification exists and passes.
- Renderer backend vocabulary includes `auto`, `webgpu`, `webgl2`,
  `canvas2d`, `offscreen-canvas2d`, and `custom`. Implemented `auto`
  results are Canvas2D, WebGL2, and WebGPU. 3D `auto` prefers WebGPU
  when `capabilities.webgpu` is true, otherwise WebGL2.
- Contributor/project/document/history management policy is defined for human
  and automated contributors.
- Enforceable contributor rules are canonical; `AGENTS.md` adds only
  automation-specific workspace and handoff safeguards.
- Four repository-scoped skills route public-contract, editor-core,
  browser-rendering, and governance work to the canonical documents and
  risk-matched gates; `verify:docs` validates their location and frontmatter.
- Root code-review rules and the pull-request template require contract impact,
  exact verification, unmeasured scope, and durable evidence to stay separate.
- TypeScript 7 is the required repository toolchain, and Effect is the preferred
  internal workflow foundation behind Effect-free public facade boundaries.
- The initial M0 document/schema slice was verified for valid 2D/3D scenes,
  duplicate IDs, strict renderer-independent JSON boundaries, JSON round-trips,
  and command/storage/plugin/renderer type contracts. Canonical `0.2.0` M3
  migration and authoring-schema evidence remains part of the verified M3
  baseline below.
- Browser rendering stability is verified for the vanilla facade example across
  desktop and mobile viewports, including 3D initial render, 2D scene swap,
  viewport resize, non-blank canvas screenshots, and ResizeObserver/page error
  checks.
- Three.js demand rendering is verified to render static scenes without
  continuing to schedule animation frames on desktop and mobile.
- Scene schemas and TypeScript types reject built-in 3D nodes in 2D scenes and
  built-in 2D nodes in 3D scenes instead of silently dropping them at render
  time.
- Custom facade renderer adapters create the active runtime, receive lifecycle
  calls and scene updates, expose their runtime through `canvas.current`, and
  reject unsupported scene modes before mutation.
- The facade initializes from and loads validated document objects or JSON,
  preserves the complete document across scene updates, and retains inspectable
  asset references without exposing internal Effect types.
- Framework-agnostic camera control options drive the built-in Three.js runtime,
  and desktop/mobile browser checks verify orbit, pan, and zoom changes without
  restarting demand-mode animation-frame scheduling.
- `@denovo/canvas-editor` is available through explicit facade exports with
  schema-validated add/update/remove and 2D/3D transform commands, atomic
  transactions, transient selection, serialized async plugin handlers,
  snapshot undo/redo, bounded history, tool/command registries, immutable state,
  and structural runtime synchronization.
- Strict hit input/result schemas use canvas-local CSS pixels, require stable
  document IDs for node hits, and expose instanced `instanceIndex` values.
- Canvas2D inverse-transform/topmost picking and Three.js nearest Raycaster
  picking are available through built-in runtime `hitTest()` methods.
- `connectEditorToCanvas()` combines document synchronization with a stable-host
  pointer bridge for hover, replace/toggle selection, pointer capture, and
  click-versus-drag discrimination. Desktop pointer and mobile touch browser
  checks pass across 3D→2D→3D canvas replacement.
- Custom renderers retain their M1 lifecycle without a new required method;
  missing optional hit capability produces `CanvasHitTestUnsupportedError`.
- Facade `connectEditorToRuntime()` and `connectEditorToCanvas()` install staged
  `CanvasPlugin.setup` command/tool registrations into each connected editor.
  Setup runs in config order, rejects command/tool conflicts, rolls back partial
  setup or editor installation, and removes only facade-owned registrations on
  disconnect or canvas destruction.
- Plugin lifecycle composition uses Effect internally while public setup,
  readiness, cleanup, and failure boundaries remain ordinary promises,
  functions, `CanvasPluginError`, and `CanvasEditorError` values.
- Strict `CanvasToolInput` pointer and keyboard schemas use canvas-local CSS
  pixels and reject invalid or excess fields at the public boundary.
- Editor active-tool state, activation changes, tool input serialization, and
  ordinary tool-domain errors are implemented without DOM or renderer types.
- `createSelectTool()` owns hover, primary click/tap selection, modifier
  toggling, drag rejection, pointer cancellation, and Escape-to-clear behavior.
- `connectCanvasToolInput()` routes normalized DOM input to the active editor
  tool while keeping renderer hit testing structural and tool state transient.
  Desktop mouse and mobile touch browser checks pass across renderer canvas
  replacement; the facade also keeps the active tool cursor synchronized.
- `createPanOrbitTool()` provides a transient selection-isolated Navigation
  mode, and `CanvasToolDefinition.navigation` declares whether the active tool
  allows or blocks renderer camera input.
- Built-in 3D and dynamic web runtimes expose the engine-neutral
  `CanvasNavigationInputRuntime` capability. The facade synchronizes it with
  the active tool and preserves the requested policy across 2D/3D canvas
  replacement without exposing `OrbitControls` publicly.
- Desktop mouse and mobile touch browser checks prove that Inspect blocks
  camera pixels, Navigate changes orbit/pan/zoom pixels, demand scheduling stays
  bounded, selection is unchanged, and ownership survives renderer replacement.
- `createTransformTool()` selects a hit node, owns navigation while dragging,
  keeps preview state outside the document/editor history, and commits one
  `transaction` with one `node.update` position patch on pointer release.
- Built-in Canvas2D and Three.js runtimes implement the structural
  `CanvasNodeTransformRuntime` capability. Canvas2D uses CSS-pixel deltas; 3D
  projects pointer rays onto a camera-facing plane through the original node.
  Dynamic/facade runtimes delegate the capability while custom renderers remain
  compatible through optional methods.
- Pointer cancellation, pointer leave, Escape, tool changes, disconnect, scene
  updates, and runtime destruction clear transform previews. The web input
  connector owns touch gestures while connected and restores the consumer's
  prior `touch-action` value on disconnect.
- Desktop mouse and iPhone touch browser checks prove that both 2D and 3D
  preview pixels move while document positions/history remain stable, then one
  history entry and one new position appear only after release.
- Core defines strict `translate.x`, `translate.y`, `translate.z`,
  `translate.xy`, `translate.xz`, and `translate.yz` handle IDs plus a
  renderer-independent translation constraint. The Transform tool accepts
  normalized `handle`/`gizmo` hits and preserves the existing pointer-session,
  preview, cancellation, and single-transaction contract.
- Canvas2D renders and hit-tests X/Y/XY handles and constrains CSS-pixel deltas.
  Three.js renders and raycasts X/Y/Z axes plus XY/XZ/YZ planes, resolves axis
  movement through screen projection, and resolves plane movement through
  world-plane ray intersections.
- `CanvasNodeTransformHandleRuntime` keeps handle targeting separate from the
  existing optional transform-preview capability. The facade derives the
  target from active Transform tool plus primary selection and preserves it
  across dynamic renderer replacement without persisting it.
- Desktop mouse and iPhone touch browser checks prove actual X-handle movement
  in 2D and 3D: only the X document component changes, preview remains
  transient, and release adds exactly one history entry. Four canvas captures
  record desktop/mobile 2D/3D handle visibility.
- `@denovo/canvas/styles.css` is static CSS with consumer-first `--dc-*`
  overrides plus Tailwind v4 and shadcn semantic-token fallbacks. Preset themes
  no longer inject inline token values that prevent consumer overrides.
- Axis/plane handle colors support generic `--dc-handle-color` and granular
  `--dc-handle-{x,y,z,xy,xz,yz}-color` overrides with Tailwind/shadcn semantic
  fallbacks. Browser CSS colors such as shadcn `oklch(...)` values are normalized
  before Three.js receives them.
- The Next playground is initialized as an actual shadcn/Tailwind v4 consumer
  and uses registry-generated `Button` and `ToggleGroup` components. Framework
  packages remain outside the default facade and editor/core boundaries.
- Public authoring contracts expose concrete selection, built-in node patch,
  descriptor-correlated plugin command, mode-specific renderer, callback
  result, and typed worker-protocol types. Generated package declarations
  contain no explicit `any`; remaining `unknown` positions are limited to
  validation, error, and unspecified protocol boundaries.
- Plugin-owned tool IDs use `plugin.<owner>.tool.<name>`, and all built-in tool
  factories preserve an explicit literal ID in their return type. Facade plugin
  command/tool registrations are fully validated before commit and stored as
  canonical snapshots; direct editor dispatch and cleanup also capture
  registration-time identifiers and parsers instead of rereading mutable
  caller objects.
- Facade document/scene/inline inputs and built-in/custom renderer inputs are
  mutually exclusive in TypeScript and checked again at the untyped runtime
  boundary. Conflicting sources and ignored adapters fail explicitly. The
  plugin registry is private, and placeholder node/renderer registration or
  unconnected storage config is not advertised as working API.
- The shared contributor rulebook enforces the public type safety gate: no
  explicit `any`, no convenience broad types when the domain is expressible,
  documented `unknown` boundaries, schema-derived contracts, and
  positive/negative consumer fixtures for every public type change.
- React, Vue, Svelte, and Solid view wrappers mount the facade
  `createCanvas(target, config)` instead of `@denovo/canvas-web`, expose
  `DenovoCanvasRuntime` through their runtime callbacks, and accept the
  exported `DenovoCanvasCommonConfig` as options. The facade exports
  `DenovoCanvasCommonConfig` and forwards `renderNode`. Adapter → facade is
  the only build-time dependency direction; the facade keeps
  `@denovo/react-canvas` as an optional peer for its `./react` re-export.
  See [2026-08-22 adapter facade mount](./history/2026-08-22-adapter-facade-mount.md).

- Core uses canonical document schema `0.2.0`. Strict legacy `0.1.0` input is
  migrated deterministically; unknown versions fail. Layers, groups,
  measurements, annotations, and their mode-specific relationships are
  canonical schema data rather than metadata conventions.
- Raw `node.update` commands require correlated `nodeMode` and `nodeType`.
  `createNodeUpdateCommand()` derives that identity and a concrete node-specific
  patch from the source node; group, layer, transform, and authoring inverses
  retain the same identity contract.
- Canvas2D and Three.js expose translate, rotate, and scale previews and stable
  handle identities. Canvas2D also exposes transient viewport pan/zoom. The web
  runtime renders and hit-tests groups, measurements, annotations, grids, snap
  markers, and authoring drafts without moving editor responsibilities into the
  renderer.
- The facade exports 2D shape, 3D primitive, measurement, annotation, property,
  grouping, effective-state, grid-snap, and work-plane helpers and preserves
  their structural runtime capabilities across renderer replacement.
- Editor-owned authoring sessions expose explicit asynchronous cancellation.
  Runtime replacement and disconnect invalidate pending resolver/provider work
  immediately, serialize preview cleanup through leases, and propagate cleanup
  failures without facade-owned fire-and-forget clearing.
- Backend selection is strict. `auto` resolves the implemented Canvas2D,
  WebGL2, or WebGPU backend compatible with the current mode and
  capabilities. 3D prefers WebGPU when the probe is true. Explicit
  `webgpu` is valid for 2D and 3D and never falls back to WebGL2 or
  Canvas2D. Unimplemented, unavailable, mismatched, or adapter-less
  requests fail without substituting another backend.
- The vanilla facade example exercises the authoring surface with explicit IDs,
  layers, work planes, grids, strict document reload, undo, and redo. Desktop
  mouse and real mobile touch acceptance covers the complete 2D/3D authoring
  workflow, dynamic renderer replacement, non-blank output, and bounded demand
  rendering.
- Core now exposes strict `Canvas3DSurfacePointRequest` and
  `Canvas3DSurfacePointResult` schemas with a correlated `box.face` feature and
  unit world normal. Editor core owns the separate
  `create3DSurfacePlacementTool`, exact source support offset, async session
  cancellation, preview lifecycle, and single-command commit. Three/web own
  analytic surface resolution and ghost rendering, while the facade wires
  scene-point, preview, and surface-point capabilities independently.
- The vanilla example exposes `Stack Box`. Desktop mouse and mobile touch
  verification place three boxes successively on newly committed top faces,
  place one box on the static target's +X face, and prove that hover/contact
  ghosts plus empty-space misses leave document, node count, and history
  unchanged until a successful release.
- First absorbed diagram showcase: `apps/playground-flow` release board
  (`html` + `edge` + `text`, no iframe). See
  [2026-08-25 absorbed flow showcase](./history/2026-08-25-flow-showcase.md).
- First absorbed hero showcase: `apps/playground-field` restates
  ThreeUI Warp Field as one `plugin.denovo.field` node. See
  [2026-08-25 absorbed field showcase](./history/2026-08-25-field-showcase.md).
- First absorbed graph showcase: `apps/playground-network` service map
  (`html` + `edge` + `text`, relation/time layout, no iframe). See
  [2026-08-25 absorbed network showcase](./history/2026-08-25-network-showcase.md).

## Active

- Next playground region/mask host (2026-09-07): the shadcn Next
  consumer rasterizes `rect` / `circle` mask JSON in its own pipeline
  and hides with `setNodeVisible`. See
  [2026-09-07 Next playground region/mask host](./history/2026-09-07-playground-region-mask-host.md).
- Host region/mask rasterization, 2D WebGPU `readPixels`, and a labeled
  16 ms frame-budget gate (2026-09-06): the vanilla host rasterizes
  `rect` / `circle` mask JSON, 2D WebGPU copies swapchain pixels for
  the host-drawer color gate, and `pnpm verify:performance` launches
  Metal GPU Chromium, requires WebGL2, gates 1k-boxes p50 on WebGL2 and
  explicit 3D WebGPU, and fails software GL. See
  [2026-09-06 host mask, WebGPU readback, frame budget](./history/2026-09-06-host-mask-webgpu-readback-frame-budget.md),
  [2026-09-06 GPU 16 ms frame budget](./history/2026-09-06-gpu-frame-budget-gate.md),
  and
  [2026-09-07 status hygiene and WebGPU 16 ms](./history/2026-09-07-status-hygiene-webgpu-frame-budget.md).
- Region/mask document and host-drawer pixels (2026-09-06): mask
  regions are `rect` / `circle` plus `metadata.role`. Host drawers
  register through `@denovo/canvas/web`. See
  [2026-09-06 region-mask and host-drawer pixels](./history/2026-09-06-region-mask-and-host-drawer-pixels.md).
- Kind colocation, named-operation catalog, and 2D WebGPU host
  drawers (2026-09-06): official kinds live under `kinds/`;
  `listNamedOperations()` enumerates the twenty operations; 2D WebGPU
  rasterizes host `draw2d` into the atlas when it fits. See
  [2026-09-06 kind catalog and WebGPU drawers](./history/2026-09-06-kind-catalog-webgpu-drawer.md).
- Kind drawer seam and kind enumeration (2026-09-06): a host
  `plugin.<org>.<kind>` registers paint and pick on
  `@denovo/canvas-web`. Missing drawers stay the gray marker.
  Unregister restores it. `listPluginNodeKinds()` returns readonly
  `{ type, mode }`. The facade does not export the drawer registration.
  See [Kind Drawer Seam](./kind-drawer-seam.md) and
  [2026-09-06 kind drawer seam](./history/2026-09-06-kind-drawer-seam.md).
- Extension surface decision (2026-09-04): kinds (schema, official
  drawer, named operations) are the only product-level extension seam.
  Optional engines are packages that emit core kinds. `CanvasPlugin`
  stays a per-canvas host bundle of tools and commands and must not
  grow node, renderer, storage, importer, or worker registration.
  `pluginState` may not carry a visual. The plugin taxonomy in
  [Extensibility](./extensibility.md) and the `plugins/*` shape in
  [Better Auth Style Architecture](./better-auth-style-architecture.md)
  are superseded as direction. See
  [Extension Surface Decision](./extension-surface-decision.md) and
  [2026-09-04 extension surface decision](./history/2026-09-04-extension-surface-decision.md).
- Framework surface (2026-08-25): 3D and 2D plugin nodes, official
  `plugin.denovo.field`, official `plugin.denovo.sparkline`, official
  `plugin.denovo.shade`, the Warp
  Field catalog, and the service-map graph catalog have landed. A
  plugin kind declares `2d`, `3d`, or `both`. Single-mode kinds fail
  closed in the other scene. `apps/playground-threeui` stays a visual
  reference, not product proof. See
  [Framework Surface](./framework-surface.md),
  [2026-08-25 official denovo sparkline](./history/2026-08-25-denovo-sparkline.md),
  [2026-08-25 plugin kinds in both modes](./history/2026-08-25-plugin-nodes-both-modes.md),
  [2026-08-25 2D plugin nodes](./history/2026-08-25-plugin-nodes-2d.md),
  [2026-08-25 official denovo field](./history/2026-08-25-denovo-field.md),
  [2026-08-25 absorbed field showcase](./history/2026-08-25-field-showcase.md),
  and
  [2026-08-25 absorbed network showcase](./history/2026-08-25-network-showcase.md).
- Product identity (2026-08-25): Denovo is a facade that restates
  open-source impressiveness as our documents. View is required for
  edit. An upstream room is absorbed only if the document still redraws
  after that host is removed. `apps/playground-threeui` stays a visual
  reference; Warp Field (`nodes: []` + original engine) fails the
  absorption test and is not product proof. Canvas UI (canvasui.dev)
  is the same class of host: html-in-canvas effect rooms, not a
  document SDK. See
  [Product Identity](./product-identity.md),
  [2026-08-25 product identity](./history/2026-08-25-product-identity.md),
  and
  [2026-09-02 Canvas UI reference](./history/2026-09-02-canvas-ui-reference.md).
- Isolated ThreeUI Community playground still vendors public MIT rooms
  (`apps/playground-threeui`). No facade export and no new node types.
  See
  [2026-08-24 ThreeUI Community playground](./history/2026-08-24-threeui-community-playground.md)
  and
  [2026-08-24 Warp Field as a Denovo document host](./history/2026-08-24-warp-field-denovo-host.md).
- Review hardening landed on 2026-08-17. See
  [2026-08-17 review-hardening](./history/2026-08-17-review-hardening.md).
- Product boundary (2026-08-22): advanced graph visuals in the
  Obsidian-plugin sense (nebula glow, planetary classes, 3D star fields)
  stay userland — the SDK ships performance primitives and extension
  points (`renderNode`, custom renderer adapters, plugin nodes, worker
  tasks), not decorative universes. Our work stops at performance
  optimization.
- Canonical schema stays `0.2.0`. `mesh` / `edge` / `text` / `html` are
  frozen as current `0.2.0` built-ins (no `0.3.0` bump). The repository
  is Apache-2.0. See
  [2026-08-17 open-source governance](./history/2026-08-17-open-source-governance.md).
- [M8 Diagram Contract](./m8-diagram-contract.md) acceptance checks ran
  on 2026-08-17, including a live-playground connector gesture on
  desktop and iPhone 14. M8 is contract-accepted, not a second product.
  The leftover vanilla M3 desktop/mobile suite re-ran on 2026-08-21.
- M0–M8 fully verified as of 2026-08-22 (see Current Phase for the three
  verification entries and recorded descopes).
- Authoring preview materials no longer mutate the cached 3D surface
  material. `verify:browser-rendering` failed on stacked-box preview
  cleanup until ghosts cloned the cache. See
  [2026-08-21 M3 suite and ghost material](./history/2026-08-21-m3-suite-ghost-material.md).
- v1 persistence slice landed on 2026-08-17: memory/filesystem
  `applyCommands` parity and undo/redo visibility. See
  [2026-08-17 v1 persistence applyCommands](./history/2026-08-17-v1-persistence-applycommands.md).
- Geometry store slice landed on 2026-08-17: mesh nodes accept
  `geometryAssetId`, BIM writes tessellation onto `AssetRef` +
  `CanvasGeometryStore`. See
  [2026-08-17 geometry store](./history/2026-08-17-geometry-store.md).
- WebGPU language slice landed on 2026-08-17: implemented `auto` backends
  stay Canvas2D/WebGL2; `webgpu` is reserved vocabulary, not a resolved
  result. See
  [2026-08-17 WebGPU language](./history/2026-08-17-webgpu-language.md).
- Open-source governance landed on 2026-08-17: Apache-2.0 LICENSE,
  NOTICE, CONTRIBUTING, CODE_OF_CONDUCT, and SECURITY. See
  [2026-08-17 open-source governance](./history/2026-08-17-open-source-governance.md).
- Geometry blob persistence landed on 2026-08-17: memory/filesystem/IndexedDB
  `uploadAsset`/`loadAsset`, plus `persistCanvasGeometryStore` /
  `hydrateCanvasGeometryStore`. See
  [2026-08-17 geometry blob persistence](./history/2026-08-17-geometry-blob-persistence.md).
- Adapter facade mount landed on 2026-08-22: all four framework wrappers
  mount `@denovo/canvas`, verified with typecheck, uncached build,
  public-api, and the full adapter browser smoke suite. See
  [2026-08-22 adapter facade mount](./history/2026-08-22-adapter-facade-mount.md).
- BIM multi-model federation landed on 2026-08-23: adapters stage more
  than one IFC at once, `toDocument()` emits one merged document, and
  property reads are keyed by `{ modelId, expressID }`. Federated
  `origin` writes `node.position` and widens the camera frame. Browser
  QA: playground `Federate copy` plus `verify:bim-federation`. See
  [2026-08-23 BIM multi-model federation](./history/2026-08-23-bim-multi-model-federation.md),
  [2026-08-23 BIM federated origin](./history/2026-08-23-bim-federated-origin.md),
  and
  [2026-08-24 BIM federation browser QA](./history/2026-08-24-bim-federation-browser.md).

## Next

1. **Framework surface:** 3D and 2D plugin-node unions, official
   `plugin.denovo.field`, official `plugin.denovo.sparkline`, official
   `plugin.denovo.shade`, and the
   Warp Field catalog landed. A kind declares `2d`, `3d`, or `both`.
   Host kinds register a drawer on `@denovo/canvas-web` or stay the
   gray marker. Do not wrap more ThreeUI
   rooms. Do not wrap Canvas UI rooms. `keycaps` / `hyperspace` stay
   unabsorbed. See
   [Framework Surface](./framework-surface.md) and
   [2026-08-25 official denovo sparkline](./history/2026-08-25-denovo-sparkline.md).
2. **Absorbed showcases:** diagram (`apps/playground-flow`,
   `pnpm verify:flow-showcase` 2/2), hero (`apps/playground-field`,
   `pnpm verify:field-showcase` 2/2), and graph
   (`apps/playground-network`, `pnpm verify:network-showcase`) landed.
   `apps/playground-graph` stays the throughput bench. See
   [Product Identity](./product-identity.md).
3. **Named authoring operations (slices 1–19 landed):**
   humans and agents share one function that compiles to existing
   commands. `setLayerVisible`, `setLayerLocked`, `setLayerName`,
   document-only `stackBox`, read-only `listNodes`, `listLayers`, and
   `listLabels`,
   `setFieldPattern`, `setSparklineStyle`, `setShadePattern`,
   `setNodeVisible`, `setNodeLocked`,
   `setNodeLayer`, `setText`, `setAnnotationText`,
   `removeNode`, `removeEdge`, `removeLayer`, `addLayer`, and
   `reorderLayer` are shipped.
   `listNodes` returns effective
   `{ id, type, layerId, visible, locked }` and no geometry.
   `listLayers` returns `{ id, name, visible, locked }` and no
   metadata. `listLabels` returns `{ id, type, layerId, text }` for
   `text` and `annotation` nodes. `setAnnotationText` writes
   `annotation` copy in 2D and 3D. See
   [Named Authoring Operations](./named-authoring-operations.md) and
   [2026-08-26 named operations setAnnotationText](./history/2026-08-26-named-operations-set-annotation-text.md).
4. **Graph field throughput (not presentation):** time/relation layout
   adapters and a packed 2D point field exist. Canvas stops at measured
   10k-point draw cost and screen-size clamp. Hosts (for example haru)
   own glow, cluster colour, and labels. A later absorbed graph showcase
   must use our vocabulary, not those skins. See
   [2026-08-22 graph field host presentation](./history/2026-08-22-graph-field-host-presentation.md).
5. **Next contract — mesh-surface measurement endpoints (complete):**
   the protocol extension landed 2026-08-22 —
   `resolveSurfacePoint` accepts `mesh` targets with correlated
   `mesh.triangle` hits (schema, Three resolver, facade; browser-verified) —
   and the follow-up tool slice landed the same day:
   `createDistanceMeasurementTool({ mode: "3d", capture: "surface" })`
   captures both endpoints on real box/mesh surfaces with explicit miss
   semantics and no work-plane fallback. See
   [2026-08-22 mesh surface points](./history/2026-08-22-mesh-surface-points.md)
   and the extension section in
   [M3.1 Surface Placement Contract](./m3-1-surface-placement-contract.md).
   The first explicit 3D WebGPU slice landed 2026-08-25; mesh and
   instance surface points landed 2026-08-26; 3D `auto` prefers WebGPU
   when the capability probe is true (2026-08-26). A labeled 16 ms
   1k-boxes gate now runs in `pnpm verify:performance` on Metal GPU
   WebGL2 and explicit 3D WebGPU: 1k-boxes p50 8.30 ms, `gated=true`.
   Software GL fails the run. WebGPU draw-call count is recorded, not
   batched to 1. A named CI machine is still not pinned (rationale in
   [2026-08-22 next contract decision](./history/2026-08-22-next-contract-decision.md)).
   See
   [2026-09-07 status hygiene and WebGPU 16 ms](./history/2026-09-07-status-hygiene-webgpu-frame-budget.md)
   and
   [2026-08-25 explicit WebGPU 3D](./history/2026-08-25-webgpu-explicit-3d.md).
6. **B-item residual risks (complete):** storey layers (2026-08-22),
   instance surface points (2026-08-22), and BIM multi-model federation
   (2026-08-23) have all landed. Federation: `loadModel` is additive,
   `toDocument()` merges staged models, `expressID` pairs with `modelId`,
   a single model keeps unprefixed ids, and `origin` places a model via
   `node.position`. Browser proof: playground `Federate copy` plus
   `verify:bim-federation`. See
   [2026-08-22 BIM storey layers](./history/2026-08-22-bim-storey-layers.md),
   [2026-08-22 mesh surface points](./history/2026-08-22-mesh-surface-points.md),
   [2026-08-23 BIM multi-model federation](./history/2026-08-23-bim-multi-model-federation.md),
   and
   [2026-08-23 BIM federated origin](./history/2026-08-23-bim-federated-origin.md).
7. **Extension surface (drawer seam, kind enumeration, catalog, and
   colocation complete):** `registerPluginNodeDrawer` lives on
   `@denovo/canvas-web`. `listPluginNodeKinds()` and
   `listNamedOperations()` are facade reads. Official kinds live under
   `kinds/`. 2D WebGPU stamps host `draw2d` when the atlas has room.
   Do not add `CanvasPluginContext` methods, `pluginState` consumers,
   ThreeUI rooms, a photo-editor vocabulary, BIM UI, a capability
   graph, or an agent protocol package. The region/mask need is served
   by `rect` / `circle` plus host `metadata`; vanilla and the Next
   playground rasterize that JSON. Proof: `pnpm verify:region-mask`.
   See
   [Kind Drawer Seam](./kind-drawer-seam.md) and
   [Extension Surface Decision](./extension-surface-decision.md).

## Blocked

- None.

## Evidence

- 2026-11-21: Lightweight 2D-only `@denovo/canvas/2d` entrypoint (zero Three.js / `three/webgpu` / `three-mesh-bvh` imports) landed for Issue #8 and was adopted by `apps/playground-flow`, reducing its Vite production JS bundle from 1,865.08 kB (513.11 kB gzip) to 361.07 kB (106.43 kB gzip, -80.6% raw / -79.3% gzip). `pnpm verify:public-api`, `pnpm verify:flow-showcase` (2/2), `pnpm verify:2d-performance`, `pnpm typecheck`, `pnpm build`, and `pnpm verify:docs` passed. See [lightweight 2D entrypoint](./history/2026-11-21-2d-lightweight-entrypoint.md).

- 2026-11-21: O(1) offscreen 2D minimap cache, HTML overlay diffing in `rebuildObjects()`, and allocation-free `canvas3DNodeEqual()` landed for Issue #7. `pnpm verify:2d-performance` passed (`10k-2d-rects` with minimap `panRender` p50 `0.00 ms` / p95 `0.10 ms`; `1k-2d-overlays` single-card edit invoked `renderNode` 1 time across 1,001 cards), alongside `pnpm verify:browser-rendering`, `pnpm verify:webgpu` (11/11), `pnpm verify:flow-showcase` (2/2), `pnpm verify:network-showcase` (2/2), `pnpm verify:diagram-rendering`, `pnpm verify:hit-testing` (7/7), `pnpm typecheck`, `pnpm build`, and `pnpm verify:docs`. See [minimap cache, HTML diff, and 3D equality](./history/2026-11-21-minimap-cache-html-diff-3d-eq.md).

- 2026-11-21: 3D `render.batch` sphere instancing and per-runtime `Canvas3DResourceCache` isolation landed for Issue #6. `pnpm verify:performance` passed with `drawCalls=1` / `geometries=1` on `1k-spheres` (8.30 ms p50) alongside `100-boxes` / `1k-boxes` / `10k-boxes` (all 8.30 ms p50, 16 ms GPU gates passed), and `pnpm verify:browser-rendering` passed across desktop and mobile with zero WebGL cross-context disposal warnings. See [3D sphere batching and resource cache](./history/2026-11-21-3d-sphere-batching-and-resource-cache.md).

- 2026-11-21: 2D high-frequency input rAF render coalescing landed for Issue #5. `pnpm verify:2d-performance` passed including the burst coalescing gate (20 synchronous wheel pan events → 1 Canvas2D render with full accumulated pan delta), alongside `pnpm verify:webgpu` (11/11), `pnpm verify:flow-showcase` (2/2), `pnpm verify:network-showcase` (2/2), `pnpm verify:diagram-rendering`, `pnpm verify:hit-testing` (7/7), `pnpm typecheck`, `pnpm build`, and `pnpm verify:docs`. See [2D rAF render coalescing](./history/2026-11-21-2d-raf-render-coalescing.md).

- 2026-11-21: 2D WebGPU GPU-resident vertex/atlas/bindGroup caching and `Canvas2DSpatialIndex` viewport culling landed for Issue #4. `pnpm verify:2d-performance` `10k-2d-webgpu` dropped `panRender` p50/p95 from 6.90 ms / 14.40 ms to 0.00 ms / 0.10 ms and GPU triangles from 20,002 to 210 (`drawCalls=1`), alongside `pnpm verify:webgpu` (11/11), `pnpm verify:hit-testing` (7/7), `pnpm verify:public-api`, `pnpm typecheck`, `pnpm build`, and `pnpm verify:docs`. See [2D WebGPU GPU-resident caching](./history/2026-11-21-2d-webgpu-resident-caching.md).

- 2026-11-21: TanStack-style fine-grained selector subscriptions (`subscribeCanvasSelector`, `shallowEqual`, React/Vue/Solid `useCanvasSelector`, Svelte `createCanvasSelectorStore`) landed for Issue #3 and were adopted by Next `MaskHost`. `pnpm verify:selectors` passed (4/4, 0 unnecessary React/Vue/headless updates across 100 hover transitions), along with `pnpm verify:public-api`, `pnpm verify:region-mask` (6/6), `pnpm verify:editor-core`, `pnpm typecheck`, `pnpm build`, and `pnpm verify:docs`. See [selector subscriptions](./history/2026-11-21-selector-subscriptions.md).

- 2026-11-21: 2D spatial index, viewport culling, O(visible) HTML overlay sync, and O(1) node lookups landed for Issue #2. `pnpm verify:2d-performance` passed (10k 2D rects `drawCalls` 10,001 → 28, `panRender` p50 3.70 ms → 0.00 ms, 200 `hitTest` calls 118.5 ms → 0.5 ms, `marquee` p50 3.30 ms → 0.00 ms; 1k HTML overlays `panRender` p50 0.80 ms → 0.10 ms). See [2D spatial index and viewport culling](./history/2026-11-21-2d-spatial-index-viewport-culling.md).

- 2026-11-21: The release board edits a selected card’s title, owner and status in one undo step, adds new cards, deletes selected cards (with incident edges) or edges in one undo step with Undo/Redo, and resets browser-saved state. Desktop mouse and mobile-emulated Chromium touch both verify that saving and reopening restores edited content, added cards, deleted edges, card positions and new connectors, and resetting restores the example board. See [release board card editing](./history/2026-11-21-release-board-editing.md).

- 2026-11-20: Next mask visibility, undo and redo passed through desktop mouse clicks and mobile-emulated Chromium taps in `pnpm verify:region-mask` (6/6). See [mask editing controls](./history/2026-11-20-mask-editing-controls.md).

- Next playground region/mask host (2026-09-07). `pnpm verify:region-mask`
  6/6 including Next `/mask` desktop and iPhone 14. `pnpm verify:public-api`
  ok. `pnpm verify:docs` 172 Markdown files, 606/606 local targets. See
  [2026-09-07 Next playground region/mask host](./history/2026-09-07-playground-region-mask-host.md).
- Status hygiene and 3D WebGPU 16 ms (2026-09-07). Current Phase no
  longer claims the 16 ms gate is unpinned. Kind drawer seam accepts
  2D WebGPU `readPixels` color. `pnpm verify:performance` WebGL2
  1k-boxes p50 8.30 ms `drawCalls=1`; WebGPU 1k-boxes p50 8.30 ms
  `drawCalls=24` time-gated, not batch-gated. `pnpm verify:docs` 171
  Markdown files, 602/602 local targets. See
  [2026-09-07 status hygiene and WebGPU 16 ms](./history/2026-09-07-status-hygiene-webgpu-frame-budget.md).
- GPU 16 ms frame budget (2026-09-06). `pnpm verify:performance`
  launches ANGLE Metal, forces WebGL2, `drawCalls=1` on 100/1k/10k,
  1k-boxes p50 8.30 ms, `kind=gpu`, `gated=true`, `passed=true`.
  Software GL with `requireGpu` fails. A 0 ms ceiling fails the live
  1k p50 before the 16 ms check. `pnpm verify:docs` 170 Markdown
  files, 595/595 local targets. See
  [2026-09-06 GPU 16 ms frame budget](./history/2026-09-06-gpu-frame-budget-gate.md).
- Host region/mask rasterization, 2D WebGPU `readPixels`, and labeled
  16 ms frame budget (2026-09-06). `pnpm typecheck` 36/36.
  `pnpm build` 25/25. `pnpm verify:public-api` ok.
  `pnpm verify:region-mask` 4/4. `pnpm verify:webgpu` 11/11 including
  host-drawer WebGPU color via `readPixels`. `pnpm verify:docs` 169
  Markdown files, 590/590 local targets. See
  [2026-09-06 host mask, WebGPU readback, frame budget](./history/2026-09-06-host-mask-webgpu-readback-frame-budget.md).
- Region/mask document and host-drawer pixels (2026-09-06).
  `pnpm verify:region-mask` 2/2. `pnpm verify:webgpu` 11/11 including
  host-drawer WebGPU hit/triangles and Canvas2D non-marker pixels.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok (`./web` subpath).
  `pnpm verify:docs` 168 Markdown files, 585/585 local targets.
  Screenshots `artifacts/verification/region-mask.png` and
  `webgpu-host-drawer.png`. See
  [2026-09-06 region-mask and host-drawer pixels](./history/2026-09-06-region-mask-and-host-drawer-pixels.md).
- Kind colocation, named-operation catalog, and 2D WebGPU host
  drawers (2026-09-06). `listNamedOperations()` returns 20 names
  including `setShadePattern` and `listNodes`. 2D WebGPU bundle
  contains `resolveHostPluginNodeDraw2d`. Official kind files live
  under `kinds/`. `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:hit-testing` 7/7.
  `pnpm verify:editor-core` ok. `pnpm verify:document-schema` 45
  checks. `pnpm verify:docs` 167 Markdown files, 581/581 local
  targets. See
  [2026-09-06 kind catalog and WebGPU drawers](./history/2026-09-06-kind-catalog-webgpu-drawer.md).
- Kind drawer seam and kind enumeration (2026-09-06). Host
  `plugin.test.host` paints non-marker Canvas2D fills and a non-gray
  WebGL2 object, hits by id, falls back to `#64748b` without a drawer,
  and restores the marker after unregister. `listPluginNodeKinds()`
  returns official field/sparkline/shade with mode. Facade does not
  export `registerPluginNodeDrawer`.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:hit-testing` 6/6 including
  the four host-drawer observations plus double-register.
  `pnpm verify:docs` 166 Markdown files, 577/577 local targets.
  2D WebGPU host-drawer pixels unmeasured. No vanilla host-kind page
  (vanilla must not depend on `@denovo/canvas-web`). See
  [2026-09-06 kind drawer seam](./history/2026-09-06-kind-drawer-seam.md).
- Extension surface decision (2026-09-04). Documentation plus JSDoc on
  `CanvasPlugin` and `pluginState`; no export or schema change.
  `pnpm verify:docs` 160 Markdown files, 542/542 local targets.
  `pnpm typecheck` 36/36. Build, public API, browser, and editor-core
  gates not run (no behavior changed). See
  [2026-09-04 extension surface decision](./history/2026-09-04-extension-surface-decision.md).
- Canvas UI reference (2026-09-02). canvasui.dev is a shadcn-style
  html-in-canvas effect registry, not an editor SDK. Do not wrap it.
  Do not add `vgpu`. Documentation only. `pnpm verify:docs` 162
  Markdown files, 520/520 local targets. See
  [2026-09-02 Canvas UI reference](./history/2026-09-02-canvas-ui-reference.md).
- vgpu catalog as documents (2026-08-28). Official
  `plugin.denovo.shade` (`gradient` | `wave`) plus existing
  `instances` and section-plane clip restate vgpu example graphics
  as documents. No WGSL on the document. No playground.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:document-schema` 45
  checks. `pnpm verify:editor-core` ok.
  `pnpm verify:vgpu-catalog` 4/4. `pnpm verify:docs` 161 Markdown
  files, 509/509 local targets. See
  [2026-08-28 vgpu catalog as documents](./history/2026-08-28-vgpu-catalog.md).
- WebGPU field compute stays resident (2026-08-28). Streak travel
  copies into Three's vertex buffer. The hot path does not
  `MAP_READ`. `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:webgpu` 9/9.
  `pnpm verify:docs` 161 Markdown files, 509/509 local targets. See
  [2026-08-28 WebGPU field compute stays resident](./history/2026-08-28-webgpu-compute-resident.md).
- WebGPU field compute (2026-08-28). On WebGPU, `plugin.denovo.field`
  streak travel runs in a compute shader. The document is unchanged.
  Letter patterns and WebGL2 stay on the CPU tick.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:webgpu` 9/9.
  `pnpm verify:docs` 159 Markdown files, 505/505 local targets. See
  [2026-08-28 WebGPU field compute](./history/2026-08-28-webgpu-compute-field.md).
- Explicit 2D WebGPU (2026-08-27). `backend: "webgpu"` on a 2D
  document draws official 2D nodes through a GPU canvas context.
  2D `auto` stays Canvas2D. Missing GPU is `capability-unavailable`.
  Named operations and hit-testing stay on the same document.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:webgpu` 8/8.
  `pnpm verify:docs` 158 Markdown files, 503/503 local targets. See
  [2026-08-27 WebGPU 2D](./history/2026-08-27-webgpu-2d.md).
- 3D `auto` prefers WebGPU (2026-08-26). When
  `detectCanvasBackendCapabilities().webgpu` is true, 3D `auto`
  resolves to `webgpu`. If `requestAdapter()` is empty, it falls
  back to WebGL2 and reports that result. Pixel-sampling gates
  stay on WebGL2. `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok.   `pnpm verify:webgpu` 7/7.
  `pnpm verify:browser-rendering` ok.
  `pnpm verify:docs` 157 Markdown files, 501/501 local targets. See
  [2026-08-26 WebGPU auto 3D](./history/2026-08-26-webgpu-auto-3d.md).
- WebGPU mesh and instance surface points (2026-08-26). Explicit
  `backend: "webgpu"` accepts the same `mesh` / `instances`
  `resolveSurfacePoint` contract as WebGL2. `pnpm typecheck` 36/36.
  `pnpm build` 25/25. `pnpm verify:webgpu` 6/6, desktop and mobile
  `drawn`. `pnpm verify:docs` 156 Markdown files, 498/498 local
  targets. See
  [2026-08-26 WebGPU mesh and instance surface points](./history/2026-08-26-webgpu-mesh-instances-surface.md).
- Named operations `setAnnotationText` (2026-08-26). Compiles to
  `node.update` of `text` on a 2D or 3D `annotation` node. Empty
  string and non-annotation nodes are `invalid-command`.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:editor-core` ok.
  `pnpm verify:named-operations` 3/3. `pnpm verify:docs` pending this
  run. See
  [2026-08-26 named operations setAnnotationText](./history/2026-08-26-named-operations-set-annotation-text.md).
- WebGPU capability detect (2026-08-26).
  `detectCanvasBackendCapabilities()` is public and detection-only.
  `auto` still never selects WebGPU. `pnpm typecheck` 36/36.
  `pnpm build` 25/25. `pnpm verify:public-api` ok.
  `pnpm verify:webgpu` 4/4, desktop and mobile `drawn`.
  `pnpm verify:docs` 154 Markdown files, 493/493 local targets. See
  [2026-08-26 WebGPU capability detect](./history/2026-08-26-webgpu-capability-detect.md).
- Named operations `listLabels` (2026-08-26). Read-only
  `{ id, type, layerId, text }` for `text` and `annotation` nodes.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:editor-core` ok.
  `pnpm verify:named-operations` 3/3. `pnpm verify:docs` 153 Markdown
  files, 491/491 local targets. See
  [2026-08-26 named operations listLabels](./history/2026-08-26-named-operations-list-labels.md).
- Vanilla layer toggles (2026-08-25). Hide and lock call
  `setLayerVisible` / `setLayerLocked` instead of raw `layer.update`.
  `pnpm verify:named-operations` 3/3.
  `pnpm verify:docs` 152 Markdown files, 489/489 local targets. See
  [2026-08-25 vanilla layer named ops](./history/2026-08-25-vanilla-layer-named-ops.md).
- Named operations `setText` (2026-08-25). Compiles to `node.update`
  of `text` on a 2D `text` node. Non-text is `invalid-command`.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:editor-core` ok.
  `pnpm verify:named-operations` 3/3. `pnpm verify:docs` 151 Markdown
  files, 487/487 local targets. See
  [2026-08-25 named operations setText](./history/2026-08-25-named-operations-set-text.md).
- Named operations `setNodeLayer` (2026-08-25). Compiles to
  `node.update` of `layerId`. Locked node or locked target layer is
  `locked-target`. `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:editor-core` ok.
  `pnpm verify:named-operations` 3/3. `pnpm verify:docs` 150 Markdown
  files, 485/485 local targets. See
  [2026-08-25 named operations setNodeLayer](./history/2026-08-25-named-operations-set-node-layer.md).
- Named operations `setLayerName` (2026-08-25). Compiles to
  `layer.update` of `name`. Locked layer is `locked-target`.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:editor-core` ok.
  `pnpm verify:named-operations` 3/3. `pnpm verify:docs` 149 Markdown
  files, 483/483 local targets. See
  [2026-08-25 named operations setLayerName](./history/2026-08-25-named-operations-set-layer-name.md).
- Official `plugin.denovo.sparkline` (2026-08-25). Closed 2D props,
  official drawer, `setSparklineStyle`. No new playground.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:document-schema` 44
  checks. `pnpm verify:hit-testing` ok. `pnpm verify:editor-core`
  ok. `pnpm verify:denovo-sparkline` 2/2. `pnpm verify:docs` 148
  Markdown files, 481/481 local targets. See
  [2026-08-25 official denovo sparkline](./history/2026-08-25-denovo-sparkline.md).
- Named operations `reorderLayer` (2026-08-25). Compiles to
  `layer.reorder`. Already at that index does not grow history.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:editor-core` ok.
  `pnpm verify:named-operations` 3/3. `pnpm verify:docs` 147 Markdown
  files, 478/478 local targets. See
  [2026-08-25 named operations reorderLayer](./history/2026-08-25-named-operations-reorder-layer.md).
- Named operations `addLayer` (2026-08-25). Compiles to `layer.add`.
  Omit `index` to append. Duplicate id is `layer-already-exists`.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:editor-core` ok.
  `pnpm verify:named-operations` 3/3. `pnpm verify:docs` 146 Markdown
  files, 476/476 local targets. See
  [2026-08-25 named operations addLayer](./history/2026-08-25-named-operations-add-layer.md).
- WebGPU section plane (2026-08-25). Explicit `backend: "webgpu"` uses
  a `ClippingGroup` for `setSectionPlane`. WebGL2 still uses renderer
  clipping planes. `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:webgpu` 4/4. `pnpm verify:docs` 145 Markdown files,
  474/474 local targets. See
  [2026-08-25 WebGPU section plane](./history/2026-08-25-webgpu-section-plane.md).
- Explicit 3D WebGPU (2026-08-25). `backend: "webgpu"` resolves on 3D
  when `navigator.gpu` is present. `auto` stays Canvas2D/WebGL2. A 2D
  request is `mode-mismatch`. Missing GPU is `capability-unavailable`.
  Three.js WebGL fallback is rejected. `pnpm typecheck` 36/36.
  `pnpm build` 25/25. `pnpm verify:public-api` ok.
  `pnpm verify:webgpu` 3/3, desktop and mobile `drawn`.
  `pnpm verify:docs` 144 Markdown files, 471/471 local targets. See
  [2026-08-25 explicit WebGPU 3D](./history/2026-08-25-webgpu-explicit-3d.md).
- Named operations `removeLayer` (2026-08-25). Compiles to
  `layer.remove`. Empty layer requires `targetLayerId: null`; a
  non-empty layer requires an explicit other layer.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:editor-core` ok.
  `pnpm verify:named-operations` 3/3. `pnpm verify:docs` 143 Markdown
  files, 468/468 local targets. See
  [2026-08-25 named operations removeLayer](./history/2026-08-25-named-operations-remove-layer.md).
- Named operations `removeEdge` (2026-08-25). Compiles to
  `node.remove` of an `edge`. Pair with `removeNode` in one list.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:editor-core` ok.
  `pnpm verify:named-operations` 3/3. `pnpm verify:docs` 142 Markdown
  files, 466/466 local targets. See
  [2026-08-25 named operations removeEdge](./history/2026-08-25-named-operations-remove-edge.md).
- Named operations `removeNode` (2026-08-25). Compiles to
  `node.remove`. Fails on missing, locked, edge-referenced, and
  non-empty group nodes. `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:editor-core` ok.
  `pnpm verify:named-operations` 3/3. `pnpm verify:docs` 141 Markdown
  files, 463/463 local targets. See
  [2026-08-25 named operations removeNode](./history/2026-08-25-named-operations-remove-node.md).
- Named operations `listLayers` (2026-08-25). Read-only
  `{ id, name, visible, locked }` in document order.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:editor-core` ok.
  `pnpm verify:named-operations` 3/3. `pnpm verify:docs` 140 Markdown
  files, 461/461 local targets. See
  [2026-08-25 named operations listLayers](./history/2026-08-25-named-operations-list-layers.md).
- Named operations `setLayerLocked` (2026-08-25). Compiles to
  `layer.update`. Unlocking the layer itself is allowed.
  `pnpm typecheck` 36/36. `pnpm build` 25/25.
  `pnpm verify:public-api` ok. `pnpm verify:editor-core` ok.
  `pnpm verify:named-operations` 3/3. `pnpm verify:docs` 139 Markdown
  files, 458/458 local targets. See
  [2026-08-25 named operations setLayerLocked](./history/2026-08-25-named-operations-set-layer-locked.md).
- Named operations node flags (2026-08-25). `setNodeVisible` and
  `setNodeLocked` compile to `node.update`. `pnpm typecheck` 36/36.
  `pnpm build` 25/25. `pnpm verify:public-api` ok.
  `pnpm verify:editor-core` ok including 2D `rect`.
  `pnpm verify:named-operations` 3/3. `pnpm verify:docs` 138 Markdown
  files, 456/456 local targets. See
  [2026-08-25 named operations node flags](./history/2026-08-25-named-operations-node-flags.md).
- Plugin kinds in both modes (2026-08-25). A kind may declare `2d`,
  `3d`, or `both`. 3D is not a later slice. `pnpm typecheck` 36/36.
  `pnpm build` 25/25. `pnpm verify:public-api` ok.
  `pnpm verify:document-schema` 43 checks including
  `plugin.test.badge` in both scenes. `pnpm verify:docs` 137 Markdown
  files, 454/454 local targets. See
  [2026-08-25 plugin kinds in both modes](./history/2026-08-25-plugin-nodes-both-modes.md).
- 2D plugin nodes (2026-08-25). `pnpm typecheck` 36/36. `pnpm build`
  25/25. `pnpm verify:public-api` ok, including `Canvas2DPluginNode`.
  `pnpm verify:document-schema` 43 checks including
  `plugin-nodes-register-and-parse-by-mode`. `pnpm verify:hit-testing`
  ok including 48×48 marker bounds. `pnpm verify:editor-core` ok.
  `pnpm verify:docs` 136 Markdown files, 450/450 local targets. See
  [2026-08-25 2D plugin nodes](./history/2026-08-25-plugin-nodes-2d.md).
- Network layout routing (2026-08-25). Relation stacks down from the
  origin, orthogonal ports retarget when they no longer aim at the
  neighbor, and the service map fits the camera after layout.
  `pnpm verify:hit-testing` ok. `pnpm verify:editor-core` ok.
  `pnpm verify:network-showcase` 2/2. `pnpm verify:docs` 135 Markdown
  files, 446/446 local targets. See
  [2026-08-25 Network layout routing](./history/2026-08-25-network-layout-routing.md).
- HTML overlay cull (2026-08-25). Overlay visibility uses world-bounds
  intersection, not the `html` origin. Facing orthogonal stubs stay
  inside the port gap. `pnpm verify:hit-testing` ok.
  `pnpm verify:network-showcase` 2/2 including a card whose origin is
  off-screen. `pnpm verify:docs` 134 Markdown files, 444/444 local
  targets. See
  [2026-08-25 HTML overlay culls by bounds](./history/2026-08-25-html-overlay-cull.md).
- HTML overlay zoom (2026-08-25). `pnpm verify:hit-testing` ok.
  `pnpm verify:network-showcase` 2/2 including overlay size at zoom 2
  (`400×192`). See
  [2026-08-25 HTML overlay follows zoom](./history/2026-08-25-html-overlay-zoom.md).
- Service map catalog (2026-08-25). `pnpm typecheck` 36/36.
  `pnpm build` 25/25. `pnpm verify:public-api` ok.
  `pnpm verify:network-showcase` 2/2. Desktop: no iframe, no
  point-field overlay, API hub hit-test, relation layout moves
  positions, undo restores `[80, 168]`. Mobile iPhone 14: no iframe,
  nine cards. Screenshots
  `artifacts/verification/network-service-map.png` and
  `network-service-map-mobile.png`. `pnpm verify:docs` 132 Markdown
  files, 437/437 local targets. See
  [2026-08-25 absorbed network showcase](./history/2026-08-25-network-showcase.md).
- Warp Field catalog (2026-08-25). `pnpm typecheck` 35/35.
  `pnpm build` 24/24. `pnpm verify:field-showcase` 2/2. Desktop: no
  iframe, field hit-test, `setFieldPattern` to letters, undo restores
  streaks, compare board shows ThreeUI source as text and live
  `plugin.denovo.field` props. Mobile iPhone 14: no iframe, streaks
  paint. Screenshots `artifacts/verification/field-warp-field.png` and
  `field-warp-field-mobile.png`. `pnpm verify:docs` 131 Markdown files,
  432/432 local targets. See
  [2026-08-25 absorbed field showcase](./history/2026-08-25-field-showcase.md).
- Official `plugin.denovo.field` (2026-08-25). `pnpm typecheck` 34/34.
  `pnpm build` 23/23. `pnpm verify:public-api` ok.
  `pnpm verify:document-schema` 43 checks including
  `official-denovo-field-parses-without-host-register`.
  `pnpm verify:editor-core` ok. `pnpm verify:denovo-field` 2/2.
  `pnpm verify:docs` 130 Markdown files, 428/428 local targets. See
  [2026-08-25 official denovo field](./history/2026-08-25-denovo-field.md).
- 3D plugin nodes (2026-08-25). `pnpm typecheck` and `pnpm build` 23/23.
  `pnpm verify:public-api` ok. `pnpm verify:document-schema` 42 checks
  including `plugin-nodes-register-and-parse-in-3d-only`.
  `pnpm verify:editor-core` ok. `pnpm verify:docs` 129 Markdown files,
  425/425 local targets. See
  [2026-08-25 3D plugin nodes](./history/2026-08-25-plugin-nodes.md).
- Framework surface designed 2026-08-25. Documentation only.
  `pnpm verify:docs` passed: 128 Markdown files, 421/421 local targets.
  See
  [2026-08-25 framework surface](./history/2026-08-25-framework-surface.md).
- `pnpm verify:flow-showcase`: passed 2/2 on 2026-08-25. Desktop: no
  iframe, five cards, Build hit-test, hide labels, undo. Mobile
  iPhone 14: no iframe, five cards. Screenshots
  `artifacts/verification/flow-release-board.png` and
  `artifacts/verification/flow-release-board-mobile.png`. See
  [2026-08-25 absorbed flow showcase](./history/2026-08-25-flow-showcase.md).
- Product identity recorded 2026-08-25. Documentation pointers only.
  `pnpm verify:docs` after the flow showcase: 126 Markdown files,
  399/399 local targets. Previously 125 / 394/394 at identity-only.
  See
  [2026-08-25 product identity](./history/2026-08-25-product-identity.md).
- `pnpm --filter @denovo/canvas-threeui-example typecheck` and `build`
  passed on 2026-08-24 for the Warp Field Denovo host. Browser: custom
  backend, 1408×547 canvas, screenshot
  `artifacts/verification/warp-field-denovo.png`. See
  [2026-08-24 Warp Field as a Denovo document host](./history/2026-08-24-warp-field-denovo-host.md).
- `pnpm typecheck`: passed on 2026-08-24 (32 tasks) after named-operations
  slice 1; previously 32/32 on 2026-08-23 after federated origin.
- `pnpm build`: passed on 2026-08-24 (21 packages/apps) after
  named-operations slice 1; previously 21/21 on 2026-08-23 after
  federated origin.
- `pnpm verify:public-api`: passed on 2026-08-24 after named-operations
  slice 3, including `listNodes` / `ListedNode` fixtures (no geometry
  fields, extra options rejected). Previously passed after slice 2 the
  same day.
- `pnpm verify:m4-performance`: passed on 2026-08-22 (11 named checks) —
  LOD schema defaults/validation/round-trip and chunk-loader ordering,
  budget batching, cancellation, and recovery.
- `pnpm verify:performance`: passed on 2026-08-22 with the new batching
  gate (`drawCalls=1` per workload). Baselines: 100 boxes p50 16.5 ms,
  1k 66.3 ms, 10k 143.1 ms (headless, machine-dependent).
- LOD browser measurement via ego-browser on 2026-08-22: 301 spheres,
  triangles 664,608 → 17,312 (−97.4%) at equal draw calls; hit testing
  resolves through the active LOD level.
- [2026-08-22 M4 LOD controls, chunk loading, and batching gate](./history/2026-08-22-m4-lod-chunk-loading.md)
- `pnpm verify:bim-worker`: passed on 2026-08-23 (7 named checks) — the
  2026-08-22 single-model suite, federation without id collision, and
  `bim-worker-federated-origin-offsets-nodes-and-camera` (`beta` at
  `[40, 0, 0]`, camera `target.x` greater than the single-model frame).
  Previously 6 checks after federation, 5 on 2026-08-22.
- `pnpm verify:bim-federation`: passed on 2026-08-24 (1 named check) —
  Chromium click of playground `Federate copy` yields
  `sample:115@[0,0,0]` + `copy:115@[40,0,0]`, unique ids, camera
  `target.x` 8.219 → 28.219, screenshot
  `artifacts/verification/bim-federation.png`.
- `pnpm verify:bim-rendering`: passed on 2026-08-24 (76 colors, resize,
  no errors) after the playground federate control landed.
- [2026-08-23 BIM multi-model federation](./history/2026-08-23-bim-multi-model-federation.md)
- [2026-08-23 BIM federated origin](./history/2026-08-23-bim-federated-origin.md)
- [2026-08-24 BIM federation browser QA](./history/2026-08-24-bim-federation-browser.md)
- Section plane verified in Chromium via ego-browser on 2026-08-22:
  upper-half geometry ratio 0.0952 → 0 under
  `setSectionPlane({normal:[0,-1,0], constant:0})`, lower half unchanged,
  exact restore on clear. See
  [2026-08-22 M7 worker parsing and section plane](./history/2026-08-22-m7-worker-parsing-section-plane.md).
- `pnpm verify:bim-rendering`: passed on 2026-08-22 after the BIM adapter
  refactor onto the shared parse core.
- `pnpm verify:worker-tasks`: passed on 2026-08-22 (9 named checks) —
  loopback-worker coverage of the task vocabulary, FIFO pool semantics,
  error recovery, dispose, and unknown-task failures.
- Worker RTT measured in Chromium via ego-browser on 2026-08-22:
  p95 1.6/0.8/8.4 ms for 12 KB/1.2 MB/12 MB; rAF delay during a 12 MB
  worker conversion 0.4 ms vs 86.2 ms on-main. See
  [M4 Performance Thresholds](./m4-performance-thresholds.md).
- `pnpm verify:browser-rendering-adapters`: passed on 2026-08-22 for React,
  Vue, Svelte, Solid (render + resize + 3d→2d swap), Bim, and Diagram
  including desktop/mobile connector gestures.
- [2026-08-22 M4 worker task queue and OffscreenCanvas capability](./history/2026-08-22-m4-worker-task-queue.md)
- `pnpm verify:document-schema`: passed on 2026-08-22 (39 named checks),
  including edge endpoint/same-layer/port validation,
  `m8-node-update-roundtrips-edge-text-html`, and deterministic `0.1.0` →
  `0.2.0` migration. Previously passed on 2026-08-21.
- `pnpm verify:editor-core`: passed on 2026-08-24, adding `listNodes`
  (document order, empty layer `[]`, unknown layer, hidden layer
  effective `visible: false`, then `stackBox` from a listed box id).
  Previously included `stackBox` and `setLayerVisible` the same day.
- `pnpm verify:named-operations`: passed on 2026-08-24 after slice 3
  browser QA — BIM Hide/Show Level 2 plus vanilla Stack +Y on
  `static-box` (`[0, 1.2, 0]`, second click does not grow undo,
  screenshots
  `artifacts/verification/named-ops-hide-level-2.png` and
  `named-ops-stack-box.png`).
- `pnpm verify:server`: passed on 2026-08-22 (36 assertions), adding six
  IndexedDB adapter checks (`fake-indexeddb`) to the existing
  conflict-does-not-overwrite, memory/filesystem `applyCommands`, undo/redo
  `history.changed` persistence, and geometry blob upload/hydrate coverage.
  Previously passed on 2026-08-21 (30 assertions).
- `pnpm verify:hit-testing`: passed on 2026-08-22, including M8 edge path
  resolution (`orthogonal` waypoints, quadratic control, ignored
  `routing: "curved"`). Previously passed on 2026-08-17.
- `pnpm verify:diagram-rendering`: passed on 2026-08-22 as part of the
  adapter suite run (desktop + mobile connector gestures, overlay card,
  textContent probe, edge-follows-source, missing `flyToNode`).
- [2026-08-22 M5, M6, and M8 milestone verification](./history/2026-08-22-m5-m6-m8-milestone-verification.md)
- `pnpm verify:browser-rendering`: passed on 2026-08-21 after cloning
  cached surface materials for authoring ghosts. Desktop mouse and
  iPhone 14 touch cover 2D/3D authoring, surface stacking, and demand
  rendering.
- `pnpm verify:performance`: re-measured on 2026-08-21 with
  `drawCalls=1` / `geometries=1`. Frame p50: 100 boxes 8.80 ms, 1k
  50.00 ms, 10k 116.60 ms. No pass/fail gates.
- `pnpm verify:docs`: passed on 2026-08-24 after contributor-governance
  and repository-skill generalization (119 Markdown files, 369/369 local
  targets, 0 symlinks, 0 conflict markers, 4/4 canonical contributor
  entrypoints, 4/4 repository skills, 5/5 required project-status headings).
  The pull-request template also passed 6/6 required headings.
  Broken canonical-link, mismatched skill-name, and missing PR evidence-heading
  mutations each produced the expected 1-error red result before restoration.
  The Skill Creator validator also passed 4/4 skills. `git diff --check` passed.
  See
  [2026-08-24 contributor governance](./history/2026-08-24-contributor-governance.md).
- Generated declaration `any` audit and positive/negative TypeScript consumer
  fixtures: passed on 2026-07-20; zero explicit `any` occurrences across public
  declaration files (the Vue adapter is exempt — Vue's `DefineComponent` emits
  `any`).
- Repository-local Markdown link audit: passed on 2026-07-20 with zero missing
  targets.
- `doc-governance-conflicts.py --root .`: passed on 2026-07-20 with no conflict
  files, symlinks, external symlinks, or tracked Obsidian state.
- `doc-governance-audit.py --root .`: passed on 2026-07-16. Obsidian help and
  vault-level checks succeeded; 45 Markdown files had no duplicate phase status
  claims, broken local links, missing expected paths, or schema violations.
- [M0 public API history](./history/2026-07-10-m0-public-api-contract.md)
- [2026-08-24 contributor governance](./history/2026-08-24-contributor-governance.md)
- [Agent rules history](./history/2026-07-10-agent-rules.md)
- [Browser rendering stability history](./history/2026-07-10-browser-rendering-stability.md)
- [Document schema stability history](./history/2026-07-10-document-schema-stability.md)
- [Internal Effect setup history](./history/2026-07-10-internal-effect-setup.md)
- [Internal Effect and TypeScript 7 policy](./history/2026-07-10-effect-ts7-internal-policy.md)
- [3D demand rendering](./history/2026-07-10-3d-demand-rendering.md)
- [Scene dimension contract](./history/2026-07-10-scene-dimension-contract.md)
- [Custom renderer runtime](./history/2026-07-10-custom-renderer-runtime.md)
- [Document JSON and asset references](./history/2026-07-10-document-json-runtime.md)
- [M1 camera controls and milestone verification](./history/2026-07-10-camera-controls-m1.md)
- [M2 editor core first verified slice](./history/2026-07-11-editor-core-first-slice.md)
- [M2 normalized hit testing and pointer selection](./history/2026-07-11-normalized-hit-selection.md)
- [M2 editor core milestone verification](./history/2026-07-11-m2-editor-core-verified.md)
- [M3 normalized tool input and select-tool routing](./history/2026-07-12-m3-tool-routing-first-slice.md)
- [M3 Navigation ownership and shadcn styling](./history/2026-07-14-m3-navigation-shadcn-styling.md)
- [M3 transient Transform tool](./history/2026-07-14-m3-transform-tool.md)
- [M3 transform axis/plane handles](./history/2026-07-14-m3-transform-handles.md)
- [Public type contract hardening](./history/2026-07-14-public-type-contract-hardening.md)
- [Public type safety agent rule](./history/2026-07-15-public-type-safety-agent-rule.md)
- [M3 authoring contract implementation](./history/2026-07-15-m3-authoring-tools.md)
- [M3 authoring tools verification](./history/2026-07-16-m3-authoring-verified.md)
- [M3.1 surface placement and stacking verification](./history/2026-07-16-m3-1-surface-placement.md)
- [2026-08-17 review hardening](./history/2026-08-17-review-hardening.md)
- [2026-08-17 M8 contract and 0.2.0 freeze](./history/2026-08-17-m8-contract-0.2.0-freeze.md)
- [2026-08-17 M8 contract verification](./history/2026-08-17-m8-contract-verification.md)
- [2026-08-17 M8 in-browser connector](./history/2026-08-17-m8-connector-browser.md)
- [2026-08-17 ego-browser html overlay](./history/2026-08-17-ego-browser-html-overlay.md)
- [2026-08-17 trackpad wheel boundary](./history/2026-08-17-trackpad-wheel-boundary.md)
- [2026-08-17 v1 persistence applyCommands](./history/2026-08-17-v1-persistence-applycommands.md)
- [2026-08-17 geometry store](./history/2026-08-17-geometry-store.md)
- [2026-08-17 WebGPU language](./history/2026-08-17-webgpu-language.md)
- [2026-08-17 open-source governance](./history/2026-08-17-open-source-governance.md)
- [2026-08-17 geometry blob persistence](./history/2026-08-17-geometry-blob-persistence.md)
- [2026-08-21 M3 suite and ghost material](./history/2026-08-21-m3-suite-ghost-material.md)
