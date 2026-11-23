# One-line editor prop parity across React CanvasView and Vue, Svelte, and Solid adapters

Issue: [#21](https://github.com/de-novo/canvas/issues/21).

## Summary

- Added one-line `editor` prop support (`auto-connect` on `ready`, automatic
  `disconnect` on unmount) across every framework adapter component:
  - React `@denovo/react-canvas`: `<CanvasView editor={editor} />` (matching
    `<Canvas2DView editor={editor} />`)
  - Vue `@denovo/vue-canvas` & `./2d`: `<DenovoCanvas :editor="editor" />` &
    `<DenovoCanvas2D :editor="editor" />`
  - Svelte `@denovo/svelte-canvas` & `./2d`: `<DenovoCanvas {editor} />` &
    `<DenovoCanvas2D {editor} />`
  - Solid `@denovo/solid-canvas` & `./2d`: `<DenovoCanvas editor={editor} />` &
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
