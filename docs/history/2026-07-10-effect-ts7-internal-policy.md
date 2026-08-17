# 2026-07-10 Internal Effect and TypeScript 7 Policy

## Scope

Make TypeScript 7 the repository development baseline and make Effect the
preferred implementation model for non-public workflows without changing the
public facade contract.

## Decision

- TypeScript 7 is required for repository development, typechecking, and builds.
- Effect is preferred for internal command, migration, import/export, worker,
  server, persistence, resource-lifecycle, concurrency, retry, and typed-failure
  workflows.
- Public APIs expose ordinary TypeScript values, promises, and documented domain
  errors rather than Effect runtime types.
- Effect-native helpers may remain available through explicit advanced
  entrypoints.
- Small synchronous transforms and renderer hot paths remain plain imperative
  TypeScript when that is the clearer or more efficient implementation.

## Consequences

- New internal workflows should start with Effect unless they are trivial or
  performance-sensitive.
- Boundary adapters are required wherever an internal Effect program reaches a
  public facade, persisted document, plugin state, or renderer loop.
- Public declaration verification must continue rejecting accidental Effect
  leakage.
- Consumer TypeScript compatibility remains a separate release requirement from
  the repository's TypeScript 7 toolchain.

## Verification

Required after this policy change:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

## Residual Risk

- Internal Effect adoption can increase bundle or install cost if package
  boundaries stop externalizing or tree-shaking it effectively.
- Public compatibility still needs verification against the supported consumer
  TypeScript version matrix before release.

## Next Action

Complete M1 View Runtime verification, starting with the 3D demand-rendering
loop, before beginning the Effect-based M2 command core.
