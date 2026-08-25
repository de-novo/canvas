# Automated Contributor Guide

This file adds automation-specific safeguards to the repository's shared
contribution rules. Human and automated contributors follow the same product,
quality, and verification contracts; automation reads this file first because
it also needs workspace-preservation and handoff rules.

## Shared Source Of Truth

After this file, read the shared documents in this order:

1. [Contributing](./CONTRIBUTING.md)
2. [Contributor Operating Policy](./docs/contributor-operating-policy.md)
3. [Contributor Rules](./docs/contributor-rules.md)
4. [Contributor Automation](./docs/contributor-automation.md)
5. [Project Status](./docs/project-status.md)
6. [Documentation Index](./docs/README.md)
7. The contract or architecture document governing the requested surface

The shared rulebook is canonical for product invariants, package boundaries,
public type safety, verification, and documentation. Do not restate those rules
here. When documents conflict, update the narrower stale document or record a
decision instead of allowing duplicate claims to drift.

## Automation Startup

Before non-trivial work:

1. inspect the worktree and preserve existing changes;
2. identify the active milestone, requested outcome, and acceptance criteria;
3. determine whether the work changes a public contract, package boundary,
   document schema, renderer backend, persistence format, or governance policy;
4. read the closest applicable `AGENTS.md` and relevant canonical documents;
5. state any assumption that would materially affect scope before relying on
   it.

## Task-Specific Skills

Repository skills live under `.agents/skills` and are loaded only when their
task matches. Use the narrowest applicable skill for public contract changes,
editor-core changes, browser rendering verification, or governance work.

Skills route to canonical documents and risk-matched commands. They do not
override the shared contributor policy or authorize broader side effects. The
catalog and ownership rules live in
[Contributor Automation](./docs/contributor-automation.md).

## Automation Safeguards

- MUST keep edits inside the requested scope and avoid unrelated cleanup.
- MUST preserve human and other contributor changes. Do not overwrite or remove
  work merely because it is uncommitted or unfamiliar.
- MUST NOT run destructive Git, filesystem, data, publication, or deployment
  operations unless the request clearly authorizes the exact action and target.
- MUST use read-only inspection to resolve ambiguous targets before mutation.
- MUST stop and ask when a missing decision would materially change the public
  contract, compatibility, data, release, or security outcome.
- MUST treat generated output, credentials, tokens, network bodies, and local
  machine state according to repository policy; do not expose secrets in logs
  or handoffs.
- SHOULD use existing repository scripts and patterns before adding new
  automation or structure.

## Automated Work Loop

For every non-trivial task:

1. define the smallest coherent change;
2. inspect the current implementation and its verification path;
3. make the change without disturbing unrelated worktree state;
4. run the risk-matched checks in the shared contributor policy;
5. update status only when status changed, and add history for durable rule,
   contract, boundary, milestone, or verification changes;
6. inspect the final diff and worktree state;
7. report changed files, exact checks and outcomes, unmeasured scope, residual
   risk, and the next action if one remains.

Never describe a phase, contract, or milestone as verified when its acceptance
criteria did not run.

## Code Review Rules

Review the changed contract and behavior before style. Flag:

- contradictions with the canonical contributor or product contracts;
- public declaration broadening, leaked implementation types, or missing
  positive and negative consumer fixtures;
- silent renderer, schema, persistence, or capability fallback;
- verification claims that exceed the commands and counts actually reported;
- project-status drift or missing history for a durable rule, contract,
  boundary, milestone, or verified regression change;
- unrelated refactors or generated-file noise that obscure the requested
  outcome.

Do not use review prose as a substitute for a deterministic repository gate.
When a safe path or documented exception exists, identify it with the finding.
