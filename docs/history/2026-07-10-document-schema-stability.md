# 2026-07-10 Document Schema Stability

## Date

2026-07-10.

## Scope

Verified M0 document and schema stability for the core public document model.

## Changes

- Made core document, scene, node, camera, render option, asset, and selection
  schemas strict at public parse boundaries.
- Added `pnpm verify:document-schema`.
- Added a verifier that checks:
  - valid 2D scenes parse;
  - valid 3D scenes parse;
  - duplicate node ids fail;
  - document shape parses;
  - duplicate asset ids fail;
  - document JSON round-trips;
  - renderer runtime fields fail;
  - non-JSON extension state fails;
  - selection primary ids are valid;
  - core declarations do not reference renderer implementation packages;
  - command, storage, plugin, and renderer type contracts compile from built
    declarations.
- Updated the M0 product contract and persistence docs to match the strict
  schema behavior.
- Moved active status to the next M0 browser rendering stability item.

## Verification

Passed:

```sh
pnpm typecheck
pnpm build
pnpm verify:document-schema
pnpm verify:public-api
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

## Residual Risk

- This verifies the M0 schema contract, not a full editor command dispatcher or
  migration registry.
- Browser rendering verification is still active and must cover desktop/mobile
  canvas output.
- Existing unresolved Obsidian vault links are outside repository docs and were
  left unchanged.

## Next Action

Reproduce and resolve the ResizeObserver loop, then add browser rendering smoke
checks for desktop and mobile.
