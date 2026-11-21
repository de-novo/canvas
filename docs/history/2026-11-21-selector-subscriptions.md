# TanStack-style fine-grained selector subscriptions

Issue: [#3](https://github.com/de-novo/canvas/issues/3).

## Summary

Added additive, framework-agnostic selector subscription primitives and thin
framework-native selector bindings so canvas-based apps avoid unnecessary UI
re-renders during high-frequency editor updates (such as 60–120 Hz hover
tracking):

- `@denovo/canvas-editor` (re-exported from `@denovo/canvas`):
  `subscribeCanvasSelector`, `shallowEqual`, `CanvasSelector`,
  `CanvasSelectorEquality`, `SubscribeCanvasSelectorOptions`.
- `@denovo/react-canvas` (re-exported from `@denovo/canvas/react`):
  `useCanvasSelector` built on `useSyncExternalStore` with cached equality
  comparison (safe for inline derived object selectors + `shallowEqual` and
  prop-dependent closures).
- `@denovo/vue-canvas`: `useCanvasSelector` returning a `ComputedRef<TSelected>`
  backed by `shallowRef` and disposed automatically via `onScopeDispose`.
- `@denovo/svelte-canvas`: `createCanvasSelectorStore` returning a standard
  Svelte `CanvasReadableStore<TSelected>` (`$store`-compatible).
- `@denovo/solid-canvas`: `useCanvasSelector` returning an `Accessor<TSelected>`
  backed by `createSignal` and cleaned up via `onCleanup`.
- Consumer adoption: `apps/playground/app/mask-host.tsx` now subscribes to
  `document` and `{ canUndo, canRedo }` through `useCanvasSelector` +
  `shallowEqual` instead of manual `setDocumentModel` plumbing.

## Compatibility And Declarations

Purely additive public surface. No existing exports changed, no schema version
bump, and no migration is required. Generated declaration files
(`packages/editor/dist/selector.d.ts`, `packages/react/dist/index.d.ts`,
`packages/svelte-canvas/dist/index.d.ts`, `packages/solid-canvas/dist/index.d.ts`)
contain zero explicit `any`. Positive consumer inference fixtures and negative
`@ts-expect-error` fixtures run in `pnpm verify:public-api`.

## Verification

- `pnpm typecheck`: passed (25 packages)
- `pnpm build`: passed (25/25)
- `pnpm verify:public-api`: passed (including `selectors-smoke.ts` positive and
  negative fixtures across `@denovo/canvas`, `@denovo/canvas/react`,
  `@denovo/vue-canvas`, `@denovo/svelte-canvas`, and `@denovo/solid-canvas`)
- `pnpm verify:selectors`: passed (4/4: `shallow-equal-semantics`,
  `headless-subscribe-isolates-hover-storm`,
  `vue-useCanvasSelector-isolates-and-disposes`, and
  `react-useCanvasSelector-zero-spurious-rerenders-in-browser` — 100 hover
  updates produced 0 extra React re-renders on `HistoryBar`)
- `pnpm verify:region-mask`: passed (6/6, Next `/mask` desktop clicks and
  iPhone 14 touch taps)
- `pnpm verify:editor-core`: passed
- `pnpm verify:docs`: passed

## Unmeasured Scope

- Live browser runtime render-count benchmarks for Svelte (`$store`) and Solid
  (`useCanvasSelector`) remain unmeasured beyond TypeScript consumer fixtures
  and production Vite builds; headless, Vue (`effectScope`), and React 19
  Chromium DOM render isolation are runtime-verified.
