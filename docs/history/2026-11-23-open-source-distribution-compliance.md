# Open-source distribution compliance: LICENSE/NOTICE tarballs, issue templates, changelog, and release workflow

Issue: [#12](https://github.com/de-novo/canvas/issues/12).

## Summary

- Synced root Apache-2.0 `LICENSE` and `NOTICE` into all 12 publishable
  `packages/*` directories, added them to each package's `files` array along
  with discoverability `keywords`, and extended `scripts/verify-pack-smoke.mjs`
  to assert byte-for-byte parity between each packed tarball's `LICENSE`/
  `NOTICE` and repository root.
- Added `.github/ISSUE_TEMPLATE/bug_report.yml`,
  `.github/ISSUE_TEMPLATE/feature_request.yml`, and
  `.github/ISSUE_TEMPLATE/config.yml` (disabling blank issues and directing
  security disclosures to `SECURITY.md`).
- Added root `CHANGELOG.md` (linked from `README.md`).
- Added `.github/workflows/release.yml` supporting tag pushes (`v*`) and
  `workflow_dispatch` (default `dry_run: true`) with full clean build,
  `pnpm verify:docs`, `pnpm verify:public-api`, `pnpm verify:pack-smoke`, and
  npm provenance publication (`--provenance --access public`).

## Verification

- `pnpm verify:pack-smoke`: passed (12/12 packages packed with exact root
  `LICENSE` & `NOTICE` parity + `external-unpacked-esm-smoke`)
- `pnpm verify:docs`: passed
- Ruby `YAML.safe_load`: passed on `.github/workflows/ci.yml`,
  `.github/workflows/release.yml`, and `.github/ISSUE_TEMPLATE/*.yml`
- `git diff --check`: passed

## Unmeasured Scope

- Live npm registry publish with `NPM_TOKEN` and OIDC provenance has not yet
  been executed against npmjs.org.
