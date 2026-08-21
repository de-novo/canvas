# Agent Operating Policy

This document defines how agents should manage goals, project status,
documentation, verification, and history in this repository.

## Product Goal

Denovo Canvas should become a general-purpose web ecosystem SDK for 2D/3D canvas
viewing and editing.

The SDK should:

- make common 2D/3D setup fast;
- keep React and Next.js optional;
- support vanilla web first;
- use proven engines such as Three.js, Canvas2D, WebGL2, workers,
  Zustand, Zod, TanStack Query, and optional BIM libraries where they help;
- hide boilerplate without hiding escape hatches;
- keep saved documents renderer-independent;
- make view, edit, save, load, extend, and optimize workflows coherent.

## Operating Principles

- Prefer the facade API first. Lower-level packages are escape hatches.
- Apply [Agent Rules](./agent-rules.md) for enforceable repository constraints
  before changing code, package boundaries, public contracts, or durable docs.
- Keep package names replaceable. Validate the current facade package name from
  metadata instead of assuming it is permanent.
- Separate document semantics from runtime implementation.
- Keep core portable. Core must not depend on React, Next.js, DOM, R3F, Drei,
  xeokit, or web-ifc.
- Use dependencies as engines, not as leaked product surface.
- TypeScript 7 is the required repository development toolchain. Public
  consumer types must stay conservative until ecosystem compatibility is
  verified.
- Effect is the preferred foundation for non-public workflows such as command
  processing, migrations, worker/server orchestration, resource lifecycles,
  concurrency, and typed failure handling.
- Internal Effect programs must be translated to ordinary TypeScript values,
  promises, and domain errors at public boundaries. Effect types must not leak
  into the facade API, persisted documents, or renderer hot paths.
- Verify behavior before marking a milestone complete.
- Document decisions when they change future work.

## Project Management

[Project Status](./project-status.md) is the canonical status index.

It answers:

- what is complete;
- what is active;
- what is next;
- what is blocked;
- where the evidence is.

Milestones are defined in [Vision and Milestones](./vision-and-milestones.md).
Do not duplicate full milestone definitions in status notes. Link to the
milestone document and record only current status, evidence, and next actions.

Use these statuses:

- `planned`: accepted but not started;
- `active`: currently being worked;
- `verified`: completed and supported by evidence;
- `blocked`: cannot proceed without a named blocker;
- `superseded`: replaced by a newer decision or plan.

When completing a verification item, update the status index and add or link to
history evidence.

## Documentation Management

Repository docs live under `docs/`. Root-level Markdown should be limited to
entrypoints such as `README.md` and `AGENTS.md`.

Add new docs only when they create a durable source of truth. Prefer updating an
existing canonical document when the content belongs there.

Use [Agent Rules](./agent-rules.md) for required and forbidden agent behavior.
Use this operating policy for workflow, status ownership, history, and
verification management.

Document types:

- product contracts: API, document model, renderer strategy, editing model;
- architecture decisions: package boundaries and dependency choices;
- status index: current project state;
- history entries: chronological evidence and completed work;
- runbooks: repeatable operational steps.

Before and after documentation-heavy work, run:

```sh
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

Existing unresolved Obsidian links that do not come from repository docs should
be recorded as residual risk, not silently rewritten.

## History Management

Durable history lives under `docs/history/`.

Create a history entry when:

- a milestone or verification item is completed;
- a public API contract changes;
- a package boundary changes;
- a renderer/backend strategy changes;
- a decision affects future implementation;
- a significant bug or regression is discovered or fixed.

History entries should include:

- date;
- scope;
- changes;
- verification commands and outcomes;
- known residual risks;
- next recommended action.

History is evidence, not a second status table. The status index may link to
history entries, but status should not be maintained in multiple places.

## Verification Management

Verification should match risk.

For TypeScript/package work:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
```

For editor command/history work:

```sh
pnpm verify:editor-core
```

`pnpm verify:public-api` must continue checking that optional implementation
dependencies such as Effect are not exposed through public declaration files.

For documentation work:

```sh
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

For browser rendering work:

- run the relevant dev server;
- use Playwright;
- verify non-blank canvas pixels or screenshots;
- test desktop and mobile viewports when layout or canvas framing can change;
- stop background dev servers before finishing.

Use the project verifier when possible:

```sh
pnpm verify:browser-rendering
```

For performance work:

- define scene size and workload;
- measure before/after;
- record browser, device, viewport, object count, and backend.

## Decision Management

Use a durable document when a decision affects future work.

Decision records should state:

- context;
- decision;
- alternatives considered;
- consequences;
- date;
- related milestone or package.

Small tactical choices can stay in the relevant contract or history entry. Do
not create decision documents for every implementation detail.

## Change Boundaries

Agents should keep changes scoped to the active milestone.

For M0, prioritize:

- public API contract;
- document/schema contract;
- package boundary contract;
- renderer backend vocabulary;
- verification policy;
- documentation governance.

Do not implement large editor/runtime features while a contract is still being
validated unless the user explicitly asks for that implementation.

## Naming Policy

The current name `@denovo/canvas` is provisional.

When the name changes:

1. update the facade package name;
2. update examples and docs;
3. run `pnpm build`;
4. run `pnpm verify:public-api`;
5. add a history entry describing the rename.

The API shape should remain stable unless a breaking-change decision is recorded.

## Handoff Policy

At the end of a task, agents should report:

- what changed;
- what was verified;
- what was not verified;
- where the source-of-truth documents are;
- the next recommended action.

Do not mark a phase complete without verification evidence.
