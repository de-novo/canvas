# Contributing

Thanks for contributing to Denovo Canvas. Human developers, maintainers, and
automated contributors use the same product contracts and quality gates.

By contributing, you agree that your work is licensed under the
[Apache License 2.0](./LICENSE) and that project interactions follow the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Start Here

Read these documents before changing code, public contracts, or durable
documentation:

1. [Contributor Operating Policy](./docs/contributor-operating-policy.md)
2. [Contributor Rules](./docs/contributor-rules.md)
3. [Contributor Automation](./docs/contributor-automation.md)
4. [Project Status](./docs/project-status.md)
5. [Documentation Index](./docs/README.md)
6. The contract or architecture document governing the surface you will change

Automated contributors must also read [AGENTS](./AGENTS.md) for workspace and
handoff safeguards. `AGENTS.md` does not replace this shared guide.

## Repository Skills

Automated contributors can use the focused procedures under `.agents/skills`:

- [`$canvas-public-contract-change`](./.agents/skills/canvas-public-contract-change/SKILL.md)
  for exported API, schema-derived type, package export, and protocol changes;
- [`$canvas-editor-core-change`](./.agents/skills/canvas-editor-core-change/SKILL.md)
  for commands, transactions, history, selection, and tools;
- [`$canvas-browser-rendering`](./.agents/skills/canvas-browser-rendering/SKILL.md)
  for browser-visible rendering and interaction verification;
- [`$canvas-governance`](./.agents/skills/canvas-governance/SKILL.md) for
  contributor policy, `AGENTS.md`, skills, status, history, and documentation
  verification.

Skills are task procedures, not a second rulebook. See
[Contributor Automation](./docs/contributor-automation.md) for ownership and
extension rules.

## Product Boundary

Denovo Canvas is a framework-agnostic 2D/3D document, viewing, editing,
extension, persistence, and performance SDK. React, Next.js, R3F, Vue, Svelte,
Solid, Astro, workers, servers, BIM, diagrams, and future renderers are adapters
or optional packages around the shared document and editor model.

The current library name is provisional. Preserve the stable contract through
the facade API shape, package boundaries, document schemas, renderer backend
vocabulary, and verification policy.

## Development Setup

Use pnpm 11 and the repository TypeScript 7 toolchain:

```sh
pnpm install
pnpm typecheck
pnpm build
```

TypeScript 7 is a repository development requirement. Published consumer types
must not require it until ecosystem compatibility is explicitly verified.

## Choose And Scope Work

Before implementation:

1. identify the active milestone and relevant acceptance criteria in
   [Project Status](./docs/project-status.md);
2. find the canonical contract for the affected package or behavior;
3. state the user-visible or contributor-visible outcome and compatibility
   risk;
4. keep the change to one coherent concern;
5. record a decision before introducing a breaking API, schema, persistence,
   backend, package-boundary, or license change.

Do not add a new built-in node kind to canonical schema `0.2.0` without an
explicit contract and migration decision. Do not add license-sensitive engines
to `packages/core`.

## Make The Change

- Follow existing package and document patterns.
- Prefer the facade API; lower-level packages are escape hatches.
- Keep core framework-agnostic and saved documents renderer-independent.
- Avoid unrelated refactors, formatting churn, and generated-file noise.
- Add or update verification at the same boundary as the changed behavior.
- Make failures explicit; do not silently substitute unsupported behavior.
- Preserve compatibility unless the accepted change explicitly requires a
  break and documents its migration path.

Detailed enforceable requirements live in
[Contributor Rules](./docs/contributor-rules.md).

## Public API And Type Changes

Every exported facade, adapter, plugin, callback, authoring helper, and protocol
type must satisfy the [Public API Contract](./docs/public-api-contract.md) and
the public API section of [Contributor Rules](./docs/contributor-rules.md).

In particular, generated declarations must not expose explicit `any`, and broad
convenience types must not replace an expressible domain contract. A public type
change requires positive consumer inference fixtures, negative
`@ts-expect-error` fixtures, generated declaration inspection, and all three
public type gates:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
```

## Verification

Run the smallest complete set of checks that matches the risk. The three
commands above are the baseline for TypeScript, package, export, and public API
work. Add the relevant surface verifier:

- `pnpm verify:document-schema` for documents, migrations, or command schemas;
- `pnpm verify:editor-core` for commands, transactions, selection, history, or
  tools;
- `pnpm verify:server` for storage adapters or persistence events;
- `pnpm verify:hit-testing` for picking or 2D geometry;
- `pnpm verify:browser-rendering`, `pnpm verify:diagram-rendering`, or
  `pnpm verify:bim-rendering` for browser-visible behavior;
- `pnpm verify:flow-showcase` for the absorbed release-board catalog case;
- the matching performance verifier for performance claims;
- the documentation governance commands below for documentation changes.

Report exact commands, outcomes, and check or task counts when the runner
provides them. List skipped or unavailable checks as `not measured`; do not
fold them into a general “passed” claim.

## Documentation And History

Repository Markdown is the source of truth. Keep status in
[Project Status](./docs/project-status.md) and chronological evidence under
[History](./docs/history/README.md).

Update project status when the current phase, Active, Next, Blocked, or evidence
changed. Add a history entry for a durable rule, contract, package boundary,
renderer strategy, persistence format, milestone, or significant regression.
Do not maintain a second status table in history.

For documentation work, run:

```sh
pnpm verify:docs
```

## Pull Request And Review Contract

A reviewable contribution should complete the
[pull request template](./.github/PULL_REQUEST_TEMPLATE.md) and:

- explain the problem and the chosen boundary;
- identify the milestone, contract, or acceptance criteria it changes;
- call out public API, schema, persistence, backend, dependency, license, and
  migration effects;
- contain one coherent change without unrelated cleanup;
- include exact verification results and explicit `not measured` scope;
- update canonical documentation and history when required;
- avoid claiming that a milestone is verified unless all acceptance criteria
  ran.

Review feedback should be resolved in the canonical implementation or document,
not patched with a contradictory local exception. Security vulnerabilities must
be reported through the private process in the
[Security Policy](./SECURITY.md), not a public issue.
