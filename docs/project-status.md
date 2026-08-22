# Project Status

Last updated: 2026-08-22.

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

Recorded descopes inside those verdicts: the 16 ms frame-budget gate needs
a pinned measurement environment; an OffscreenCanvas rendering path is not
an M4 deliverable; the XKT/xeokit viewer adapter stays out of M7 (AGPL);
mesh-surface-picked measurement endpoints are a future M3.1-contract
extension.

v1 focus remains the framework-agnostic 2D/3D editor engine. Diagram and
BIM stay optional packages, not a second product identity. See
[2026-08-17 review-hardening](./history/2026-08-17-review-hardening.md).

## Complete

- Monorepo scaffold exists with framework-agnostic core/web packages, optional
  React adapter, server, worker, BIM, and examples.
- `@denovo/canvas` facade package exists as the current public entrypoint.
- Public API contract verification exists and passes.
- Renderer backend vocabulary includes `auto`, `webgpu`, `webgl2`,
  `canvas2d`, `offscreen-canvas2d`, and `custom`. Implemented `auto`
  results are Canvas2D and WebGL2. WebGPU is reserved and unimplemented.
- Agent/project/document/history management policy is defined.
- Enforceable agent rules are defined.
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
- The root agent guide now enforces a public type safety gate: no explicit
  `any`, no convenience broad types when the domain is expressible, documented
  `unknown` boundaries, schema-derived contracts, and positive/negative
  consumer fixtures for every public type change.
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
- Backend selection is strict. `auto` resolves only the implemented Canvas2D
  or WebGL2 backend compatible with the current mode and capabilities; explicit
  unimplemented, unavailable, mismatched, or adapter-less requests fail without
  substituting another backend.
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

## Active

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

## Next

1. **Graph field throughput (not presentation):** time/relation layout
   adapters and a packed 2D point field exist. Canvas stops at measured
   10k-point draw cost and screen-size clamp. Hosts (for example haru)
   own glow, cluster colour, and labels. See
   [2026-08-22 graph field host presentation](./history/2026-08-22-graph-field-host-presentation.md).
2. **Next contract — mesh-surface measurement endpoints (in
   progress):** the protocol extension landed 2026-08-22 —
   `resolveSurfacePoint` accepts `mesh` targets with correlated
   `mesh.triangle` hits (schema, Three resolver, facade; browser-verified;
   see [2026-08-22 mesh surface points](./history/2026-08-22-mesh-surface-points.md)
   and the extension section in
   [M3.1 Surface Placement Contract](./m3-1-surface-placement-contract.md)).
   Remaining slice: editor measurement tools capturing endpoints on mesh
   surfaces. WebGPU adapter and a pinned-environment frame budget gate are
   explicitly deferred (rationale in
   [2026-08-22 next contract decision](./history/2026-08-22-next-contract-decision.md)).

## Blocked

- None.

## Evidence

- `pnpm typecheck`: passed on 2026-08-22 (32 tasks) after the worker task
  queue slice; previously 30/30 after the adapter facade mount, and
  30/30 on 2026-08-21.
- `pnpm build`: passed on 2026-08-22 (21 packages/apps) after the worker
  task queue slice; previously `--force` 20/20 after the adapter facade
  mount.
- `pnpm verify:public-api`: passed on 2026-08-22 after the worker task
  queue slice, including the new facade `./worker` assertion and the
  generated-declaration `any` audit. Previously passed after the adapter
  facade mount with `applyCommandsToStoredDocument`, `history.changed`,
  geometry-store fixtures, `CanvasResolvedBackend` rejecting `webgpu`, and
  `loadAsset` / `persistCanvasGeometryStore`.
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
- `pnpm verify:bim-worker`: passed on 2026-08-22 (5 named checks) — real
  web-ifc parse of the sample IFC through the worker queue, document
  assembly with `__bim` provenance, property-set best-effort reads,
  maxElements skip accounting, explicit non-IFC rejection.
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
- `pnpm verify:editor-core`: passed on 2026-08-22, now including html
  ungroup transform baking alongside mesh update, paste id remapping +
  single undo, delete of incident edges + single undo, text ungroup world
  transform, connector one-commit gesture, `applyCommandsToDocument`,
  `applyCommandsToStoredDocument` OCC/validation, and geometry-store
  helper exports. Previously passed on 2026-08-21.
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
- `doc-governance-*.py`: not run on 2026-08-17 — scripts are not present at
  `~/.agents/skills/doc-governance/scripts/`.
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

