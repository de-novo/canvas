# Review hardening — editor, persistence, BIM, status

**Date:** 2026-08-17
**Status:** landed (type/build/`verify:*` evidence in this change)

## Context

A planning-and-code review found the M0–M3.1 spine is sound, but later
slices left real bugs and a contradictory status index. This change fixes
the confirmed defects and records the v1-focus decision so further feature
work has a single surface.

## Product decision

v1 is the framework-agnostic 2D/3D **embedded editor engine** (document,
commands, tools, Canvas2D/WebGL2 runtimes, snapshot save/load).

- Diagram (`edge`/`text`/`html`) and BIM (`mesh` + optional web-ifc) stay
  optional vocabularies on that engine. They are not a second product
  identity and do not justify widening core without a contract.
- CAD-quality remains the interaction bar for the editor spine. “Figma /
  React Flow parity” is not a license to grow a vector editor.
- WebGPU stays a target backend vocabulary. Implemented `auto` backends
  remain Canvas2D (2D) and WebGL2 (3D).
- Large IFC/glTF geometry should move to `AssetRef` before any cap lift.
- Canonical schema is still `0.2.0`. `mesh`/`edge`/`text`/`html` already
  live there; a `0.3.0` bump is scheduled rather than invented in this
  hardening pass.
- LICENSE / CONTRIBUTING / SECURITY remain the public-release gate. This
  change does not pick MIT vs Apache-2.0.

## Changes

- Core: `mesh` is a canonical node with a `node.update` command/patch
  schema. Positions must be finite and a multiple of 3.
- Editor: `applyCommandsToDocument` applies a command list to a snapshot.
  Paste remaps parent/edge/annotation ids and commits one transaction.
  Delete removes incident edges in one transaction. Ungroup bakes
  `text`/`html` world transforms.
- Storage: IndexedDB `applyCommands` applies commands, then stores the
  result. `connectEditorToStorage` uses the last acknowledged revision and
  does not rebase on conflict; `onConflict` / `storageOnConflict` surface
  the failure.
- Web: `renderNode` strings use `textContent`, not `innerHTML`.
- Svelte: `hostStyle` reads the prop, not `$hostStyle`.
- BIM: column-major transform (translation at 12/13/14), camera frames the
  mesh AABB, `defineScene` validates the result, previous models are closed.
- Docs: project-status Current/Active/Next agree; history index lists the
  late-July entries; public API contract names `applyCommandsToDocument`.

## Verification

Ran after the code change:

- `pnpm typecheck`
- `pnpm build`
- `pnpm verify:public-api`
- `pnpm verify:document-schema`
- `pnpm verify:editor-core`
- `pnpm verify:server`

- `pnpm typecheck` — 30/30
- `pnpm build` — 20/20
- `pnpm verify:document-schema` — ok, 36 named checks
- `pnpm verify:editor-core` — ok
- `pnpm verify:server` — ok, includes conflict-does-not-overwrite
- `pnpm verify:public-api` — ok

Browser rendering and BIM playground pixels were not re-run. Residual risk:
BIM camera/matrix should be checked with `pnpm verify:bim-rendering` when a
browser is available. `doc-governance-*.py` is not installed in this
environment.

## Residual risk

- Memory and filesystem adapters still omit `applyCommands`.
- Undo/redo still do not emit persistence events.
- Framework adapters still mount `@denovo/canvas-web`, not the facade.
- `3d.ts` remains a 3k-line module.
- Schema `0.2.0` still names a shape that has grown since M3.

## Next action

Write the M8 contract or pick LICENSE. Do not add another node type to
core until one of those lands.
