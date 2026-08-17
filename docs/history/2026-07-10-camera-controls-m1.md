# 2026-07-10 M1 Camera Controls and Milestone Verification

## Scope

Complete the camera orbit, pan, and zoom foundation and close M1 View Runtime.

## Changes

- Added renderer-independent `CanvasCameraControlsInput` and
  `CanvasCameraControlsOptions` types to the web runtime and facade exports.
- Added `controls` forwarding through `createCanvas()` with independent pan,
  rotate, zoom, enabled, and minimum/maximum distance options.
- Integrated Three.js `OrbitControls` inside the built-in 3D runtime while
  keeping engine types out of facade configuration.
- Made camera input render directly on change so demand-mode scenes remain
  interactive without scheduling a continuous animation-frame loop.
- Dispose control listeners and resources with the runtime, and resynchronize
  camera target state when a scene update reapplies its persisted camera.
- Added explicit camera control configuration to the vanilla facade example.
- Extended public type smoke coverage and desktop/mobile browser checks for
  orbit, zoom, pan, and stable demand-mode frame counts.

Renderer input and frame paths remain imperative TypeScript because they are
performance-sensitive exceptions to the internal Effect-first policy.

## M1 Acceptance Result

M1 View Runtime is verified. The vanilla facade renders and switches strict 2D
and 3D scenes, survives viewport resize, supports demand rendering, accepts
document objects and JSON, retains asset references, resolves built-in/custom
renderers without framework dependencies, and provides interactive 3D camera
controls.

## Verification

Passed:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
pnpm verify:document-schema
pnpm verify:browser-rendering
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

Browser verification covered desktop and mobile viewports. Orbit, zoom, and pan
each changed the demand scene's rendered pixels, and the `onFrame` count stayed
fixed after all three interactions.

The full repository public/schema/browser/document-governance baseline was
rerun after this entry was added and passed.

## Residual Risk

- Browser coverage uses pointer input in both desktop and mobile viewport/device
  contexts; native multi-touch pinch and two-finger pan gestures do not yet have
  dedicated automation.
- Camera movement is intentionally transient and is not yet connected to M2
  commands, saved views, or undo/redo.
- Adding `OrbitControls` increased the current vanilla production bundle to
  about 827 KB uncompressed and 221 KB gzip; the existing large-chunk warning
  remains.

## Next Action

Define the M2 Editor Core acceptance contract, then implement command
application, transactions, and undo/redo with Effect as the internal workflow
foundation and ordinary TypeScript public boundaries.
