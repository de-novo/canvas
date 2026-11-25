# 2026-07-10 M0 Public API Contract

## Scope

M0 verification item 1: public API contract.

## Changes

- Added the `@de-novo/canvas` facade package as the current public entrypoint.
- Added backend vocabulary to the facade types:
  - `CanvasBackend`
  - `CanvasRendererConfig`
  - `ResolvedCanvasRenderer`
- Added `renderer: { backend: "auto" }` as the target public config shape.
- Added `pnpm verify:public-api`.
- Documented package rename policy in [Public API Contract](../public-api-contract.md).

## Verification

Passed:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

## Residual Risk

- Actual browser rendering stability is not covered by public API verification.
- ResizeObserver loop warnings were observed during previous browser checks and
  still need targeted investigation.
- WebGPU is documented as the target backend direction, but M0 runtime still
  resolves 3D to the WebGL2-backed implementation.

## Next Action

Proceed to M0 verification item 2: document and schema stability.
