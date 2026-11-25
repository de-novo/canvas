# Contributor Operating Policy

This document defines how human and automated contributors manage scope,
project status, documentation, verification, decisions, history, review, and
handoff in this repository.

## Audience And Precedence

The policy applies to maintainers, external developers, automation, and agents.
Role-specific entrypoints may add safeguards, but they must not duplicate or
weaken this shared policy.

Use the repository sources in this order:

1. [Contributing](../CONTRIBUTING.md)
2. this operating policy;
3. [Contributor Rules](./contributor-rules.md);
4. [Contributor Automation](./contributor-automation.md) when automation or
   repository skills are involved;
5. [Project Status](./project-status.md);
6. the narrowest contract or architecture document governing the change.

The narrower domain contract wins when it intentionally specializes a general
rule. If two documents make incompatible claims, update the stale document or
record a decision; do not choose silently.

## Product Goal

Denovo Canvas is a general-purpose web ecosystem SDK for 2D/3D canvas viewing,
editing, storage, extension, and performance work. Who we are is defined in
[Product Identity](./product-identity.md).

The SDK should:

- make common 2D/3D setup fast;
- keep vanilla web usage first-class and frameworks optional;
- use proven engines where they help without leaking them as the product API;
- restate open-source impressiveness as our documents, not as hosted
  upstream rooms;
- keep saved documents renderer-independent;
- make view, edit, save, load, extend, and optimize workflows coherent;
- preserve explicit escape hatches for lower-level use.

## Operating Principles

- Prefer the facade API first. Lower-level packages are escape hatches.
- Apply [Contributor Rules](./contributor-rules.md) before changing code,
  package boundaries, public contracts, or durable documentation.
- Keep package names replaceable and validate the current facade name from
  metadata.
- Separate document semantics from runtime implementation.
- Keep core portable and framework-agnostic.
- Use dependencies as engines, not as leaked product surface.
- Keep internal Effect workflows behind ordinary TypeScript public boundaries.
- Verify behavior before describing it as complete.
- Record decisions that constrain future contributors.
- Distinguish measured results, derived estimates, and unmeasured scope.

## Contribution Lifecycle

### 1. Frame The Work

Before editing, identify:

- the requested outcome;
- the active milestone and acceptance criteria;
- the canonical contract and package boundary;
- public API, schema, persistence, renderer, dependency, license, security, and
  migration risk;
- the smallest coherent change that can satisfy the outcome.

If a missing decision would materially change compatibility, stored data,
release behavior, or security, resolve or record the decision before
implementation.

### 2. Inspect The Existing System

Read the current implementation, tests, verification scripts, and relevant
documentation. Prefer established patterns over new structure. Check the
worktree before editing and preserve unrelated contributor changes.

### 3. Implement One Coherent Change

Keep implementation, tests, and required documentation in the same change.
Avoid opportunistic refactors and formatting churn. A future possibility alone
is not enough reason to add an abstraction.

### 4. Verify At The Risk Boundary

Run checks that can fail for the behavior actually changed. A passing unit test
does not verify browser output, public declarations, persistence migration, or
performance unless it exercises that boundary.

When a new guard is important, prove that it detects the forbidden behavior by
temporarily exercising a failing fixture or equivalent mutation, then restore
the valid implementation. Report how many checks ran when the runner provides a
count.

### 5. Synchronize Durable Records

Update the canonical contract when behavior changes. Update project status only
when current phase, Active, Next, Blocked, or evidence changes. Add history for
durable governance, contract, boundary, milestone, verification, or regression
changes.

### 6. Review And Handoff

Describe the outcome, affected contract, compatibility and migration effects,
exact verification results, unmeasured scope, residual risk, and next action.
Review should be possible without reconstructing intent from the diff.

## Project Management

[Project Status](./project-status.md) is the canonical status index. It answers:

- what is verified;
- what is active;
- what is next;
- what is blocked;
- where the evidence lives.

Milestones are defined in
[Vision and Milestones](./vision-and-milestones.md). Do not duplicate full
milestone definitions in status or history.

Use these statuses:

- `planned`: accepted but not started;
- `active`: currently being worked;
- `verified`: completed with acceptance evidence;
- `blocked`: cannot proceed without a named decision, dependency, or capability;
- `superseded`: replaced by a newer decision or plan.

“Landed”, “implemented”, and “verified” are not synonyms. Work may be landed
while acceptance criteria remain unmeasured.

### Project Status Hygiene

Whenever `docs/project-status.md` changes:

- update `Last updated:` to the current date;
- keep `Current Phase` and `Active` in agreement;
- move completed work out of `Next` in the same change that describes it as
  landed;
- recount package, task, assertion, viewport, and sample totals from actual
  verifier output;
- refresh `Evidence` with the exact command outcome and run date;
- link the history entry for a durable change;
- label landed work with unrun acceptance criteria as not yet verified.

Status drift is a high-impact trust failure. Do not copy an old count or verdict
forward without current evidence.

## Documentation Management

Repository documentation lives under `docs/`. Root Markdown is reserved for
public or tool entrypoints such as `README.md`, `CONTRIBUTING.md`, and
`AGENTS.md`.

Keep repository Markdown in this repository; do not symlink it to an external
vault. Obsidian or other knowledge-base tooling may inspect and audit links but
does not own the canonical files.

Add a document only when it creates a durable source of truth. Prefer updating
an existing canonical document. Document types are:

- product contracts;
- architecture and decision records;
- contributor policy and rules;
- the status index;
- chronological history evidence;
- repeatable runbooks.

Before and after documentation-heavy work, run:

```sh
pnpm verify:docs
```

Record pre-existing external or Obsidian-only link risk; do not silently rewrite
unrelated sources.

## History Management

Durable history lives under `docs/history/`. Create an entry when:

- a milestone or verification item is completed;
- a public API or schema contract changes;
- a package, renderer, persistence, or dependency boundary changes;
- a governance rule changes;
- a significant regression is discovered or fixed.

Each entry should include the date, scope, changes, verification commands and
outcomes, residual risk, and next action. History is evidence, not a second
status index.

## Verification Policy

Verification must match risk.

For TypeScript, package, export, or public API work:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
```

For editor command, transaction, selection, tool, or history work:

```sh
pnpm verify:editor-core
```

For browser-visible rendering work, run the relevant app and verifier, check
non-blank output, and cover desktop and mobile when layout or interaction can
change. Stop background servers after verification.

For performance work, define the workload and environment, measure before and
after more than once, report absolute and relative results, and distinguish
direct measurements from derived estimates. A machine-dependent observation is
not a universal gate.

For documentation-only work, `pnpm verify:docs` is the acceptance check. Code
checks are not implied unless code or generated contracts changed.

## Decision And Change Boundaries

Use a durable decision when a choice affects future public API, schema,
persistence, package boundaries, renderer strategy, dependencies, licensing,
security, or migration work. Record context, decision, alternatives,
consequences, date, and related milestone.

Keep changes scoped to the accepted outcome. Do not implement a large runtime
feature while its contract is undecided. Do not broaden a task merely because a
nearby cleanup is possible.

The current name `@de-novo/canvas` is provisional. A rename must update facade
metadata, examples, and documentation; run build and public API verification;
and add history. The API shape stays stable unless a breaking-change decision is
recorded.

## Handoff Contract

Every completed contribution or handoff reports:

- what changed and why;
- the canonical files changed;
- exact verification commands, results, and available counts;
- checks not run and behavior not measured;
- compatibility, migration, security, and residual risk;
- the next recommended action, if any.

Do not mark a phase or milestone complete without its acceptance evidence.
