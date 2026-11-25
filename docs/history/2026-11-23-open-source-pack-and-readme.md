# Open-source release prep: pack smoke verifier, package metadata, and README

Issue: [#11](https://github.com/de-novo/canvas/issues/11).

## Summary

- Standardized open-source package metadata (`repository`, `homepage`, `bugs`,
  `publishConfig: { access: "public" }`) across all 12 publishable manifests
  under `packages/*/package.json`.
- Added `scripts/verify-pack-smoke.mjs` (`pnpm verify:pack-smoke`) to pack all
  12 workspace packages via `pnpm pack`, verify zero unresolved `workspace:`
  specifiers in packed manifests, verify every declared `exports` target exists
  inside its tarball, verify open-source metadata fields, and execute an
  isolated external ESM smoke test against unpacked tarballs (plus checking
  packed `@de-novo/canvas/styles.css` and Three.js-free `@de-novo/canvas/2d`).
- Wired `pnpm verify:pack-smoke` into `.github/workflows/ci.yml`
  (`static-and-unit` job).
- Updated `README.md` to document current 2D/3D capabilities, lightweight
  `@de-novo/canvas/2d` and `@de-novo/canvas/react/2d` quickstarts, React / Vue /
  Svelte / Solid / vanilla fine-grained selector usage (`useCanvasSelector`,
  `createCanvasSelectorStore`, `subscribeCanvasSelector`, `shallowEqual`),
  measured performance & bundle impact table, package catalog, verification
  commands, and license/governance links.

## Verification

- `pnpm verify:pack-smoke`: passed (12/12 packages packed & verified +
  `external-unpacked-esm-smoke`)
- `pnpm verify:public-api`: passed
- `pnpm verify:docs`: passed
- `.github/workflows/ci.yml`: validated with Ruby `YAML.safe_load`
- `git diff --check`: passed

## Unmeasured Scope

- Actual npm registry publication (`pnpm publish`) was not executed; `verify:pack-smoke`
  validates local tarballs and external unpacked imports without publishing.
