# Project Status

Last updated: 2026-07-21.

This is the canonical project status index. Keep milestone definitions in
[Vision and Milestones](./vision-and-milestones.md); keep chronological evidence
under [History](./history/README.md).

## Current Phase

M0–M3.1 are verified (product contract, view runtime, editor core, authoring
tools, surface placement). Beyond the verified baseline, four later-milestone
slices have landed and are tracked under **Active** below:

- **M4 Performance Layer (Phases A–B):** measurement infrastructure
  (`verify:performance`, `CanvasRenderStats`, `getRenderStats`) with locked
  baselines, plus four optimizations — geometry/material caching, BVH picking
  activation, diff-based `applyScene`, and opt-in draw-call batching
  (`render.batch`). 1k boxes: 158 ms → 48.60 ms (−69%), draw calls O(nodes) →
  O(material-groups).
- **M5 Framework Adapters:** `@denovo/react-canvas` (React), `@denovo/vue-canvas`
  (Vue 3), `@denovo/svelte-canvas` (Svelte 5), and `@denovo/solid-canvas` (Solid)
  implemented, type/build verified, and runtime-verified in a browser
  (`verify:browser-rendering-adapters` smoke suite, all four adapters render a
  non-blank canvas through initial render, resize, and a 3d→2d scene swap).
- **M6 Persistence (Phases A–D):** `revision`/`DocumentPatchRecord`/
  discriminated `CanvasSaveResult` data model; editor `subscribePersistence` +
  `connectEditorToStorage` bridge; in-memory, filesystem, and IndexedDB adapters
  (`createFileSystemDocumentAdapter`); facade `storage` option wired through
  `connectEditorToCanvas`; IndexedDB `applyCommands`/`uploadAsset` implementations
  with DocumentPatchRecord audit logging and binary asset storage;
  `inverseCommand` → `DocumentPatchRecord` serialization (command → JSON-Patch
  serializer in core, consumed by adapters). **M6 deliverables complete.**

M4–M6 are **landed but not yet "verified" milestones** in the M0–M3.1 sense:
they have type/build/`verify:*` evidence but no milestone-acceptance pass. The
only outstanding milestone deliverable is the Svelte/Solid framework adapters
(M5); all M6 persistence work is delivered.

## Complete

- Monorepo scaffold exists with framework-agnostic core/web packages, optional
  React adapter, server, worker, BIM, and examples.
- `@denovo/canvas` facade package exists as the current public entrypoint.
- Public API contract verification exists and passes.
- Renderer backend strategy is documented as WebGPU-first with WebGL2 and
  Canvas2D compatibility backends and strict explicit selection.
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

- M4 Phase B (optimization) is in progress. Phase A baselines are locked in
  [M4 Performance Thresholds](./m4-performance-thresholds.md) (1k boxes = 1000
  draw calls / 158 ms baseline). Geometry/material caching, BVH picking
  activation, and diff-based `applyScene` are all done (see thresholds doc for
  numbers). Opt-in draw-call batching is now implemented: `render.batch: true`
  collapses same-color top-level box nodes into one `InstancedMesh` per color,
  with per-instance node-id mapping so `createThreeHitTester` still resolves
  hits to document nodes. With batching on, the benchmark draws 1k/10k boxes in
  a single draw call each, cutting 1k from 158 ms → 48.60 ms (−69%) and 10k from
  250 ms → 91.70 ms (−63%) end-to-end vs the Phase A baseline. Default
  `batch: false` preserves existing per-object behavior; `verify:editor-core`,
  `verify:hit-testing`, `verify:document-schema`, and `verify:browser-rendering`
  stay green. Remaining frame time is now instance/CPU overhead rather than
  draw-call count.
- M5 Framework Adapters started: `@denovo/vue-canvas` (Vue 3) is implemented
  and verified. It mirrors the React `CanvasView` pattern — a `DenovoCanvas`
  component that mounts the `@denovo/canvas-web` runtime, syncs a reactive
  `scene` prop via `watch`, emits `runtimeChange`, and destroys on unmount — so
  the M4 performance stack is inherited automatically. `verify:public-api`
  passes (the Vue `DefineComponent` `any` in generated `.d.ts` is a documented
  exemption). Svelte and Solid adapters remain.
- M6 Persistence started (Phase A): the data model hard blockers are landed.
  `CanvasDocumentSchema` carries a monotonic `revision`;
  `DocumentPatchRecord`/`DocumentPatch` are schema-validated; `CanvasSaveResult`
  is a discriminated union (`ok`/`conflict`/`validation`/...);
  `CanvasStorageAdapter` options use `baseRevision`. `@denovo/canvas-server`
  was rewritten around `CanvasStorageAdapter` with a real in-memory adapter
  (`createMemoryDocumentAdapter`) that does optimistic-concurrency conflict
  detection, plus `createCanvasServer`. New `verify:server` exercises
  round-trip, conflict, and migration. Phase B (editor persistence events) is
  also done: `CanvasEditor` now exposes `subscribePersistence`,
  `getDocumentId`, `getBaseRevision`, `setBaseRevision`; `dispatch` emits
  `transaction.committed` with monotonic revision and `inverseCommand`; and
  `connectEditorToStorage(editor, adapter, { debounceMs })` bridges editor
  edits to `adapter.saveDocument` with conflict reconciliation.
  `verify:server` now exercises the editor↔adapter bridge end-to-end (11
  checks). Phase C (filesystem adapter) is done:
  `createFileSystemDocumentAdapter({ directory })` stores each document as JSON
  on disk with the same conflict-detection contract; published under
  `@denovo/canvas-server/filesystem` to keep browser bundles clean;
  `verify:server` now has 14 checks including 3 filesystem ones. IndexedDB
  adapter, `applyCommands`, `uploadAsset` remain. Phase D (facade wiring) is
  done: `connectEditorToCanvas` accepts `storage`/`storageDebounceMs` and calls
  `connectEditorToStorage` end-to-end, so a host app gets durable, debounced,
  conflict-aware auto-save via one option, exercised end-to-end in the vanilla
  example (auto-saves to IndexedDB). Remaining: `applyCommands`/`uploadAsset`.

