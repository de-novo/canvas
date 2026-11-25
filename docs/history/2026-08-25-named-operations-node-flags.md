# 2026-08-25 Named operations `setNodeVisible` / `setNodeLocked`

## Date

2026-08-25

## Scope

Named authoring slice 5. Host UI and agents hide, show, lock, and
unlock a node with the same list-apply helpers. No new playground.

## Changes

- `@de-novo/canvas-editor` and `@de-novo/canvas` export
  `setNodeVisible`, `setNodeLocked`, `SetNodeVisibleInput`, and
  `SetNodeLockedInput`.
- Each compiles to one `node.update` of that field. Unknown `nodeId`
  is `node-not-found`. Extra fields and a non-boolean flag fail at the
  helper. Already-in-state does not grow history.
- A locked node rejects `setNodeVisible`. `setNodeLocked({ locked:
  false })` may unlock the node itself when the lock is not from a
  parent or layer.
- Works in 2D and 3D. The compiled command keeps `nodeMode` /
  `nodeType`.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `SetNodeVisibleInput` / `SetNodeLockedInput` and `@ts-expect-error`
  on extra fields
- `pnpm verify:editor-core` — ok, including 3D hide/lock/unlock, 2D
  `rect` `nodeMode`, unknown id, locked-target
- `pnpm verify:named-operations` — 3/3, including document hide/lock
- `pnpm verify:docs` — 138 Markdown files, 456/456 local targets

## Residual risk

- These helpers write the node's own flag, not effective state.
  Hiding a parent group still hides children through
  `getEffectiveNodeState`.
- No playground control. Proof is editor-core and the existing
  named-operations document check.

## Next action

Add another named operation only when the change is sayable. Do not
wrap ThreeUI. Do not add a playground for these helpers.
