# 2026-07-10 Document JSON and Asset References

## Scope

Complete the M1 JSON-loading and basic asset-reference runtime contract.

## Changes

- Added `parseDocumentJson()` and `CanvasDocumentParseError` to the core public
  boundary.
- Implemented JSON parsing and strict document validation as an internal Effect
  pipeline with separate `json` and `document` failure stages.
- Kept Effect types out of public declarations and translated failures to an
  ordinary domain error.
- Allowed `createCanvas({ document })` to accept a document object or JSON
  string.
- Added `loadDocument()` and `getDocument()` to the facade runtime.
- Preserved assets, metadata, plugin state, schema version, and document identity
  when the active scene is subsequently updated.
- Defined M1 basic asset support as validated reference preservation and
  inspection; payload loading and rendering remain adapter work.
- Added schema, runtime, type, domain-error, and asset-preservation fixtures.

## Verification

Passed:

```sh
pnpm typecheck
pnpm build
pnpm verify:document-schema
pnpm verify:public-api
pnpm verify:browser-rendering
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

## Residual Risk

- Static Effect use in the default core path increased the vanilla production
  bundle from approximately 688 KB to 804 KB uncompressed and from about 178 KB
  to 215 KB gzip in the current build.
- Document migrations, remote storage loading, revisions, and conflicts remain
  later persistence milestones.
- Asset payload fetching, decoding, caching, and renderer integration are not
  part of the M1 reference-preservation contract.

## Next Action

Implement and browser-verify the smallest camera orbit, pan, and zoom
foundation, then close M1 or document any remaining acceptance gap.
