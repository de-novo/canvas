# 2026-07-10 Agent Rules

## Date

2026-07-10.

## Scope

Created an enforceable agent rulebook for repository work.

## Changes

- Added [Agent Rules](../agent-rules.md).
- Linked the rulebook from [AGENTS](../../AGENTS.md).
- Added the rulebook to [Documentation Index](../README.md).
- Clarified the relationship between agent rules and
  [Agent Operating Policy](../agent-operating-policy.md).
- Updated [Project Status](../project-status.md) evidence.

## Verification

Passed before and after editing:

```sh
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

## Residual Risk

- This repository is not currently a git repository, so dirty-state reporting is
  limited to filesystem inspection and doc-governance checks.
- Existing unresolved Obsidian links are outside repository docs and were left
  unchanged.

## Next Action

Use the new rulebook when continuing M0 document/schema stability work.
