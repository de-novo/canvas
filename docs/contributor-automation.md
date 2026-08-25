# Contributor Automation

This document maps repository guidance, task-specific skills, deterministic
verification, and evidence. It keeps each rule in one source of truth while
making automated contributions reproducible.

The repository follows the official
[OpenAI skills](https://learn.chatgpt.com/docs/build-skills) and
[AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
discovery conventions.

## Ownership Map

| Concern | Canonical location | Loading behavior |
| --- | --- | --- |
| Public contribution entrypoint | `CONTRIBUTING.md` | Read by every contributor |
| Shared policy and enforceable rules | `docs/contributor-*.md` | Read before non-trivial work |
| Automation-only safeguards | `AGENTS.md` | Loaded automatically by compatible agents |
| Task-specific procedures | `.agents/skills/*/SKILL.md` | Loaded only when selected or matched |
| Deterministic gates | `scripts/verify-*.mjs` and package scripts | Run for the affected risk boundary |
| Pull-request evidence | `.github/PULL_REQUEST_TEMPLATE.md` | Completed by the contributor and checked in review |
| Current status | `docs/project-status.md` | Updated only when status or evidence changes |
| Durable evidence | `docs/history/` | Added for durable decisions and verified changes |

Do not copy shared product, type-safety, status, or verification rules into
`AGENTS.md` or a skill. Those files link to the canonical policy and add only
role- or task-specific procedure.

## AGENTS.md Policy

The root `AGENTS.md` contains repository-wide automation safeguards. Add a
nested `AGENTS.md` only when a subtree has a genuine invariant or verification
command that differs from the root. Use `AGENTS.override.md` only for an
intentional local override; do not use it to hide a repository-wide rule.

Keep always-loaded guidance concise. Formatting, link integrity, skill
frontmatter, and other deterministic requirements belong in `pnpm verify:docs`.

## Repository Skills

Repository skills live under `.agents/skills` so they are discovered from the
repository root and its subdirectories.

| Skill | Use when | Primary gates |
| --- | --- | --- |
| `$canvas-public-contract-change` | Exported facade, package export, schema-derived type, document, or protocol compatibility can change | `typecheck`, `build`, `verify:public-api`, plus the affected domain verifier |
| `$canvas-editor-core-change` | Editor commands, transactions, history, selection, tools, or named operations change | `typecheck`, `build`, `verify:public-api`, `verify:editor-core` |
| `$canvas-browser-rendering` | Visible canvas rendering, layout, interaction, or renderer lifecycle changes | Matching browser verifier with desktop/mobile evidence |
| `$canvas-governance` | Contributor policy, `AGENTS.md`, skills, status, history, or documentation verification changes | `verify:docs` and a failing guard mutation when the verifier changes |

Skills support both explicit invocation and implicit matching. Their
descriptions must be narrow enough that internal-only, browser-only, and
governance work do not all activate the same procedure.

## Add Or Change Automation

Choose the narrowest owner:

1. Put a rule that applies to every contributor in `docs/contributor-rules.md`.
2. Put an automation-only safety invariant in the root or nearest
   `AGENTS.md`.
3. Put a repeatable task-specific workflow in one focused skill.
4. Put deterministic classification or verification in a repository script.
5. Put measured outcomes in project status and history, not in reusable rules.

For a skill:

- use a lowercase, hyphenated directory and matching frontmatter `name`;
- write a concise, discriminating `description` that states its trigger and
  nearest exclusion;
- link canonical repository contracts instead of copying them;
- add scripts or references only when repeated deterministic work requires
  them;
- add `agents/openai.yaml` only when UI metadata, dependencies, or a non-default
  invocation policy is actually required;
- keep implicit invocation enabled unless the workflow must be explicit-only;
- run `pnpm verify:docs` after creation or modification.

`pnpm verify:docs` validates skill location, directory/name agreement, unique
names, required frontmatter, local links, canonical contributor entrypoints,
and project-status structure.

## Review Boundary

Automation does not grant permission to publish, deploy, mutate external
systems, or broaden a contribution. User authorization and the shared
contributor policy remain the authority for side effects.
