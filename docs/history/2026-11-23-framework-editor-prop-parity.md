# One-line editor prop parity across React CanvasView and Vue, Svelte, and Solid adapters

Issue: [#21](https://github.com/de-novo/canvas/issues/21).

## Summary

- Added one-line `editor` prop support (`auto-connect` on `ready`, automatic
  `disconnect` on unmount) across every framework adapter component:
  - React `@de-novo/react-canvas`: `<CanvasView editor={editor} />` (matching
    `<Canvas2DView editor={editor} />`)
  - Vue `@de-novo/vue-canvas` & `./2d`: `<DenovoCanvas :editor="editor" />` &
    `<DenovoCanvas2D :editor="editor" />`
  - Svelte `@de-novo/svelte-canvas` & `./2d`: `<DenovoCanvas {editor} />` &
    `<DenovoCanvas2D {editor} />`
  - Solid `@de-novo/solid-canvas` & `./2d`: `<DenovoCanvas editor={editor} />` &
    `<DenovoCanvas2D editor={editor} />`
- Added consumer type fixtures in `scripts/verify-public-api.mjs`.

## Verification

- `pnpm build`
- `pnpm typecheck`
- `pnpm verify:public-api`
- `pnpm verify:selectors`
- `pnpm verify:pack-smoke`
- `pnpm verify:docs`
- `git diff --check`
