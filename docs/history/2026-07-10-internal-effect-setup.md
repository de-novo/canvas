# 2026-07-10 Internal Effect Setup

## Scope

Set up Effect for internal functional core logic without exposing it through the
public facade or document model.

## Changes

- Added `effect` to `@denovo/canvas-core`.
- Added optional Effect-powered helpers under `@denovo/canvas-core/effect`.
- Kept the default `@denovo/canvas-core` root import Effect-free so browser
  consumers do not pay for Effect unless they opt in.
- Extended `pnpm verify:public-api` to fail if public declaration files expose
  Effect types.
- Documented TypeScript 7 and Effect policy in
  [Dependency Strategy](../dependency-strategy.md) and
  [Agent Operating Policy](../agent-operating-policy.md).

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

- Effect is now a dependency of `@denovo/canvas-core`; package install impact
  should be measured before release.
- Default browser bundle impact should remain low because the root import does
  not import Effect.
- Effect must remain out of renderer hot paths.
- Public consumer compatibility should still be checked against older supported
  TypeScript versions before publishing.

## Next Action

Continue M0 verification item 2: document and schema stability tests.
