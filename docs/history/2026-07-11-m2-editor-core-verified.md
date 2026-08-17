# 2026-07-11 M2 Editor Core Verified

## Scope

Complete the final M2 slice by connecting facade plugin setup registrations to
editor command/tool registries, then run the complete Editor Core acceptance
baseline.

## Changes

- Replaced the facade's direct re-export of `connectEditorToRuntime()` with a
  signature-compatible wrapper. Structural runtimes retain document sync only;
  runtimes created by `createCanvas()` additionally install resolved plugin
  commands and tools.
- Made `connectEditorToCanvas()` compose the same plugin registry connection
  with document sync and pointer selection.
- Added a private facade registry controller that supports multiple editors,
  idempotent disconnect, reverse-order cleanup, and cleanup before renderer
  destruction.
- Staged static plugin declarations and asynchronous `CanvasPlugin.setup`
  registrations in config order. The public registry and connected editors are
  updated only after every setup succeeds.
- Added `CanvasPluginError` for ordinary setup, duplicate-registration,
  destroyed-runtime, and internal lifecycle failures. Existing editor registry
  conflicts remain `CanvasEditorError` values.
- Kept the public `CanvasPlugin.setup` return contract as
  `void | Promise<void>`. Cleanup owns editor registration handles and does not
  introduce an undefined asynchronous plugin disposer lifecycle.
- Used Effect inside the facade for setup ordering, typed failure composition,
  atomic commit, and failure translation. Public declarations reject Effect
  imports and Effect vocabulary.
- Updated the vanilla example so scene swaps execute through an asynchronously
  registered facade plugin command. Existing desktop and mobile browser checks
  therefore exercise the real plugin-to-editor bridge.

## Verification

Passed on 2026-07-11:

```sh
pnpm typecheck
pnpm build
pnpm verify:document-schema
pnpm verify:editor-core
pnpm verify:hit-testing
pnpm verify:public-api
pnpm verify:browser-rendering
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

The editor verifier now covers invalid command/tool registration shapes,
duplicate tools, idempotent cleanup, and stale cleanup handles. The public API
verifier covers deferred async setup, command dispatch and runtime sync,
undo/redo, config-order determinism, plugin and editor conflicts, full setup
rollback across command/tool/node/renderer metadata, multi-editor-safe cleanup,
canvas destruction, and destruction before setup completion.

The browser verifier passed real desktop pointer and mobile touch selection,
3D→2D→3D plugin-command scene swaps, resize, demand rendering, orbit, pan,
zoom, non-blank pixels, and console/page-error gates.

## Decisions

- Facade plugin integration extends existing connector behavior instead of
  adding another editor creation API or coupling editor core to facade setup.
- Plugin setup is sequential in config order so conflicts are deterministic.
- The M2 cleanup contract covers facade-owned editor registrations. A future
  asynchronous plugin resource disposer requires its own completion and error
  observation contract.

## Residual Risk

- Plugin-discovered renderer selection is not active; direct renderer adapters
  still own runtime creation.
- The facade capability registry remains the first command/tool-oriented slice;
  importer/exporter, asset loader, worker task, and migration resolution remain
  future extension work.
- Snapshot-backed history remains memory-proportional to document size until a
  measured M6 patch/persistence optimization.

## Next Action

Begin M3 by defining the smallest tool activation and normalized input-routing
contract, then implement a behavioral select-tool slice without adding DOM or
renderer dependencies to editor core.
