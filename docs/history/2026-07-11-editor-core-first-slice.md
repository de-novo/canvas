# 2026-07-11 M2 Editor Core First Verified Slice

## Scope

Implement and verify the first M2 Editor Core vertical slice without marking the
full milestone complete.

## Changes

- Added the framework-independent `@de-novo/canvas-editor` package and explicit
  facade exports for `createEditor()`, `connectEditorToRuntime()`,
  `CanvasEditorError`, and editor public types.
- Added strict recursive `CanvasCommandSchema`, `defineCommand()`, and
  `safeDefineCommand()` boundaries for built-in, plugin, and transaction
  commands.
- Implemented schema-validated node add, update, remove, 2D/3D transform, and
  transient selection commands.
- Implemented atomic nested command transactions, serialized asynchronous
  dispatch, immutable editor state, and bounded snapshot-backed undo/redo.
- Added command-handler and tool registries with duplicate-registration
  rejection and cleanup handles.
- Added a renderer/framework-neutral `update(scene)` connector that synchronizes
  only document changes and isolates post-commit subscriber failures through an
  ordinary error callback.
- Used Effect for internal command, transaction, asynchronous handler, and typed
  failure composition, then translated it to promises and `CanvasEditorError` at
  public boundaries.
- Added real runtime, schema, ESM/CommonJS, no-DOM TypeScript consumer, and
  Effect-leak verification.

## Verification

Passed on 2026-07-11:

```sh
pnpm typecheck
pnpm build
pnpm verify:document-schema
pnpm verify:editor-core
pnpm verify:public-api
pnpm verify:browser-rendering
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

The editor verifier executes through the facade in Node without DOM, React, or
Three.js. It verifies immutable input/state isolation, selection semantics,
atomic success and rollback notification counts, exact JSON undo/redo for
add/update/remove, 2D/3D transforms, history branching and limits, async plugin
handlers and failure recovery, command/tool registries, serialized concurrent
dispatch, clock/domain error mapping, and runtime connect/disconnect behavior.

## Residual Risk

- Snapshot history guarantees exact rollback but scales with document size;
  forward/inverse document patches remain a later measured optimization.
- Plugin command affected-node reporting is conservative and currently marks
  the union of nodes before and after any persistent plugin result.
- The headless TypeScript smoke uses the Node standard library types because the
  shared core storage contract still includes the cross-runtime `Blob` binary
  input type.
- Normalized renderer hit testing, pointer capture, behavioral tools,
  `CanvasPlugin.setup` integration, and persistence patch emission remain open,
  so M2 is active rather than verified.

## Next Action

Implement normalized Canvas2D and Three.js hit testing behind the shared
`CanvasHitResult` shape, then connect it to framework-free selection/tool input.
