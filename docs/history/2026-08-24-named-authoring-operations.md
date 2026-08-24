# 2026-08-24 Named authoring operations (design)

## Date

2026-08-24

## Scope

Post-federation UX direction: humans should read one line, agents should
call the same line. This entry records the contract only. No helpers
ship in this change.

## Design decision

Do not add an agent protocol, a fluent `editor.foo().bar()`, or more
gesture tools. The rule is a pure function
`(document) => { document, changed, commands }`. The reading shape is a
list (`applyNamedOperations` / `editor.apply`), like Flutter `children`.
The editor only applies that result.

`stackBox` is document-only (M3.1 analytic box faces), not a live
surface-point runtime. First three, in order: `setLayerVisible`,
`stackBox`, `listNodes`. BIM `modelId` listing stays in
`@denovo/canvas-bim`. WebGPU stays deferred and must accept the same
calls later.

See [Named Authoring Operations](../named-authoring-operations.md).

## Changes

- New contract document and status/index links.

## Verification

Design only. Slice 1 evidence is in
[2026-08-24 named operations setLayerVisible](./2026-08-24-named-operations-set-layer-visible.md).

## Residual risk

- `stackBox` is document-only (M3.1 analytic box faces). A live
  `resolveSurfacePoint` caller is out of contract.
- Summaries omit geometry on purpose. Hosts that need tessellation keep
  using `geometryStore`.

## Next action

Done for design. Implementation continues at slice 2 (`stackBox`).
