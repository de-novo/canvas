# M5: Svelte + Solid Adapters

**Date:** 2026-07-22  
**Status:** ✅ Complete — M5 Framework Adapters fully delivered

## Overview

Added the last two framework adapters for M5 — `@denovo/svelte-canvas`
(Svelte 5) and `@denovo/solid-canvas` (Solid) — with example apps and
browser-rendering smoke coverage. With React and Vue already runtime-verified,
all four framework adapters are now type/build/runtime-verified.

## New packages

### `@denovo/solid-canvas` (`packages/solid-canvas`)

A `DenovoCanvas` Solid component wrapping `createCanvas`. Lifecycle via
`onMount`/`onCleanup`; the reactive `scene` prop is forwarded to
`runtime.update` through a deferred `createEffect`. Published as **source +
type declarations** (`solid`/`import` export conditions point at `src/index.tsx`)
so the consumer's Solid compiler handles JSX transformation — the standard
pattern for Solid libraries and avoids a babel-preset-solid build step in the
package.

### `@denovo/svelte-canvas` (`packages/svelte-canvas`)

A `DenovoCanvas.svelte` component wrapping `createCanvas`. Lifecycle via
`onMount`/`onDestroy`; scene changes re-run `$: if (runtime && scene)` to call
`runtime.update`. Published as **source + declarations** (`svelte` export
condition points at `src/index.ts`), with an ambient `*.svelte` shim so the
package's own `tsc --noEmit` stays green without svelte2tsx.

Both adapters mirror the Vue/React adapters: a host `<div>`, `scene` (reactive),
`options` (read on mount), and an optional runtime-change callback/expose.

## New example apps

`apps/playground-svelte` and `apps/playground-solid` — each renders a 3D and 2D
scene through the adapter with a `[data-denovo-control="swap"]` button and a
`#mode-readout`, matching the React/Vue example apps so the shared smoke
verification script can target them uniformly.

## Verification

`pnpm verify:browser-rendering-adapters` now covers all four adapters. Result:

```
✅ React:  rendered 35 colors initially, survived resize + scene swap, no errors
✅ Vue:    rendered 35 colors initially, survived resize + scene swap, no errors
✅ Svelte: rendered 35 colors initially, survived resize + scene swap, no errors
✅ Solid:  rendered 35 colors initially, survived resize + scene swap, no errors
All adapter smoke checks passed.
```

The script also gained an `ADAPTER_ONLY=<Label>` escape hatch for iterating on a
single adapter without booting all four dev servers, plus a debug dump
(URL/body/console errors) when a canvas never mounts.

## Notable issue: Vite 8 (rolldown) vs Svelte

The Svelte example could not render under the repo-wide **Vite 8 /
rolldown-vite**: `vite-plugin-svelte` 4.x mis-compiled components under the
rolldown transform, forcing Svelte 5 runes mode and breaking the component
constructor (`component_api_invalid_new`), and `mount(...)` threw a static
"not available on the server" during SSR transform. Neither `compilerOptions:
{ runes: false }` nor a document guard worked — the plugin ignores/overrides
them under rolldown.

**Resolution:** the Svelte example app pins **Vite 7 + `@sveltejs/vite-plugin-svelte`
5.x** (the stable, non-rolldown combo). Every other package in the repo keeps
Vite 8. pnpm permits the version split per-app. The adapter package itself
(`@denovo/svelte-canvas`) is framework-version-agnostic source, so this is purely
an example-app toolchain pin until vite-plugin-svelte supports rolldown. This is
documented inline in `apps/playground-svelte/vite.config.ts`.

Solid, by contrast, works fine under Vite 8 — `vite-plugin-solid` compiles JSX
correctly under the rolldown transform.

## Files added

- `packages/solid-canvas/{package.json, tsconfig.json, src/index.tsx}`
- `packages/svelte-canvas/{package.json, tsconfig.json, src/index.ts, src/DenovoCanvas.svelte, src/svelte-shim.d.ts}`
- `apps/playground-solid/{package.json, vite.config.ts, tsconfig.json, index.html, src/{main.tsx, App.tsx, styles.css}}`
- `apps/playground-svelte/{package.json, svelte.config.js, vite.config.ts, tsconfig.json, index.html, src/{main.ts, App.svelte, styles.css, env.d.ts}}`
- `scripts/verify-browser-rendering-adapters.mjs` — extended to four targets +
  `ADAPTER_ONLY` + canvas-mount debug dump

## M5 status

M5 Framework Adapters is **fully delivered**: React, Vue, Svelte, Solid — all
type/build/runtime-verified. No M5 work remains.