## Next

1. **Open-source governance (gating):** add LICENSE (MIT or Apache-2.0),
   CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CLA; fill `license`/`repository`/
   `homepage`/`bugs` in all package.json files. No public release is legal
   without this.
2. **M6 polish — complete:** `applyCommands`/`uploadAsset` and `inverseCommand`
   → `DocumentPatchRecord` serialization are all delivered (see
   `docs/history/2026-07-21-m6-*.md`). No M6 work remains.
3. **`dpr` wiring — complete:** `lod` and `chunkSize` were removed from
   `RenderOptionsSchema` (2026-07-21). The 3D renderer now reads
   `currentScene.render.dpr` (matching the 2D renderer) instead of falling
   back to `window.devicePixelRatio`, so `dpr` is wired uniformly into both
   renderers. See `docs/history/2026-07-21-dpr-wiring-3d-renderer.md`.
4. **Adapter runtime verification — complete:** all four framework adapters
   (React, Vue, Svelte, Solid) have browser-rendering smoke coverage via
   `pnpm verify:browser-rendering-adapters` (non-blank canvas on initial render,
   after resize, and after a 3d→2d scene swap; no page/console errors). Example
   apps `apps/playground-{react,vue,svelte,solid}` mount each adapter. See
   `docs/history/2026-07-22-svelte-solid-adapters.md`.
5. **M5 Framework Adapters — complete:** Svelte (`@denovo/svelte-canvas`) and
   Solid (`@denovo/solid-canvas`) adapters join React and Vue; all four are
   type/build/runtime-verified. M5 is delivered.
6. **M7 BIM Extension — web-ifc-first slice landed:** a first-class `mesh` node
   type now exists in core (flat `positions`/`indices` geometry, BVH-picked),
   rendered across the three.js and react-three-fiber runtimes.
   `@denovo/canvas-bim/web-ifc` adds a `WebIfcBimAdapter` that parses an IFC
   `ArrayBuffer` into a `CanvasScene` of `mesh` nodes (one per element, grouped
   by IFC-type layer, provenance in `node.metadata`). The `apps/playground-bim`
   example loads a sample IFC end-to-end and is covered by
   `pnpm verify:bim-rendering` (non-blank render). web-ifc is MPL-2.0 and stays
   behind the opt-in `./web-ifc` subpath; core and the `.` contract entry never
   import it. **Deferred:** worker-based parsing, section planes, eager
   property-set loading, and lifting the 5000-element cap. xeokit (AGPL) is not
   pulled in. See `docs/history/2026-07-22-m7-web-ifc-bim.md`.
7. **M8 Diagram Layer (north-star, next):** the 2D surface becomes an
   infinite-canvas relational-diagram engine — `edge`/`connector` nodes
   (solid/dashed/dotted, straight/curved, arrowheads), an HTML/DOM overlay node
   (foreignObject) for rich cards, a body `text` node, and diagram camera
   helpers (`fitView`, `flyToNode`, `getVisibleBounds`). Same extension pattern
   as the M7 `mesh` node. Unlocks diagram/whiteboard/ticket-map use cases
   (haru is the first candidate consumer) and is the direct route to the
   "reusable across 2D/3D/BIM/diagram" north-star goal. See
   `docs/vision-and-milestones.md` § M8.

## Blocked

- None.

## Evidence

- `pnpm typecheck`: passed on 2026-07-20 for all tasks (now includes
  `@denovo/vue-canvas`).
- `pnpm build`: passed on 2026-07-20 for all packages/apps (12 packages
  including `@denovo/vue-canvas`).
- `pnpm verify:editor-core`: passed on 2026-07-20, including hover/touch,
  X/Y/Z support offsets, final requery, single commit/ID allocation, typed
  miss, invalid target/normal rejection, runtime replacement, and stale async
  cleanup.
- `pnpm verify:hit-testing`: passed on 2026-07-20, including canonical unit-box
  analytic surfaces, parent rotation, non-uniform/negative scale, and invalid
  transform rejection.
- `pnpm verify:browser-rendering`: passed on 2026-07-20 in fresh desktop mouse
  and mobile touch contexts, including the full M3 authoring/transform/handle
  regression baseline.
- `pnpm verify:document-schema`: passed on 2026-07-20 (34 checks), including
  the discriminated `CanvasSaveResult` shape.
- `pnpm verify:public-api`: passed on 2026-07-20, including the Vue
  `DefineComponent` `any` exemption.
- `pnpm verify:performance`: passed on 2026-07-20. Baselines locked in
  [M4 Performance Thresholds](./m4-performance-thresholds.md); with
  `render.batch: true`, 1k boxes render at 48.60 ms / 1 draw call and 10k at
  91.70 ms / 1 draw call. Not a pass/fail gate.
- `pnpm verify:server`: passed on 2026-07-20 (14 checks), including save/load
  round-trip, optimistic-concurrency conflict detection, the filesystem
  adapter, and the editor↔adapter persistence bridge.
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
