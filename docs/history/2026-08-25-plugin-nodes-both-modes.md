# 2026-08-25 Plugin kinds in both modes

## Date

2026-08-25

## Scope

Removes the leftover that treated 3D plugin kinds as a later slice
after 2D opened. A kind may declare `2d`, `3d`, or `both`. 3D is a
supported mode now.

## Changes

- `definePluginNodeKind` accepts `mode: "2d" | "3d" | "both"`.
- `pluginNodeKindSupportsMode` is the public check.
- `both` parses in a 2D scene with the 2D transform shell and in a 3D
  scene with the 3D transform shell. Single-mode kinds still fail in
  the other scene.
- Official `plugin.denovo.field` stays `3d`.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `PluginNodeKindMode` and `@ts-expect-error` on `"4d"`
- `pnpm verify:document-schema` — 43 checks, including
  `plugin-nodes-register-and-parse-by-mode` for `plugin.test.badge`
- `pnpm verify:docs` — 137 Markdown files, 454/454 local targets

## Residual risk

- No official 2D kind. `both` is a registry mode, not a second field
  drawer.
- The 2D and 3D shells stay different. `both` does not mix transforms
  in one scene.

## Next action

An official 2D kind only when there is a sayable property set. Do not
wrap ThreeUI. Do not add a playground for the marker.
