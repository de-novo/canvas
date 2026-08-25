# 2026-08-25 Named operations `removeEdge`

## Date

2026-08-25

## Scope

Named authoring slice 9. Pair for `removeNode` when a connected
diagram node must go. One helper still does not delete both. No new
playground.

## Changes

- `@denovo/canvas-editor` and `@denovo/canvas` export `removeEdge`
  and `RemoveEdgeInput`.
- Source MUST be an `edge`. Compiles to one `node.remove`.
- Unknown `nodeId` is `node-not-found`. A non-edge is
  `invalid-command`. An effectively locked edge is `locked-target`.
- Another edge still targeting this edge fails.

## Verification

Ran 2026-08-25:

- `pnpm typecheck` — 36/36
- `pnpm build` — 25/25
- `pnpm verify:public-api` — `public-api-suite` ok, including
  `RemoveEdgeInput` and `@ts-expect-error` on extra fields
- `pnpm verify:editor-core` — ok, including non-edge reject and
  `removeEdge` then `removeNode` in one list
- `pnpm verify:named-operations` — 3/3, including the same list
- `pnpm verify:docs` — 142 Markdown files, 466/466 local targets

## Residual risk

- Callers still write the list (`removeEdge` then `removeNode`). There
  is no "delete node and its edges" helper.
- No playground control. Proof is editor-core and the existing
  named-operations document check.

## Next action

Add another named operation only when the change is sayable. Do not
wrap ThreeUI. Do not add a playground for this helper.
