# 2026-07-10 Agent Operating Policy

## Scope

Agent, project management, documentation management, and history management
policy.

## Changes

- Added root [Agent Guide](../../AGENTS.md).
- Added [Agent Operating Policy](../agent-operating-policy.md).
- Added [Project Status](../project-status.md) as the canonical status index.
- Added this `docs/history/` directory as chronological evidence storage.

## Verification

Passed:

```sh
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

## Residual Risk

- This repository is currently not a git repository, so history entries are more
  important until version control is initialized.
- Existing Obsidian unresolved links may come from outside repo docs and are not
  part of this policy change.

## Next Action

Use [Project Status](../project-status.md) before starting the next M0
verification task.
