# Extension Surface Decision

Date: 2026-09-04. Status: accepted as direction; implementation slices are
listed under "This Week" and "Next Contract Candidates" and are not claimed
as landed.

This is an architecture decision record. It answers one question the owner
must settle before more surface work: **is the plugin structure a real
advantage, or should the architecture be a clearer, narrower structure?**

Identity stays in [Product Identity](./product-identity.md). The user-facing
layer stays in [Framework Surface](./framework-surface.md). The mutation
contract stays in [Named Authoring Operations](./named-authoring-operations.md).
This document decides which of the things this repository calls "plugin"
are product surface, which are plumbing, and which are an anti-pattern.

## Decision In One Paragraph

The product's only extension seam is the **kind**: a namespaced node type
with a closed props schema, an official drawer that reads only those props,
and named operations that compile to canonical commands. Optional engines
(BIM, diagram) are packages that **emit core kinds**; they are not plugins.
`CanvasPlugin` is demoted from "the plugin architecture" to what the code
already makes it: a per-canvas **host bundle** of tools and host-private
commands. `pluginState` is host bookkeeping and may never be where a visual
lives. The ten-category plugin taxonomy and the `@de-novo/canvas/plugins/*`
package shape are superseded as direction. No export, schema, or namespace
string changes; the word `plugin.` stays as a namespace grammar and stops
being an architecture concept.

This is option C from the review, refined: hero vocabulary must live in
kinds and operations; bundles and adapters are plumbing; and the missing
seam is a per-kind drawer registration, not a plugin capability graph.

## What The Repository Actually Has

Every claim below was checked against the tree on 2026-09-04.

### Six things called "plugin"

| Name | Where | What it does today | Consumers in repo |
| --- | --- | --- | --- |
| `CanvasPlugin` | `packages/core/src/index.ts` (`CanvasPluginContext`, `CanvasPlugin`) | `{ name, setup?(ctx), tools? }`; `ctx` exposes only `coreVersion`, `registerCommand`, `registerTool`. Staged, committed atomically, private registry, installed into editors by the facade connectors, rolled back on conflict. | One: `apps/vanilla` `sceneCommandPlugin` (built-in tools plus `plugin.example.load-scene` / `load-document`). No workspace package ships one. |
| `plugin.<owner>.<kind>` node kinds | `packages/core/src/plugin-nodes.ts` | Module-global `Map` registry. `registerPluginNodeKind` validates props at parse; unregistered kinds fail closed; `mode` is `2d`, `3d`, or `both`. | Official `plugin.denovo.field`, `plugin.denovo.sparkline`, and `plugin.denovo.shade` under `core/src/kinds/`, pre-registered when core loads. `apps/playground-field` uses field. |
| Kind drawers | `packages/web/src/3d.ts` default branch; `packages/web/src/2d/render.ts` default branch; `packages/three/src/kinds/field.ts` | Hard-coded official drawers plus `@de-novo/canvas-web` `registerPluginNodeDrawer`. Unregistered host kinds still draw the `#64748b` marker. | Hosts register a kind-level drawer instead of replacing the renderer. |
| `pluginState` | `packages/core/src/index.ts` document schema | `z.record(z.string(), JsonValueSchema)`. No per-key schema. Preserved across scene updates. | One: `apps/playground-threeui/src/denovo/warp-field-document.ts` — `nodes: []` plus `pluginState["threeui.warp-field"]` plus the vendor renderer. That is the shape [Product Identity](./product-identity.md) names as failing the absorption test. |
| `plugin.*` commands | `definePluginCommand`, `CanvasPluginCommandDescriptor` | Editor-instance-bound handlers with `parsePayload(unknown)`. `applyCommandsToDocument` (`packages/editor/src/commands/apply-document.ts`) replays with an empty handler map, so a stored `plugin.*` command fails with `unsupported-command` (`commands/handlers.ts`). | `apps/vanilla` only. |
| Prose taxonomy | [Extensibility](./extensibility.md), [Better Auth Style Architecture](./better-auth-style-architecture.md) | Ten plugin categories (node, renderer, tool, command, asset loader, importer/exporter, persistence, worker, framework adapter, BIM/domain), `@de-novo/canvas/plugins/*` subpaths, a `storage:` config field, a CLI. | Only command and tool are registrations a `CanvasPlugin` can make. Framework adapters, the BIM importer, storage adapters, and worker tasks exist as packages or adapter inputs, not as plugins. [M0](./m0-product-contract.md) and [Public API Contract](./public-api-contract.md) already say node and renderer discovery are future contracts and `storage` is not an accepted config field. |

