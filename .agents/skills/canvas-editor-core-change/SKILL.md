---
name: canvas-editor-core-change
description: Implement or review Denovo Canvas editor commands, transactions, undo and redo, selection, tools, authoring sessions, or named operations. Do not use for renderer-only changes or persistence adapters that do not alter editor behavior.
---

# Canvas Editor Core Change

Read [Contributor Rules](../../../docs/contributor-rules.md),
[Project Status](../../../docs/project-status.md),
[Editing Model](../../../docs/editing-model.md), and the relevant authoring
contract before changing editor behavior.

Keep persistent edits command- or transaction-based, editor state independent
from renderer objects, tool previews transient, and undo/redo deterministic.
Preserve existing serialization, cancellation, cleanup, registration, and
history boundaries unless the accepted contract explicitly changes them.

Add focused checks for the changed behavior and its failure path. When a guard
is important, exercise one valid mutation that should fail, confirm the runner
reports it, and restore the valid implementation.

Run:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
pnpm verify:editor-core
```

Add `pnpm verify:document-schema` when command or document schemas change and
`pnpm verify:named-operations` when named authoring operations or their
playground integration changes. Add browser verification only when the visible
or interaction boundary changes.

Report exact check counts, document and history effects, cancellation or
rollback coverage, and unmeasured browser, persistence, or performance scope.
