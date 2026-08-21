# Contributing

Thanks for working on Denovo Canvas. Repository Markdown under `docs/` is
the source of truth. Read these before changing code or contracts:

1. [Agent Operating Policy](./docs/agent-operating-policy.md)
2. [Agent Rules](./docs/agent-rules.md)
3. [Project Status](./docs/project-status.md)
4. [Public API Contract](./docs/public-api-contract.md)

By contributing you agree that your work is licensed under the
[Apache License 2.0](./LICENSE).

## Setup

```sh
pnpm install
pnpm typecheck
pnpm build
```

Use pnpm 11 and the repo TypeScript 7 toolchain. Do not require TypeScript 7
from published consumer types.

## What To Change

The product is a framework-agnostic 2D/3D editor engine. React, Next.js,
Vue, Svelte, Solid, BIM, and workers are adapters. Do not add a new
built-in node kind to schema `0.2.0` without a contract and migration
decision.

Keep changes small. Match existing package boundaries. Prefer the facade
API; lower-level packages are escape hatches.

## Verification

Run the checks that match the risk:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
```

Also run, when the change touches that surface:

- `pnpm verify:document-schema` for document or command schemas
- `pnpm verify:editor-core` for editor commands, history, or tools
- `pnpm verify:server` for storage adapters or persistence events
- `pnpm verify:hit-testing` for picking or 2D geometry
- `pnpm verify:browser-rendering` / `verify:diagram-rendering` /
  `verify:bim-rendering` for anything a user sees in a browser

Public type changes need positive consumer fixtures and negative
`@ts-expect-error` fixtures. Do not export `any`. Do not use `unknown`
as a convenience type.

## Pull Requests

- Point at the milestone and acceptance criteria you are changing.
- Update [Project Status](./docs/project-status.md) when the phase or
  Next list changes. Add a [history](./docs/history/README.md) entry for
  durable decisions or contract changes.
- Do not mark a milestone verified unless its acceptance checks ran.
- Do not add LICENSE-sensitive engines to `packages/core`.

## Conduct And Security

- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security policy](./SECURITY.md)
