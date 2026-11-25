# Multilingual open-source documentation (English, Korean, Simplified Chinese)

Issue: [#15](https://github.com/de-novo/canvas/issues/15).

## Summary

- Added a top-of-page language switcher across `README.md` (English),
  `README.ko.md` (한국어), and `README.zh-CN.md` (简体中文), mirroring current
  2D/3D capabilities, lightweight `@de-novo/canvas/2d` and 4-framework adapter
  quickstarts, fine-grained selectors, measured performance/bundle data,
  package catalog, verification commands, and Apache-2.0 governance links.
- Added dedicated multilingual open-source onboarding & optimization guides:
  - `docs/getting-started.md` (English)
  - `docs/getting-started.ko.md` (한국어)
  - `docs/getting-started.zh-CN.md` (简体中文)
- Updated `docs/README.md` with an `Open-Source Guides (English / 한국어 / 简体中文)`
  section while preserving canonical English specifications under `docs/` as
  the normative source of truth.

## Verification

- `pnpm verify:docs`: passed (all local Markdown links, governance
  entrypoints, repository skills, and project-status invariants verified)
- `git diff --check`: passed

## Unmeasured Scope

- Code/runtime behavior did not change; runtime and browser suites were not
  re-run for this documentation-only change.
