# Agent Guide

This file is the first operating guide for agents working in this repository.
Read it before changing code or documentation.

## Mission

Build a general-purpose web SDK that makes 2D/3D canvas viewing, editing,
storage, extension, and performance work easier than wiring low-level rendering
libraries directly.

The product is not React-only and not Next.js-only. React, Next.js, R3F, Vue,
Svelte, Solid, Astro, workers, servers, BIM, and future renderers are adapters
around a framework-agnostic document model.

The library name may change before release. Treat the stable contract as the
facade API shape, package boundaries, document schemas, renderer backend
vocabulary, and verification policy, not the current package name.

## Source Of Truth

Use these documents in order:

1. [Agent Operating Policy](./docs/agent-operating-policy.md)
2. [Agent Rules](./docs/agent-rules.md)
3. [Project Status](./docs/project-status.md)
4. [Documentation Index](./docs/README.md)
5. [M0 Product Contract](./docs/m0-product-contract.md)
6. [Public API Contract](./docs/public-api-contract.md)
7. [Vision and Milestones](./docs/vision-and-milestones.md)

When documents conflict, update the narrower stale document or record a
decision. Do not let duplicate status claims drift.

## Work Loop

For every non-trivial task:

1. Identify the active milestone and acceptance criteria.
2. Apply the [Agent Rules](./docs/agent-rules.md) relevant to the task.
3. Make the smallest coherent change.
4. Verify with commands appropriate to the risk.
5. Update project status when the phase changes.
6. Add a history entry for durable decisions, completed milestones, or verified
   contract changes.

## Public Type Safety Gate

Apply this gate to every exported facade, adapter, plugin, callback, authoring
helper, and protocol type before considering the work complete.

- MUST NOT expose explicit `any` in generated package declarations.
- MUST NOT use `unknown`, `Record<string, ...>`, or an unconstrained `string` as
  a convenience when a schema-derived type, discriminated union, template
  literal, mapped type, or generic relationship can express the contract.
- MAY use `unknown` only at a genuine untrusted-input, validation, error-cause,
  intentionally erased heterogeneous-registry, or undeclared dynamic-protocol
  boundary. Narrow or translate it immediately after that boundary and document
  the reason when it remains public.
- MUST give authoring helpers concrete input types. Reserve `unknown` inputs for
  `safeDefine*`, parse, decode, and validation APIs that actually validate
  external values.
- MUST give callbacks concrete return types and correlate protocol keys with
  their payload and result types. Plugin-owned identifiers MUST use their
  documented namespace instead of a general `string`.
- MUST derive public input/output types from the canonical schema or domain
  union where one exists. Do not maintain a broader handwritten shadow type.
- MUST add positive consumer inference fixtures and negative
  `@ts-expect-error` fixtures for a changed public type, then inspect generated
  `.d.ts` files for broad-type leakage.
- MUST run `pnpm typecheck`, `pnpm build`, and `pnpm verify:public-api` after a
  public type change. A type contract is not verified by runtime tests alone.

The canonical detailed rules and rationale live in
[Agent Rules](./docs/agent-rules.md) and
[Public API Contract](./docs/public-api-contract.md).

## Verification Baseline

M0 public API work should pass:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

M2 editor-core work must also pass:

```sh
pnpm verify:editor-core
```

Browser-facing rendering work must also include Playwright screenshot or pixel
checks across relevant desktop and mobile viewports. Use:

```sh
pnpm verify:browser-rendering
```

## Documentation Rules

Repository Markdown files are the source of truth. Keep them inside this repo.
Do not symlink them to an external vault. Use Obsidian CLI only for inspection
and link audits.

Status belongs in [Project Status](./docs/project-status.md). Durable
chronological evidence belongs under [History](./docs/history/README.md).

### Project Status hygiene (mandatory)

`docs/project-status.md` is the canonical status index and an agent's first
read. Drift here is high-leverage trust failure, so every non-trivial change
MUST keep it internally consistent. Before considering status work done:

- **Update `Last updated:`** at the top to today's date.
- **Keep `## Current Phase` and `## Active` in agreement.** `Current Phase`
  must describe what the project is working on right now; `Active` must not
  claim a milestone as "landed/done" that `Current Phase` still calls "next",
  and vice versa. If a milestone slice ships, move it out of "next" in both
  sections in the same change.
- **Re-count the evidence.** Update package/task counts, dates, and the
  `verify:*` list to reflect what actually ran. Do not leave stale counts from
  before a package was added.
- **Refresh `## Evidence`** with the `verify:*` results and the date they ran.
- **Add a [History](./docs/history/README.md) entry** for the durable change
  and link it from Evidence.
- **Do not call a milestone "verified"** unless its acceptance criteria ran.
  Landed-but-unverified work goes in `Active` with an explicit "not yet
  verified" note (as M4–M6 do now).

When documents conflict, update the narrower stale document or record a
decision. Do not let duplicate status claims drift.