### What the optional engines actually use

- **BIM** (`packages/bim`): `toDocument()` emits built-in `mesh` nodes, one
  layer per storey, and `__bim` provenance in `node.metadata`. Storey
  isolation in the playground calls `setLayerVisible` and `listNodes`. It
  registers no `CanvasPlugin`, no plugin kind, and writes no `pluginState`.
- **Diagram**: `edge`, `text`, and `html` are frozen `0.2.0` built-ins drawn
  by `packages/web`; `renderNode` is an `html`-only overlay callback. There is
  no diagram package and no plugin mechanism involved.
- **Hero** (`plugin.denovo.field`): a pre-registered core kind, a drawer in
  `@de-novo/canvas-three`, a dispatch branch in `@de-novo/canvas-web`, and
  `setFieldPattern` in `@de-novo/canvas-editor`. Four packages for one kind,
  and none of them is a `CanvasPlugin`.

The two verified optional vocabularies and the one verified hero all pass
the absorption test by emitting or being core kinds. Zero of them use the
facade plugin model. The one `pluginState` consumer is the one documented
absorption failure.

### What agents can and cannot discover

- Kinds: schemas exist per kind, and `getPluginNodeKind(type)` reads one.
  There is no `listPluginNodeKinds()`.
- Operations: nineteen named operations are exported from
  `@de-novo/canvas-editor` and re-exported by the facade. They are pure
  `(document) => { document, changed, commands }` functions with concrete
  inputs and typed `CanvasEditorError` codes. There is no runtime catalog;
  discovery is TypeScript declarations and the contract document.
- Host bundle commands: `parsePayload(unknown)` is opaque. They are not
  reachable from `applyNamedOperations(document, [...])`, which has no
  editor, and they do not replay through storage.

## Verdict On The Hunch

The review's hunch was: "Plugins may be fine for optional engines
(BIM/diagram) if the hero case is expressed as document kinds + named
operations; plugins become harmful if every hero lives only in
`pluginState` + foreign renderer."

- **Verified:** the hero expressed as a kind plus a named operation passes
  the absorption test (`pnpm verify:field-showcase` proves no iframe, a hit
  test, `setFieldPattern`, and undo). The `pluginState` plus vendor renderer
  shape fails it and is the only `pluginState` use in the tree.
- **Contradicted:** "plugins may be fine for optional engines". BIM and
  diagram do not use plugins. They work because they are *packages that
  emit core kinds*. The plugin mechanism is not what makes optional engines
  safe; package boundaries and core vocabulary are.
- **Unverified and out of scope:** whether a future third-party engine
  would need more than kind registration. No such consumer exists.

## Options Considered

### A — Keep plugins as the primary extensibility story

Rejected.

- Of ten documented categories, a `CanvasPlugin` can register two (command,
  tool). One consumer in the repository. No workspace package ships a
  `CanvasPlugin`; the things that do exist (adapters, importer, worker
  tasks) are packages, not plugins.
- Six meanings of one word. A reader of the docs cannot tell whether
  "plugin" means a host bundle, a node kind, a state bag, a command
  namespace, a tool namespace, or a roadmap category.
- Host bundle commands are invisible to the pure document path and fail on
  storage replay. They are the one mutation path that breaks "the document
  is the protocol".
- A capability graph (node discovery, renderer discovery, storage plugins,
  CLI) is months of plumbing with no consumer driving it.

### B — Narrow to document + named operations + render adapters; delete plugins

Rejected as stated, accepted in spirit.

