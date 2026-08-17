# M3 Navigation Ownership And Shadcn Styling

Date: 2026-07-14

## Scope

Complete the next M3 authoring slice by making Pan/Orbit an explicit tool,
arbitrating camera input without duplicating renderer math, and establishing a
consumer-owned styling contract that works with actual shadcn/Tailwind UI.

## Changes

- Added `navigation?: "allow" | "block"` to framework-independent tool
  definitions and validation.
- Added `createPanOrbitTool()`. It consumes editor input without changing
  selection or history while the existing renderer controls own camera math.
- Added the engine-neutral `CanvasNavigationInputRuntime` capability to the
  built-in 3D and dynamic web runtimes. Requested ownership survives 2D/3D
  canvas replacement and still respects the original controls configuration.
- Updated the facade editor bridge to synchronize active-tool cursor and camera
  ownership, restore prior state on disconnect, and keep custom renderers
  structurally compatible through an optional capability.
- Updated the vanilla example with Select, Navigate, and camera-blocking Inspect
  tools plus observable ownership state.
- Changed the facade CSS entry to static semantic CSS with public `--dc-*`
  inputs, Tailwind v4 `--color-*` fallbacks, shadcn semantic fallbacks, and hard
  defaults. Preset themes no longer override consumer tokens inline.
- Initialized the Next playground with the shadcn registry and Tailwind v4. Its
  scene selector and refresh action use generated `ToggleGroup` and `Button`
  components; core/editor/facade boundaries remain React-independent.
- Extended editor, public API, and browser verification for navigation policy,
  selection isolation, styling precedence, renderer replacement, mouse input,
  and touch input.

Effect remains the internal composition model for non-public editor and plugin
workflows. Camera input and renderer hot paths remain imperative, and no Effect,
React, shadcn, Tailwind, or Three.js types cross the public framework-independent
tool contract.

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

The automated browser verifier ran desktop Chromium mouse input and iPhone 14
touch input. In both environments, Inspect kept the camera screenshot hash
stable, Navigate changed orbit/pan/zoom hashes, selection revisions stayed
stable during navigation, demand rendering did not restart a continuous loop,
and the blocked policy survived Canvas2D-to-Three runtime replacement.

Manual production Playwright evidence:

- [Navigation desktop](../../artifacts/m3-navigation-desktop.png)
- [Navigation mobile](../../artifacts/m3-navigation-mobile.png)
- [shadcn playground desktop](../../artifacts/m3-shadcn-playground-desktop.png)
- [shadcn playground mobile](../../artifacts/m3-shadcn-playground-mobile.png)

## Residual Risk

- Canvas2D has no transient viewport pan/zoom capability yet. Navigate remains
  selection-isolated in 2D but reports no active camera capability.
- The Next 16 production build succeeds under the repository's TypeScript 7
  toolchain, but Next's dependency probe still prints a misleading TypeScript
  installation message. The explicit `pnpm typecheck` command is authoritative.
- Three.js emits its upstream `Clock` deprecation warning in the R3F playground;
  the vanilla runtime verifier has no blocking console or page errors.
- Transform, creation, property, group/layer, snapping, measurement, and
  annotation tools remain unfinished M3 work.

## Next Action

Implement the first transform-tool adapter with transient drag preview and one
undoable command transaction committed on pointer release.
