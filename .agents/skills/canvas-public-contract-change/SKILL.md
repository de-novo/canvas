---
name: canvas-public-contract-change
description: Change or review Denovo Canvas exported facade APIs, package exports, schema-derived public types, document schemas, or typed protocols when consumer compatibility can change. Do not use for internal-only implementation or browser-only QA.
---

# Canvas Public Contract Change

Use the repository contracts as the source of truth:

1. Read [Contributor Rules](../../../docs/contributor-rules.md),
   [Project Status](../../../docs/project-status.md), and
   [Public API Contract](../../../docs/public-api-contract.md).
2. Read the narrowest document, editor, persistence, renderer, adapter, or BIM
   contract affected by the change.

Before editing, identify the canonical schema or domain union, the generated
declaration surface, compatibility risk, and whether a migration decision is
required. Derive public input and output types from the canonical source instead
of adding a broader shadow type.

Change the smallest coherent surface. Add positive consumer inference fixtures,
negative `@ts-expect-error` fixtures, and runtime validation only where an
untyped boundary exists. Inspect generated declarations for explicit `any` and
unjustified broad types.

Run:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
```

Also run the affected schema, editor, server, worker, or browser verifier. A
runtime check does not replace declaration and consumer inference checks.

Update the canonical contract and add history for a public contract change.
Update project status only when phase, Active, Next, Blocked, or evidence
changed. Report exact command outcomes, counts, compatibility and migration
effects, and unmeasured scope.
