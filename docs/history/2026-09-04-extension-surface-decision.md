# 2026-09-04 Extension surface decision

## Date

2026-09-04

## Scope

Architecture decision on whether the plugin structure is the product's
extensibility story. Documentation plus two JSDoc clarifications. No export,
schema, namespace string, or package boundary change.

## Decision

Recorded in [Extension Surface Decision](../extension-surface-decision.md).

- The kind (namespaced type, closed props schema, official drawer, named
  operations) is the only product-level extension seam.
- Optional engines are packages that emit core kinds. BIM and diagram
  already work this way and use no plugin mechanism.
- `CanvasPlugin` is a per-canvas host bundle of tools and host-private
  commands. It is not agent vocabulary, does not replay through storage,
  and must not grow node, renderer, storage, importer, or worker
  registration.
- `pluginState` is host bookkeeping. Nothing that draws, picks, or undoes
  may live only there. The only consumer in the tree is the documented
  absorption failure in `apps/playground-threeui`.
- The ten-category plugin taxonomy, `@denovo/canvas/plugins/*`, the
  `storage:` config field, and the CLI sketch are superseded as direction.
  [Extensibility](../extensibility.md) and
  [Better Auth Style Architecture](../better-auth-style-architecture.md)
  carry status notes and are otherwise unchanged.
- Next contract candidates: a per-kind drawer seam in `@denovo/canvas-web`
  so a host kind stops drawing as a marker without a custom renderer, and a
  read-only `listPluginNodeKinds()`.

## Changes

- Added `docs/extension-surface-decision.md` and linked it from the
  documentation index, architecture map, extensibility, and the Better Auth
  document.
- JSDoc on `CanvasPluginContext` / `CanvasPlugin` and on the document
  `pluginState` field in `packages/core/src/index.ts` states the host-bundle
  and bookkeeping-only rules where a reader meets the types.
- Project status: Active, Next, and Evidence point at the decision.

## Verification

- `pnpm verify:docs` — passed: 160 Markdown files, 542/542 local targets,
  0 symlinks, 0 conflict markers, 4/4 contributor entrypoints, 4/4
  repository skills, 5/5 project-status headings, 6/6 pull-request
  headings.
- `pnpm typecheck` — passed, 36/36 tasks (JSDoc-only edit in core). In a
  fresh checkout `@denovo/react-canvas` must be built once first; it is an
  optional peer of the facade and outside the turbo task graph.
- `git diff --check` — clean.

Not measured: `pnpm build`, `pnpm verify:public-api`, browser rendering,
editor core. No behavior changed.

## Residual risk

- Host kinds still draw as the gray marker until the drawer seam contract
  lands. A host that needs a visual today must still replace the renderer.
- Older documents keep the Better Auth plugin sketches; a reader who skips
  the status note can still take them as direction.
- The region/mask need is served by `rect` / `circle` plus `metadata` today;
  a polygon kind depends on the drawer seam.

## Next action

Write the kind drawer seam contract with the acceptance criteria in the
decision before implementing it. Do not add `CanvasPluginContext` methods,
`pluginState` consumers, or ThreeUI rooms in the meantime.
