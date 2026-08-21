# Project Status

Last updated: 2026-08-17.

This is the canonical project status index. Keep milestone definitions in
[Vision and Milestones](./vision-and-milestones.md); keep chronological evidence
under [History](./history/README.md).

## Current Phase

M0–M3.1 are verified (product contract, view runtime, editor core, authoring
tools, surface placement). Later slices have landed but are **not milestone-
verified** in the M0–M3.1 sense:

- **M4 Performance Layer (Phases A–B):** measurement, caching, BVH picking,
  diff-based `applyScene`, opt-in box batching. 1k boxes 158 ms → 48.60 ms.
  Remaining vision deliverables (LOD, chunks, workers, 16 ms target) are not
  accepted.
- **M5 Framework Adapters:** React, Vue, Svelte, and Solid view wrappers exist
  and have adapter smoke coverage. They mount `@denovo/canvas-web`, not the
  full facade/editor.
- **M6 Persistence:** snapshot OCC, memory/filesystem/IndexedDB adapters, and
  the editor storage bridge exist. All three adapters apply `applyCommands`
  through `applyCommandsToStoredDocument`. Undo/redo emit `history.changed` so
  `connectEditorToStorage` persists the restored snapshot. Conflict handling
  does not rebase onto the server. Not a verified milestone.
- **M7 BIM:** optional `web-ifc` importer produces `mesh` nodes that
  reference `geometry` assets. Tessellation lives in a session
  `CanvasGeometryStore`, not as unbounded `number[]` on each node.
  View-scale sample only (5000-element cap, no workers/section planes).
- **M8 Diagram:** `edge`/`text`/`html`, connector, routing, layout adapters,
  and 2D UX slices have landed. The
  [M8 Diagram Contract](./m8-diagram-contract.md) now freezes that
  vocabulary in `0.2.0`. The milestone is not verified until the
  contract's acceptance criteria run.

v1 focus is the framework-agnostic 2D/3D editor engine. Diagram and BIM stay
optional packages, not a second product identity. See
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
- Canonical schema stays `0.2.0`. `mesh` / `edge` / `text` / `html` are
  frozen as current `0.2.0` built-ins (no `0.3.0` bump). The repository
  is Apache-2.0. See
  [2026-08-17 open-source governance](./history/2026-08-17-open-source-governance.md).
- [M8 Diagram Contract](./m8-diagram-contract.md) acceptance checks ran
  on 2026-08-17, including a live-playground connector gesture on
  desktop and iPhone 14. M8 is contract-accepted, not a second product.
  Residual: the full vanilla M3 desktop/mobile suite was not re-run in
  this pass.
- M4–M8 remain landed-but-unverified.
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

## Next

1. **Milestone verification:** run the remaining M4–M8 acceptance suites
   instead of leaving them landed-but-unverified.
2. **Adapter host:** framework view wrappers should mount the facade, not
   only `@denovo/canvas-web`.

## Blocked

- None.

## Evidence

- `pnpm typecheck`: passed on 2026-08-17 (30/30 tasks).
- `pnpm build`: passed on 2026-08-17 (20/20 packages and apps).
- `pnpm verify:document-schema`: passed on 2026-08-17 (37 named checks),
  including mesh `node.update` and `geometryAssetId` exclusive-or.
- `pnpm verify:editor-core`: passed on 2026-08-17, including mesh update,
  paste id remapping + single undo, delete of incident edges + single undo,
  text ungroup world transform, `applyCommandsToDocument`,
  `applyCommandsToStoredDocument` OCC/validation, and geometry-store
  helper exports.
- `pnpm verify:server`: passed on 2026-08-17 (30 assertions), including
  conflict-does-not-overwrite, memory/filesystem `applyCommands`, undo/redo
  `history.changed` persistence, and geometry blob upload/hydrate.
- `pnpm verify:public-api`: passed on 2026-08-17, including
  `applyCommandsToStoredDocument`, `history.changed`, geometry-store
  fixtures, `CanvasResolvedBackend` rejecting `webgpu`, and
  `loadAsset` / `persistCanvasGeometryStore`.
- `pnpm verify:hit-testing`: passed on 2026-08-17, including M8 edge path
  resolution (`orthogonal` waypoints, quadratic control, ignored
  `routing: "curved"`).
- `pnpm verify:diagram-rendering`: passed on 2026-08-17 (desktop + iPhone
  14), including overlay card, textContent probe, edge-follows-source,
  and missing `flyToNode`.
- `pnpm verify:browser-rendering` / `verify:performance`: last recorded
  2026-07-20; not re-run in this pass.
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

