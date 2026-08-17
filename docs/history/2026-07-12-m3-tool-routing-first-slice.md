# M3 Normalized Tool Input And Select-Tool Routing

Date: 2026-07-12

## Scope

Begin M3 Authoring Tools with the smallest complete input-routing slice while
preserving the framework-independent editor boundary and existing M2 selection
behavior.

## Changes

- Added strict pointer and keyboard `CanvasToolInput` schemas and ordinary
  TypeScript helpers in core. Pointer geometry is expressed in canvas-local CSS
  pixels and records origin, delta, drag state, pointer type, pressure, buttons,
  and modifiers.
- Added transient `activeToolId`, validated activation, serialized tool-input
  handling, tool-domain errors, and structural tool context capabilities to the
  headless editor.
- Added `createSelectTool()` for hover, primary click/tap replace or modifier
  toggle selection, drag rejection, pointer cancellation, and Escape clearing.
- Added the DOM-facing `connectCanvasToolInput()` adapter. It owns pointer
  capture, drag thresholds, mouse/pen/touch normalization, keyboard routing,
  and active-tool dispatch while keeping renderer hit testing structural.
- Updated `connectEditorToCanvas()` to combine runtime synchronization, plugin
  setup, active-tool input, and cursor synchronization across canvas
  replacement.
- Extended the vanilla example with Select/Inspect switching and observable
  tool-routing state.
- Extended document, editor, public API, and desktop/mobile browser verifiers
  for the new contract.

Effect remains the internal composition model for editor validation, handler
failure mapping, plugin setup, and rollback. The browser pointer hot path stays
imperative and allocation-aware, and public declarations remain Effect-free.

## Verification

Passed:

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

Browser verification covered desktop mouse and mobile touch input, active tool
switching, inspect-tool selection isolation, select-tool Escape clearing,
click-versus-drag behavior, non-blank 2D/3D rendering, and renderer canvas
replacement. Manual Playwright evidence is captured in
[Select tool desktop](../../artifacts/m3-select-tool-desktop.png) and
[Inspect tool desktop](../../artifacts/m3-inspect-tool-desktop.png).

## Residual Risk

- M3 is active, not complete. Pan/orbit, transform, shape/primitive creation,
  property, group/layer, snapping, measurement, and annotation workflows remain.
- The manual browser session reported only a missing `/favicon.ico`; the
  automated verifier excludes this non-runtime asset request from blocking page
  errors.
- Tool cancellation currently covers pointer cancellation, leave, and lost
  pointer capture. Higher-level tool-session cancellation semantics should be
  revisited with transform previews.

## Next Action

Define pan/orbit tool ownership relative to the existing renderer camera
controls, then implement a transform-tool adapter that commits one undoable
transaction per completed drag.
