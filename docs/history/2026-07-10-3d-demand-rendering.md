# 2026-07-10 3D Demand Rendering

## Scope

Complete the M1 demand-rendering requirement for the Three.js runtime.

## Changes

- Changed the 3D runtime so `render.loop: "demand"` renders once without
  scheduling a continuous animation frame loop.
- Kept `render.loop: "always"` behavior continuous while the runtime is
  running.
- Added loop-mode transition handling for running 3D scenes.
- Added a static demand-mode 3D scene to the vanilla verification app.
- Extended browser verification to assert that the static 3D scene remains
  rendered while its `onFrame` count stops increasing.

The frame loop remains imperative TypeScript because renderer hot paths are an
explicit exception to the internal Effect-first policy.

## Verification

Passed:

```sh
pnpm typecheck
pnpm --filter @de-novo/canvas-web build
pnpm --filter @de-novo/canvas-vanilla-example build
pnpm verify:browser-rendering
```

Browser verification covered desktop and mobile initial 3D rendering, 2D scene
swap, resize, static demand-mode 3D rendering, non-blank pixels, console/page
errors, and stable frame counts after the demand scene became active.

## Residual Risk

- Canvas2D loop-mode transitions are not yet covered by an equivalent stable
  frame-count assertion.
- The vanilla production bundle still reports the existing size warning.

## Next Action

Define whether scene mode/node mismatches are rejected or intentionally support
mixed-dimensional scenes, then encode that decision in schemas and fixtures.
