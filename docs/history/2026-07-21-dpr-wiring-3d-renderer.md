# dpr Wiring: 3D Renderer Now Honors Scene `render.dpr`

**Date:** 2026-07-21  
**Status:** ✅ Complete

## Problem

`RenderOptionsSchema` defines a `dpr` field (default `1.5`) that is meant to
control the device pixel ratio used for rendering. The two built-in renderers
handled it inconsistently:

- **2D renderer** (`packages/web/src/2d.ts`) — correctly read
  `currentScene.render.dpr`.
- **3D renderer** (`packages/web/src/3d.ts`) — ignored the scene's `dpr`
  entirely and fell back to `window.devicePixelRatio`:

  ```ts
  const pixelRatio = options.devicePixelRatio ?? window.devicePixelRatio ?? 1;
  ```

So a scene that explicitly set `render.dpr` (e.g. `1.5` for a balance of
sharpness and perf, or `1` to cap fill rate on retina displays) had its value
honored in 2D but silently overridden by the host display's native ratio in 3D.

The React adapter (`CanvasStage3D`) was already correct — it forwards
`dpr: resolvedScene.render.dpr` to R3F's `<Canvas>`, which calls
`setPixelRatio` internally. The bug was confined to the vanilla 3D runtime.

## Fix

`packages/web/src/3d.ts` `resize()` now resolves pixel ratio the same way the
2D renderer does:

```ts
const pixelRatio = options.devicePixelRatio ?? currentScene.render.dpr;
```

Resolution order is now identical across both renderers:

1. **Explicit override** — `options.devicePixelRatio` (facade
   `devicePixelRatio` config), if provided, always wins.
2. **Scene intent** — `currentScene.render.dpr` (schema default `1.5`) is
   honored.
3. *(no more `window.devicePixelRatio` fallback.)*

Because `currentScene` is reassigned on every scene update
(`currentScene = nextScene`), `resize()` always reads the latest `dpr` — a
mid-session `scene.update` that changes `render.dpr` now takes effect on the
next resize, just like in 2D.

## Side benefit: SSR safety

Removing `window.devicePixelRatio` also drops the only unguarded `window`
reference in that path. The vanilla 3D runtime is browser-only by contract,
but this removes a latent footgun if any of this code is ever evaluated during
server-side module load.

## Verification

- `pnpm typecheck` — **18/18 packages** pass.
- `pnpm build` — **12/12 packages** pass.
- React adapter unchanged (was already correct).

## Why not keep `window.devicePixelRatio` as a final fallback?

The schema deliberately owns the default (`1.5`) rather than deferring to the
host. A canvas library that silently renders at the display's native ratio on a
retina laptop (2x or 3x) pays a large fill-rate cost the author never asked
for; `1.5` is a deliberate sharpness/perf tradeoff. Hosts that *want* native
ratio can set `render.dpr` to `window.devicePixelRatio` explicitly, or pass the
facade `devicePixelRatio` option — both still work.

## Files changed

- `packages/web/src/3d.ts` — `resize()` pixel-ratio resolution (one line).
- `docs/project-status.md` — marked dpr wiring complete.
