---
name: canvas-governance
description: Change or review Denovo Canvas CONTRIBUTING, AGENTS.md, contributor policy, repository skills, documentation index, project status, history, or documentation verification. Do not use for ordinary product documentation that does not affect governance or status.
---

# Canvas Governance

Read [Contributor Operating Policy](../../../docs/contributor-operating-policy.md),
[Contributor Rules](../../../docs/contributor-rules.md),
[Contributor Automation](../../../docs/contributor-automation.md), and
[Project Status](../../../docs/project-status.md) before editing governance.

Keep shared rules in the contributor rulebook, automation-only safeguards in
the nearest `AGENTS.md`, task-specific workflows in focused skills, deterministic
checks in repository scripts, current state in project status, and chronological
evidence in history. Preserve legacy paths when removing them would break
historical or external links.

When project status changes, refresh the date, keep Current Phase and Active in
agreement, move landed work out of Next, and copy counts only from current
verifier output. Add or update one history entry for the durable governance
decision.

Run:

```sh
pnpm verify:docs
```

If the verifier changes, temporarily introduce one valid failing fixture,
confirm the expected error count and category, restore it, and rerun green. Run
code, browser, or public API gates only if those surfaces also changed.

Report changed sources of truth, exact documentation counts, guard mutation
evidence, legacy compatibility, residual enforcement gaps, and unmeasured code
or runtime scope.
