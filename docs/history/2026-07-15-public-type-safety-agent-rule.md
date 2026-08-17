# Public Type Safety Agent Rule

Date: 2026-07-15

## Scope

Prevent future agents from reintroducing broad public TypeScript contracts that
hide domain information from SDK consumers.

## Changes

- Added an explicit Public Type Safety Gate to the root `AGENTS.md`, so every
  agent sees the rule before changing code or documentation.
- Prohibited explicit `any` in generated declarations and prohibited
  convenience use of `unknown`, `Record<string, ...>`, and unconstrained
  `string` where the domain can be expressed precisely.
- Defined the limited boundaries where `unknown` remains intentional and
  required immediate narrowing or documented public justification.
- Required schema/union-derived types, concrete callback results, correlated
  protocol types, and namespaced plugin identifiers.
- Required positive inference fixtures, negative `@ts-expect-error` fixtures,
  generated declaration inspection, and the complete public type verification
  baseline.
- Mirrored the enforceable details in `docs/agent-rules.md`; the existing Public
  Type Precision Contract remains the product-level rationale.

## Verification

Passed:

```sh
pnpm verify:public-api
```

The verifier includes generated declaration rejection of explicit `any` plus
positive and negative TypeScript consumer fixtures. The repository-local
Markdown link audit passed for 40 files with zero missing local targets. The
configured external `doc-governance` scripts are not installed in this
environment and were not reported as passing.

## Residual Risk

- Written rules still depend on agents following the repository startup order;
  automated declaration and consumer-fixture checks remain the hard regression
  barrier.
- Legitimate dynamic extension boundaries may still need `unknown`; each public
  occurrence requires an explicit boundary justification rather than a blanket
  ban.

## Next Action

Apply this gate to every new rotation, scale, creation, property, grouping, and
plugin extension contract before implementation is accepted.