- Deleting `CanvasPlugin` is churn: the vanilla example depends on it, the
  staged/atomic/rollback lifecycle is verified, and a per-canvas bundle of
  tools is a legitimate host need.
- "Render adapters only" drops the kind registry, which is the single
  extension seam that passes absorption. Whole-renderer replacement is the
  wrong granularity for "I have one new kind"; it is exactly what pushed the
  ThreeUI host toward `pluginState` plus a vendor renderer.

### C — Hybrid: bundles for host-owned tools; hero vocabulary in core kinds and operations

**Accepted, with two refinements.**

- "Host-owned skin" is CSS variables and `renderNode`, not plugins. Skin
  does not need the plugin model.
- The hero rule is not new: [Framework Surface](./framework-surface.md)
  already requires kind, closed props, official drawer, named operation.
  What this decision adds is that this is the **only** product-level
  extension seam, and that the next missing piece is a per-kind drawer
  registration, not a capability graph.

### D — Build the Better Auth capability graph now

Rejected. It would spend the near term on registration plumbing for
categories with no consumer while the hero catalog has two kinds.

## Decision

1. **The kind is the extension unit.** A kind is `type`, `mode`, a closed
   Zod props schema, an official drawer that reads only those props, and
   the named operations that change it. Every hero, diagram, graph, or
   region visual must be a kind node on a layer so it lists, picks, hides,
   undoes, and saves through the shared path.
2. **Optional engines are packages that emit kinds.** BIM stays an importer
   that emits `mesh` plus layers plus metadata. A future diagram or region
   engine follows the same rule. None of them is a plugin.
3. **`CanvasPlugin` is a host bundle.** Its job is per-canvas tools and
   host-private commands with atomic install and rollback. It is not agent
   vocabulary, not replayable, and not product surface. Do not add node,
   renderer, storage, importer, or worker registration to
   `CanvasPluginContext`. The type name stays for compatibility; the docs
   stop calling it "the plugin architecture".
4. **`pluginState` is host bookkeeping.** Nothing that draws, picks, or
   undoes may live only there. The field stays in the schema for
   compatibility; no repository package or catalog app may add a consumer.
5. **The prose taxonomy is superseded.** The ten categories,
   `@de-novo/canvas/plugins/*`, the `storage:` config field, and the CLI in
   [Extensibility](./extensibility.md) and
   [Better Auth Style Architecture](./better-auth-style-architecture.md) are
   historical target sketches, not direction. Those documents carry a status
   note pointing here; they are not rewritten in this change.
6. **No string renames.** `plugin.<owner>.<kind>`, `plugin.*` commands, and
   `plugin.<owner>.tool.<name>` stay. They are frozen in `0.2.0` documents,
   public fixtures, and verifiers. The namespace grammar is fine; the
   architecture word is retired.

## When Plugins Help And When They Make Fog

Help:

- A host wants its own tool set and two or three private commands on one
  canvas, installed atomically and removed on disconnect. That is the
  vanilla case and `CanvasPlugin` does it well.

Fog:

- **Catalog risk.** A "plugin catalog" of rooms or skins reproduces the
  ThreeUI host: things that exist in a plugin but not as kinds cannot be
  listed by `listNodes`, changed by a named operation, or restored by undo.
  Cases that only run the upstream source raise the upstream's usage.
- **Absorption failure.** `nodes: []` plus `pluginState` plus a vendor
  renderer is the documented failing shape and the only `pluginState` use in
  the tree. Any extension path that makes that shape convenient is harmful.
- **Agent confusion.** Six meanings of "plugin"; `parsePayload(unknown)`
  commands with no schema an agent can read; commands that work in one
  editor instance and fail on storage replay. The agent thesis needs one
  language, and host bundle commands are a second, private one.
- **Growth-path confusion.** A host kind draws as a gray marker. The only
  way to make it draw today is to replace the whole renderer, which is
  where the `pluginState` anti-pattern starts. The fix is a kind-level
  drawer seam, not a bigger plugin context.

## Clearer Structure

Three tiers. Tier names are documentation vocabulary; package names do not
change.

### Tier 1 — Spine

