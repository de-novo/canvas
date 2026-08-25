# 2026-08-25 3D plugin nodes

## Date

2026-08-25

## Scope

First framework-surface schema slice. Adds the 3D plugin-node union and
kind registry. No official `plugin.denovo.field` drawer or hero catalog.

## Changes

- `type` values matching `plugin.<owner>.<kind>` are 3D nodes with a
  JSON `props` object.
- `definePluginNodeKind` / `registerPluginNodeKind` validate `props`
  against the kind schema. Unregistered types fail closed.
- 2D scenes reject plugin nodes. Schema version stays `0.2.0`.
- The 3D runtime draws an unregistered-drawer marker (unit box) so a
  parsed plugin node can be selected. That is not a hero.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 23 packages
- `pnpm build` — 23 packages
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `PluginNodeType` / `Canvas3DPluginNode` fixtures and
  `@ts-expect-error` on `"plugin.field"`
- `pnpm verify:document-schema` — 42 checks, including
  `plugin-nodes-register-and-parse-in-3d-only`
- `pnpm verify:editor-core` — ok
- `pnpm verify:docs` — 129 Markdown files, 425/425 local targets

## Residual risk

- No official field kind. A host can register `plugin.denovo.field`
  with any props schema; that is not the official drawer.
- 2D plugin kinds landed later the same day. See
  [2026-08-25 2D plugin nodes](./2026-08-25-plugin-nodes-2d.md).
- Marker drawing is a placeholder until step 3 of the framework
  surface.

## Next action

Official `plugin.denovo.field` schema and drawer. Do not wrap ThreeUI.
