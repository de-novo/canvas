# Open-source governance: Apache-2.0 and community files

**Date:** 2026-08-17
**Status:** landed

## Context

LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, and SECURITY were the public-release
gate and the last Next item. The license choice was Apache-2.0.

## Changes

- Root [LICENSE](../../LICENSE): Apache License 2.0, copyright 2026 Denovo.
- [NOTICE](../../NOTICE): copyright plus MPL-2.0 BIM sample / web-ifc notes.
- [CONTRIBUTING](../../CONTRIBUTING.md): setup, verification, public-type
  gate, and pointers to agent docs.
- [CODE_OF_CONDUCT](../../CODE_OF_CONDUCT.md): Contributor Covenant 2.1.
- [SECURITY](../../SECURITY.md): private GitHub advisories; HTML overlay
  and untrusted parse boundaries in scope.
- Every workspace `package.json` has `"license": "Apache-2.0"`.

## Verification

No runtime behavior changed. `pnpm typecheck` / `pnpm build` were not
required for these files. Markdown links were checked against paths in
this repository.

## Residual risk

- There is no dedicated security email yet; reports go through GitHub
  private advisories on `de-novo/canvas`.
- Optional peers keep their own licenses. Consuming `web-ifc` still
  pulls MPL-2.0.

## Next action

Geometry blob persistence (`uploadAsset` and BIM tessellation reload),
or run the remaining M4–M8 acceptance suites.
