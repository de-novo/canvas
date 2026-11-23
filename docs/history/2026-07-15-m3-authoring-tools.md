# M3 Authoring Contract Implementation

Date: 2026-07-15

## Scope

Record the durable schema, type, responsibility, and runtime decisions that
complete the implementation surface of
[M3 Authoring Tools](../m3-authoring-contract.md) while keeping milestone
verification status in [Project Status](../project-status.md).

## Changes

- Made `0.2.0` the canonical document schema. Strict legacy `0.1.0` input
  migrates deterministically by adding the default layer and common authoring
  fields; unsupported schema versions fail explicitly.
- Added renderer-independent layer, group, measurement, and annotation schemas
  with strict mode, hierarchy, target, visibility, and lock validation.
- Required every raw `node.update` to carry correlated `nodeMode` and
  `nodeType`. Added `createNodeUpdateCommand()` so property authoring and
  generated inverses derive that source identity and the concrete patch type.
- Completed transient translate, rotate, and scale tools and stable handle
  vocabulary for Canvas2D and Three.js without storing renderer objects in
  documents or editor history.
- Added precise rect/circle and box/sphere creation tools, atomic group/ungroup
  helpers, layer commands, grid-only snap math, distance-measurement tools, and
  annotation tools with required IDs, layers, work planes, draft providers, and
  runtime capabilities.
- Kept scene-point math and preview rendering in the web runtimes, tool state
  and command semantics in editor core, schemas and migrations in core, and
  capability wiring/re-exports in the facade.
- Added explicit editor tool-session cancellation, runtime replacement events,
  and lease-serialized authoring preview cleanup. Late resolver, provider, and
  preview results cannot mutate a cancelled session or clear a newer session;
  cleanup errors are returned as `CanvasEditorError` or sent to `onError`.
- Replaced bare plugin command registration with descriptor-backed payload
  parsing that correlates each `plugin.${string}` key with its handler payload.
  Restricted plugin-owned tool IDs to `plugin.<owner>.tool.<name>` while
  preserving literal IDs through built-in tool factory return types and
  retaining application-defined IDs for direct editor registrations.
  Plugin setup now validates whole command/tool registrations before commit and
  stores frozen canonical snapshots; direct editor cleanup and dispatch capture
  registration-time IDs, types, and parsers instead of rereading mutable caller
  objects.
  Removed nonfunctional node/renderer declarations, optional registration
  no-ops, mutable public registry exposure, and facade storage fields that were
  only recorded rather than executed.
- Made facade scene sources and renderer configs mutually exclusive and added
  runtime validation for untyped callers. Inline nodes are mode-correlated,
  custom backends require an adapter, built-in backends reject adapters, and
  optional custom runtime capabilities are all-or-none.
- Made backend selection strict: `auto` selects only a genuinely implemented,
  mode-compatible backend with the required capability. Explicit unavailable,
  unimplemented, mode-incompatible, or adapter-less requests fail instead of
  silently selecting another backend. The enforceable rendering rule now states
  the same boundary.
- Expanded the vanilla facade example as the host-level acceptance surface for
  creation, property editing, groups/layers, snapping, measurements,
  annotations, undo/redo, and strict JSON reload.

## Verification

The repository-owned M3 baseline passed on 2026-07-15:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
pnpm verify:document-schema
pnpm verify:editor-core
pnpm verify:hit-testing
pnpm verify:browser-rendering
```

The browser verifier passed repeatedly in fresh desktop and mobile contexts,
including once after the final command/tool snapshot rebuild. It covers 2D and
3D creation, grid/work-plane snapping, property edits, rotate/scale previews
and commits, groups/layers, lock rejection, measurements, annotations, hit
editing, undo/redo, strict JSON reload, dynamic renderer replacement, real
mobile touch routing, non-blank output, and bounded demand rendering. WebGL
transient preview and cleanup use deterministic render/draw-call probes.

The public declaration audit found zero explicit `any` occurrences across 17
declaration files. Positive/negative fixtures cover mode/node relationships,
node-specific updates, command payload parsing, plugin tool namespaces, all
seven literal-ID-preserving tool factories, exclusive facade configs, and
React 2D/3D scene inputs.

The configured external documentation-governance scripts were unavailable at
`~/.agents/skills/doc-governance/scripts/`; that condition is not
reported as a pass. Both exact commands exited `2` with `No such file or
directory`. On 2026-07-15, a repository-local Markdown link audit read 42
Markdown files and checked 150 local targets with zero missing targets.

## Residual Risk at 2026-07-15

- At this entry's cutoff, the two configured external
  documentation-governance commands had not run successfully, so this entry
  recorded implementation completion rather than milestone verification.
- Generalized migration registries, patch persistence, and remote sync remain
  M6 work; the `0.1.0` to `0.2.0` migration does not imply those transports.

## Next Action at 2026-07-15

Restore the configured documentation-governance scripts, run both commands,
and mark M3 verified only if they pass. Then scope M4 performance workloads
without pulling M6 persistence transport forward.

## Closeout

The documentation-governance dependency was recovered and both mandatory
commands passed on 2026-07-16. See
[M3 Authoring Tools Verification](./2026-07-16-m3-authoring-verified.md) for the
final evidence; current status remains owned by
[Project Status](../project-status.md).
