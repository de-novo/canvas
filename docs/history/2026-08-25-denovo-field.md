# 2026-08-25 Official denovo field

## Date

2026-08-25

## Scope

Official `plugin.denovo.field` schema, drawer, and `setFieldPattern`.
No hero catalog app.

## Changes

- The kind is pre-registered in `0.2.0`. Hosts do not register it.
- `props` are closed: `pattern` is `streaks` | `letters`; `brightness`
  0–2; `density` 0–1; `hue` 0–360; `speed` 0–40.
- The official drawer is our InstancedMesh field in
  `@de-novo/canvas-three`. It reads only those properties. No vendor
  file.
- Other plugin kinds still draw as the unit-box marker.
- `setFieldPattern({ nodeId, pattern })` compiles to `node.update`.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 34/34
- `pnpm build` — 23/23
- `pnpm verify:public-api` — `public-api-suite` ok
- `pnpm verify:document-schema` — 43 checks, including
  `official-denovo-field-parses-without-host-register`
- `pnpm verify:editor-core` — ok, including `setFieldPattern`
  already-in-state and unknown id
- `pnpm verify:denovo-field` — 2/2: document needs no host register;
  drawer instance count follows density; letter geometry differs from
  streaks
- `pnpm verify:docs` — 130 Markdown files, 428/428 local targets

## Residual risk

- No catalog app and no browser pick/undo gate yet.
- Letters are compact instances, not glyph textures.
- The drawer is not a ThreeUI Warp Field and does not claim to be.

## Next action

Hero catalog landed in
[2026-08-25 absorbed field showcase](./2026-08-25-field-showcase.md).
Do not wrap more ThreeUI rooms.
