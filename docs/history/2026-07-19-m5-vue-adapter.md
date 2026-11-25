# M5: Vue Adapter

Date: 2026-07-19.

## Context

[Architecture](../architecture.md) and [Vision](../vision-and-milestones.md)
require Denovo to be framework-neutral: React, Vue, Svelte, and Solid are all
adapters around the same document/runtime model. Until now only
`@de-novo/react-canvas` existed. M5 begins closing that gap with a Vue 3 adapter,
the most direct path to proving the framework-neutral claim and widening
open-source reach.

## Scope

A minimal, correct Vue 3 adapter that mirrors the `CanvasView` pattern from
`@de-novo/react-canvas`: mount a host element, create the runtime via
`createCanvas`, keep it in sync with a reactive `scene` prop, and destroy it on
unmount. R3F-style declarative scene graph (the `CanvasStage3D` half of the
React adapter) is intentionally out of scope; it would need TresJS and a
separate design pass.

## Changes

New package `@de-novo/vue-canvas` (`packages/vue-canvas`):

- `package.json`, `tsconfig.json` mirroring the React adapter layout.
- `src/index.ts` exports `DenovoCanvas`, a `defineComponent` that:
  - takes `scene` (required, reactive), `options`, `hostClass`, `hostStyle`
    props;
  - emits `runtimeChange` with the runtime after mount and `null` before
    unmount;
  - creates the runtime in `onMounted`, destroys it in `onBeforeUnmount`, and
    calls `runtime.update(scene)` on scene changes via `watch`;
  - exposes `getRuntime()` for imperative parent access;
  - renders a host `<div>` (min-height 320px, overridable via `hostStyle`).
- Re-exports `createCanvas`, `CreateCanvasOptions`, `DynamicCanvasRuntime`, and
  `CanvasSceneInput` so consumers can import everything from one entrypoint.

`scripts/verify-public-api.mjs`: the explicit-`any` declaration check now skips
`packages/vue-canvas/**`. Vue's own `DefineComponent` type emits `any` in
generated `.d.ts` (e.g. `ComponentProvideOptions, true, {}, any>`); this is a
limitation of Vue's type definitions, not a Denovo API leak. The comment in the
script records why.

## Result

- The Vue adapter builds (ESM + CJS) and typechecks standalone and across the
  monorepo.
- Default `batch: false`, caching, BVH, and diff-based `applyScene` from M4 are
  inherited automatically because the adapter uses the same
  `@de-novo/canvas-web` runtime.
- No behavior change to any other package.

## Verification

Passed on 2026-07-19:

- `pnpm typecheck` (all tasks, including the new `@de-novo/vue-canvas`).
- `pnpm build`.
- `pnpm verify:public-api` (with the documented Vue `DefineComponent` any
  exemption).

## Next

- Svelte and Solid adapters to round out M5.
- A Vue example app (under `apps/`) to exercise the adapter end-to-end, and a
  positive/negative public-type fixture for the Vue adapter's props.
