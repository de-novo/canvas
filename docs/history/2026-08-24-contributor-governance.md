# 2026-08-24 Contributor Governance

**Date:** 2026-08-24

**Status:** landed

## Scope

Generalize repository work policy from an agent-only contract into one shared
contract for human developers, maintainers, and automated contributors, with
task-specific repository skills and deterministic validation.

## Changes

- Made [Contributing](../../CONTRIBUTING.md) the public contribution entrypoint
  with product boundaries, setup, scoping, implementation, verification,
  documentation, review, conduct, and security guidance.
- Added the canonical
  [Contributor Operating Policy](../contributor-operating-policy.md) and
  [Contributor Rules](../contributor-rules.md).
- Reduced [AGENTS](../../AGENTS.md) to automation-specific startup, worktree
  preservation, destructive-action, and handoff safeguards.
- Kept the former agent policy and rule paths as legacy-link documents so
  historical and external links remain valid without maintaining duplicate
  rules.
- Added repository-local `pnpm verify:docs` coverage for required governance
  files, local Markdown targets outside fenced examples, Markdown symlinks,
  conflict markers, canonical contributor entrypoints, and project-status
  structure.
- Replaced user-home documentation commands in active M3 and M3.1 contracts
  with the repository-local verifier; historical evidence remains unchanged.
- Added [Contributor Automation](../contributor-automation.md) to define the
  ownership boundary between shared rules, `AGENTS.md`, repository skills,
  deterministic verifiers, status, and history.
- Added four repository skills under `.agents/skills`: public-contract changes,
  editor-core changes, browser-rendering verification, and governance updates.
- Added concise root `AGENTS.md` code-review rules and a pull-request template
  separating scope, compatibility, verification, unmeasured work, and evidence.
- Extended `verify:docs` to validate skill location, directory/name agreement,
  unique names, required descriptions, complete bodies, local links, and the
  pull-request evidence structure.
- Updated the root README, documentation index, project status, and history
  index to point to the shared contributor sources of truth.

## Verification

Passed:

- `pnpm verify:docs`: 119 Markdown files, 369/369 local targets, 0 symlinks,
  0 conflict markers, 4/4 canonical contributor entrypoints, 4/4 repository
  skills, 5/5 required project-status headings, and 6/6 pull-request headings;
- Skill Creator `quick_validate.py`: 4/4 repository skills valid;
- guard mutation: changing the legacy agent-rule pointer to a missing canonical
  rule path made `pnpm verify:docs` fail with exactly one missing-target error;
  restoring the link returned the verifier to green;
- skill guard mutation: changing `canvas-governance` frontmatter to a name that
  did not match its directory made `pnpm verify:docs` fail with exactly one
  name-mismatch error; restoring the name returned the verifier to green;
- pull-request guard mutation: renaming the `Not Measured` heading made
  `pnpm verify:docs` fail with exactly one missing-heading error; restoring the
  heading returned the verifier to green;
- `node --check scripts/verify-docs.mjs` and `git diff --check`.

The former user-home `doc-governance-*.py` commands were attempted first and
failed because those scripts are not installed. They are no longer a
contributor prerequisite; the repository-local verifier is the canonical gate.

No runtime or public API behavior changed, so TypeScript, build, browser,
editor, persistence, and public API verifiers are not measured for this change.

## Residual Risk

- Existing history entries intentionally retain their original agent-oriented
  titles and links because they describe the policy that existed at that time.
- `verify:docs` checks local target existence but does not validate heading
  anchors or remote URL availability.
- Live implicit skill routing is not measured in the current agent session;
  discovery should be confirmed from a new Codex session after these files are
  present in the final worktree.
- Project enforcement remains review-, template-, and verifier-driven; this
  change does not add a CI workflow.

## Next Action

Use one repository skill in the next matching contribution, confirm discovery
from a fresh Codex session, and add CI enforcement only when the repository is
ready to make `pnpm verify:docs` a required pull-request gate.
