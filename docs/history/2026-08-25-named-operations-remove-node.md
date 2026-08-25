# 2026-08-25 Named operations `removeNode`

## Date

2026-08-25

## Scope

Named authoring slice 8. Host UI and agents delete a node with the
same list-apply helper as hide/lock. No new playground.

## Changes

- `@denovo/canvas-editor` and `@denovo/canvas` export `removeNode`
  and `RemoveNodeInput`.
- Compiles to one `node.remove`. Unknown `nodeId` is
  `node-not-found`. An effectively locked node is `locked-target`.
- A node still referenced by an edge fails. A non-empty group fails.
  Extra fields fail. Incident edges are not removed.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `RemoveNodeInput` and `@ts-expect-error` on extra fields
- `pnpm verify:editor-core` — ok, including remove, unknown id,
  locked-target, edge-referenced rect, and non-empty group
- `pnpm verify:named-operations` — 3/3, including document remove of
  the stacked box and the existing BIM / vanilla browser checks
- `pnpm verify:docs` — 141 Markdown files, 463/463 local targets

## Residual risk

- Deleting a connected diagram node uses `removeEdge` then
  `removeNode` in one list. See
  [2026-08-25 named operations removeEdge](./2026-08-25-named-operations-remove-edge.md).
- No playground control. Proof is editor-core and the existing
  named-operations document check.

## Next action

Add another named operation only when the change is sayable. Do not
wrap ThreeUI. Do not add a playground for this helper.