`@de-novo/canvas-core` and `@de-novo/canvas-editor`: schema `0.2.0`, canonical
commands, `applyNamedOperations`, `editor.apply`, `listNodes`, `listLayers`,
`listLabels`, `CanvasEditorError` codes, the kind registry. No change.

### Tier 2 — Kinds

Each kind is one module that owns its schema, its drawer entry points, and
its operations. Official kinds live under `kinds/` in core and three.
`setFieldPattern` remains in `editor/src/authoring/named-operations.ts`.
Target shape, in order of value:

1. **Kind drawer seam (next contract candidate).** A registration in
   `@de-novo/canvas-web` (and the Three/WebGPU paths it dispatches to) of the
   form "for kind `T` in mode `M`, here is the drawer and hit-test", so a
   registered host kind stops drawing as a marker without a custom renderer
   adapter. Acceptance: a `plugin.test.*` kind registered by a host draws
   non-marker pixels and hit-tests in Canvas2D and WebGL2; an unregistered
   drawer still draws the marker and never throws; removing the host
   drawer restores the marker; the facade never exposes Three or Canvas2D
   types for this. This is the smallest change that lets a host kind pass
   the absorption test on its own.
2. **Kind enumeration.** A read-only `listPluginNodeKinds()` beside
   `getPluginNodeKind` so a host or agent can enumerate registered kinds
   and their modes. Tiny public addition; needs positive and negative
   fixtures and a public-API run.
3. **Kind colocation.** Official kind modules live under `kinds/` in
   core (`field`, `sparkline`, `shade`) and three (`field` + compute).
   Internal only; no export change. New official kinds keep one
   directory per package.

### Tier 3 — Bundles And Adapters

`CanvasPlugin` (host bundle), renderer adapters, storage adapters, framework
adapters, importers such as `@de-novo/canvas-bim`. Plumbing. None defines
vocabulary. `renderNode` stays an `html` overlay hook. `renderer` stays the
whole-runtime escape hatch.

### Operations catalog

Named operations are the agent language. `listNamedOperations()` is the
read-only manifest of names, `read` / `write` role, and closed input
field kinds. No new package, no protocol, no chat panel. Discovery
matches [Named Authoring Operations](./named-authoring-operations.md).

## How This Serves The AI-Agent Document Runtime

The thesis is that humans and agents share one document language: kinds
with closed schemas, named operations with concrete inputs, a pure apply,
typed failures, and read-back. Mapping the decision onto that:

- **Shared language.** Every hero verb becomes a named operation on a kind.
  There is no second vocabulary in a host bundle that an agent must also
  learn.
- **Portability.** Named operations run on a bare document and compile to
  canonical commands that storage can replay. Host bundle commands do
  neither. Keeping agent-visible mutation on named operations is what makes
  "the document is the protocol" true.
- **Enumerability.** Kind enumeration and an operations manifest are the
  two small additions that close the discovery gap. Neither needs a
  capability graph.
- **Failure shape.** Already-in-state returns `{ changed: false }`; unknown
  ids and locked targets are typed codes. Agents can plan against that.

### The region/mask need

An early product need elsewhere is a region/mask UI for image-generation
edits. This must not pull canvas toward a photo editor. Under this
decision:

- **First slice needs no canvas change.** A mask is a `mode: "2d"` document
  of `rect` and `circle` nodes on a layer. They draw, pick, transform,
  hide, lock, undo, and save today. The host may tag them with
  `metadata` (for example a role) and rasterizes the mask from the JSON in
  its own pipeline. `listNodes`, `setNodeVisible`, `setNodeLocked`,
  `setNodeLayer`, and `removeNode` already cover the operations an agent
  would call. Vanilla proof: `apps/vanilla/src/rasterize-region-mask.mjs`
  plus `apps/vanilla/region-mask-bench.html` and
  `pnpm verify:region-mask`. The host rasterizer reports unknown mask
  kinds instead of inventing a polygon.
