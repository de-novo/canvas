# npm Scope Rename To `@de-novo/*` And `0.2.0` Cut Prep

Date: 2026-11-25

## Scope

Renamed every publishable and example package from the provisional
`@denovo/*` npm scope to `@de-novo/*` so the published name matches the
GitHub organization (`de-novo`) and avoids the third-party `@denovo` npm
scope (`denovo-gmbh`). Bumped all 12 publishable packages to `0.2.0` and
documented the three landed `v0.2` 2D slices in `CHANGELOG.md`.

Official kind IDs (`plugin.denovo.image`, `plugin.denovo.field`,
`plugin.denovo.sparkline`, `plugin.denovo.shade`) are unchanged.

## Changes

- Renamed `name` and cross-package `workspace:*` / peer / `--external` /
  `--filter` references across `packages/*/package.json`,
  `apps/*/package.json`, root `package.json`, source imports, scripts,
  CI/release/pages workflows, issue templates, READMEs, and docs.
- Bumped `packages/*/package.json` versions from `0.1.0` to `0.2.0`.
- Added `CHANGELOG.md` `[0.2.0] - 2026-11-25` covering scope rename plus
  UI styles, inspection overlays, gutter routing, `plugin.denovo.image`,
  multi-page WebGPU atlas LOD, and inspect/snapshot utilities.

## Verification

- `pnpm install` — lockfile rewritten for `@de-novo/*` workspace names.
- `pnpm typecheck` — passed (`36/36` tasks).
- `pnpm build` — passed (`25/25` tasks).
- `pnpm verify:public-api` — passed (`facadeName: "@de-novo/canvas"`).
- `pnpm verify:pack-smoke` — passed (`12/12` pack-inspect +
  `external-unpacked-esm-smoke` under `node_modules/@de-novo/`).
- `pnpm verify:docs` — passed (`207` Markdown files, `755/755` local
  targets, 0 symlinks, 0 conflict markers).

## Compatibility And Migration

- Breaking for consumers only in the package name string: replace
  `@denovo/` with `@de-novo/` in imports and dependency declarations.
- Facade export shapes, document schema `0.2.0`, and Named Operation
  names stay compatible.
- Nothing was published to npm under `@denovo/*`; `0.1.0` remained an
  in-repo cut.

## Residual Risk

- Publishing still requires a configured `NPM_TOKEN` GitHub secret and an
  npm org/`@de-novo` scope membership for the publishing account.
- Lockfile rewrite via `pnpm install` is required after the rename.

## Next Action

- Run risk-matched gates, then commit and tag `v0.2.0` (or
  `workflow_dispatch` release dry-run) once `NPM_TOKEN` is ready.
  `de-novo/dui#259` can then depend on `@de-novo/canvas@^0.2.0`.
