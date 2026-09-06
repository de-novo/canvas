# 2026-08-28 vgpu catalog as documents

## Date

2026-08-28

## Scope

vgpu get-started and playbook graphics restated as Denovo documents.
Hosts do not write WGSL. No new playground.

## Changes

- Official 2D kind `plugin.denovo.shade`: closed `pattern` is
  `gradient` | `wave`, plus `hue`, `speed`, `width`, `height`.
- `setShadePattern` compiles to `node.update`.
- Official 2D drawers (Canvas2D and 2D WebGPU) read only those props.
- Vanilla `vgpu-catalog-bench.html` shows shade, `instances`, and
  section-plane clip. Proof is `pnpm verify:vgpu-catalog`.

## Verification

Ran 2026-08-28:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `DenovoShadeProps` and `@ts-expect-error` on `"fluid"`
- `pnpm verify:document-schema` — 45 checks, including
  `official-denovo-shade-parses-without-host-register`
- `pnpm verify:editor-core` — ok, including `setShadePattern`
  already-in-state and unknown id
- `pnpm verify:vgpu-catalog` — 4/4: closed props; gradient/wave
  paint, not the marker; instances document; section-plane clip
- `pnpm verify:docs` — 161 Markdown files, 509/509 local targets

## Residual risk

- Fluid, ocean, black hole, and other vgpu shader rooms are not
  absorbed. They still need a closed property set before they become
  kinds.
- Shade wave uses the drawer clock, not a document time field.

## Next action

Do not wrap vgpu. Do not add a playground. Expand shade only when the
next pattern is sayable.
