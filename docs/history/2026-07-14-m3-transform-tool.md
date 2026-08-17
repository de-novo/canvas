# M3 Transient Transform Tool

Date: 2026-07-14

## Scope

Complete the first M3 transform adapter with renderer-independent input,
transient 2D/3D translation previews, and exactly one undoable transaction when
the pointer is released.

## Changes

- Added strict `CanvasNodeTranslationInput` and
  `CanvasNodeTransformPreview` schemas/types to core without DOM or renderer
  objects.
- Added `createTransformTool()` to the editor and facade. It uses per-editor
  pointer sessions, selects the hit node, blocks camera navigation, delegates
  preview math through structural runtime capabilities, and commits one
  `transaction` containing one `node.update` position patch.
- Kept preview movement outside the document, editor snapshot, and history.
  Pointer cancellation, pointer leave, Escape, tool switching, disconnect,
  scene update, and runtime destruction clear transient preview state.
- Added Canvas2D translation using canvas-local CSS-pixel deltas.
- Added Three.js translation using a camera-facing plane through the node's
  original position. Renderer math stays in the imperative web hot path and
  does not expose Three.js through editor or facade contracts.
- Added transform delegation to the dynamic web runtime and optional
  `CanvasNodeTransformRuntime` support to custom facade renderers, preserving
  the existing required custom lifecycle.
- Made the stable pointer host own `touch-action: none` while connected, then
  restore the consumer's previous value on disconnect. This prevents mobile
  transform drags from becoming browser scroll gestures.
- Added a Move control to the framework-free vanilla example and observable
  node-position/history state for end-to-end verification.
- Extended editor, public API, TypeScript smoke, desktop mouse, and mobile touch
  verification for transient preview, cancellation, undo, release-time commit,
  and renderer replacement.

Effect remains the internal editor workflow foundation, while renderer preview
math stays plain allocation-aware TypeScript. Public declarations remain
Effect-free and framework-independent under the repository's TypeScript 7
toolchain.

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
```

The browser verifier exercised desktop Chromium mouse input and iPhone touch
input. For both 2D and 3D, the canvas hash changed during the held drag while
document position and undo depth stayed unchanged. Pointer release then changed
the document position and increased undo depth by exactly one.

Manual Playwright evidence:

- [2D desktop transient preview](../../artifacts/m3-transform-2d-preview-desktop.png)
- [3D desktop transient preview](../../artifacts/m3-transform-3d-preview-desktop.png)
- [2D mobile committed result](../../artifacts/m3-transform-2d-committed-mobile.png)

The repository-mandated `doc-governance` script location was unavailable in
this environment. A repository-local Markdown link audit was used as a fallback;
the missing external skill remains recorded below rather than reported as a
passing governance command.

## Residual Risk

- This slice translates whole nodes only. It does not yet render axis/plane
  handles or support constrained translation, rotation, scale, or snapping.
- The 3D adapter uses a camera-facing drag plane. Domain-specific ground-plane,
  local-axis, and surface-constrained movement require later handle policies.
- Custom renderers must opt into `CanvasNodeTransformRuntime` before the Move
  tool can operate; absence is reported as `tool-capability-missing`.
- The configured external `doc-governance` skill and scripts were not present
  under `~/.agents/skills/doc-governance` during this verification run.

## Next Action

Add renderer-independent transform handle identity and axis/plane constraint
contracts, then reuse the transient-preview/single-transaction lifecycle for
rotation and scale.