- **Polygon or freeform regions** are a kind, not a built-in. `line`,
  `polyline`, and `path` are explicitly not implicit `0.2.0` fallbacks
  ([M8 Diagram Contract](./m8-diagram-contract.md)), and `0.2.0` built-ins
  are frozen. A host kind
  `plugin.<org>.region` with a closed points schema is the right shape; it
  is blocked today only by the drawer seam above, which is why that seam
  is the next contract candidate rather than a new built-in.
- **Not canvas work:** raster layers, brushes, pixel operations, filters,
  blend modes, image adjustment, or the image itself as an editable
  bitmap. Canvas ships the region document; the image pipeline is the
  host's.

## What Not To Build Next

- **A photo editor.** No raster layers, brushes, pixel operations, filters,
  or blend modes as kinds or operations.
- **BIM as a second product.** No BIM property panels, model tree UI, or
  xeokit viewer in this repository. BIM remains an importer that emits
  core kinds and uses shared operations.
- **iframe or host demos.** No more ThreeUI rooms. `apps/playground-threeui`
  stays a visual reference and is not product proof; its removal is a
  separate decision.
- **The capability graph.** No node discovery, renderer discovery, storage
  plugins, `@de-novo/canvas/plugins/*`, or CLI until a second real consumer
  exists.
- **An agent protocol or package.** No `@de-novo/canvas-agent`, chat panel,
  prompt format, or fluent `editor.foo().bar()`. The document is the
  protocol.
- **New `CanvasPluginContext` methods.** The host bundle stays commands and
  tools.

## This Week

1. Accept this decision (landed 2026-09-04: document, status, history, two
   JSDoc clarifications on `CanvasPlugin` and `pluginState`).
2. Freeze: no new `CanvasPluginContext` methods, no new `pluginState`
   consumers, no new ThreeUI rooms.
3. Kind drawer seam contract and implementation: see
   [Kind Drawer Seam](./kind-drawer-seam.md). Host kinds register a
   Canvas2D paint and a WebGL2 object on `@de-novo/canvas-web`. Missing
   drawers stay the gray marker. The facade does not export engine types
   for this.
4. Kind enumeration: read-only `listPluginNodeKinds()` returns
   `{ type, mode }` snapshots. Unregistered types stay fail-closed at
   parse.
5. For the region/mask need, prototype in the consuming product with
   `rect` and `circle` plus `metadata`, and report whether polygons are
   required before any canvas change is scheduled. Vanilla and the Next
   playground now rasterize that JSON. Polygons were not required.

## Consequences

- **Positive.** One extension seam that already passes absorption; one
  mutation language for humans and agents; the plugin word stops carrying
  six meanings; the next contract is small and consumer-driven.
- **Negative.** The Better Auth analogy in older documents is now partly
  historical; readers must follow the status notes. Host kinds still draw
  as markers until the drawer seam lands.
- **Neutral.** No public export, schema, namespace string, or package
  boundary changes in this decision. Compatibility effects: none.

## Verification For This Change

Documentation-only plus two comment edits:

- `pnpm verify:docs` after the change (counts recorded in
  [Project Status](./project-status.md) and the history entry).
- `pnpm typecheck` for the JSDoc edits in `packages/core/src/index.ts`.

Not measured: build, public API fixtures, browser rendering, editor core.
No behavior changed.

## Related

- [Product Identity](./product-identity.md) — absorption test.
- [Framework Surface](./framework-surface.md) — kind, properties, operation.
- [Named Authoring Operations](./named-authoring-operations.md) — mutation
  list shape.
- [M0 Product Contract](./m0-product-contract.md) — extension contract and
  `0.2.0` freeze.
- [Public API Contract](./public-api-contract.md) — implemented plugin
  surface is commands and tools.
- [Extensibility](./extensibility.md) and
  [Better Auth Style Architecture](./better-auth-style-architecture.md) —
  superseded taxonomy, kept with status notes.
- [2026-08-22 graph field host presentation](./history/2026-08-22-graph-field-host-presentation.md)
  and [2026-08-25 product identity](./history/2026-08-25-product-identity.md)
  — earlier boundary decisions this record builds on.
- [2026-09-04 extension surface decision](./history/2026-09-04-extension-surface-decision.md)
  — history entry for this change.
