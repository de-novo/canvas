# 2026-08-25 2D plugin nodes

## Date

2026-08-25

## Scope

Framework-surface schema slice. Opens `plugin.<owner>.<kind>` on 2D
scenes with the same register-or-fail rules as 3D. No official 2D kind
and no new catalog.

## Changes

- `definePluginNodeKind` accepts `mode: "2d" | "3d"`.
- `Canvas2DPluginNode` is a 2D transform shell plus JSON `props`.
- Parse checks the registered kind's mode. A 3D kind in a 2D scene
  fails, and the reverse fails.
- The 2D runtime draws a 48×48 marker so a parsed plugin node can be
  selected. That is not a hero.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `Canvas2DPluginNode` fixtures and `@ts-expect-error` on a 3D
  rotation vector
- `pnpm verify:document-schema` — 43 checks, including
  `plugin-nodes-register-and-parse-by-mode`
- `pnpm verify:hit-testing` — ok, including 2D plugin marker bounds
  `[10, 20]–[58, 68]`
- `pnpm verify:editor-core` — ok
- `pnpm verify:docs` — 136 Markdown files, 450/450 local targets

## Residual risk

- No official 2D kind. A host can register any `plugin.*` 2D schema;
  the marker is a placeholder until that kind has a drawer.
- A later same-day change lets one type declare `mode: "both"`. See
  [2026-08-25 plugin kinds in both modes](./2026-08-25-plugin-nodes-both-modes.md).

## Next action

An official 2D kind only when there is a sayable property set and an
official drawer. 3D is already a supported mode, not a later slice.
Do not wrap ThreeUI. Do not add a playground for the marker.
