# Agent Rules

This document defines enforceable rules for agents working in this repository.
It complements [Agent Operating Policy](./agent-operating-policy.md), which
defines process, status, documentation, verification, and history management.

## Rule Levels

- `MUST`: required unless the user explicitly overrides it.
- `SHOULD`: default choice unless local evidence shows a better path.
- `MAY`: allowed, but not required.

## Startup Rules

- MUST read [AGENTS](../AGENTS.md) before non-trivial work.
- MUST identify the active phase from [Project Status](./project-status.md).
- MUST check whether the requested work changes a public contract, package
  boundary, document schema, renderer backend, persistence format, or
  documentation policy.
- SHOULD keep changes scoped to the active milestone unless the user explicitly
  asks for broader work.
- SHOULD prefer existing package and document patterns over inventing new
  structure.

## Product Invariants

- MUST treat the SDK as a general-purpose web ecosystem SDK, not as a
  React-only or Next.js-only library.
- MUST keep vanilla web usage first-class.
- MUST keep React, Next.js, R3F, Vue, Svelte, Solid, Astro, BIM, workers, and
  server utilities as adapters or extensions around the core model.
- MUST treat the current library name as provisional.
- MUST preserve the stable contract through facade API shape, package
  boundaries, document schemas, renderer vocabulary, and verification policy.
- SHOULD make low-level 2D/3D libraries easier to use without hiding escape
  hatches.

## Package Boundary Rules

- MUST keep `packages/core` framework-agnostic.
- MUST NOT add React, Next.js, DOM, R3F, Drei, xeokit, or web-ifc dependencies
  to core.
- MUST expose the default public SDK through the facade package first.
- SHOULD keep lower-level packages available as escape hatches.
- SHOULD add optional capability through explicit subpath entrypoints or
  adapters instead of broadening the default import.
- MUST update package boundary docs and public API verification when exports
  change.

## Public API Rules

- MUST keep the default import path small, stable, and easy to learn.
- MUST NOT expose implementation-only dependency types through the facade API.
- MUST NOT expose explicit `any` in generated package declarations.
- MUST NOT substitute `unknown`, `Record<string, ...>`, or an unconstrained
  `string` for a concrete public domain contract when schema-derived types,
  discriminated unions, template literals, mapped types, or generics can express
  it.
- MAY retain `unknown` only at genuine validation, untrusted-input, error-cause,
  intentionally erased heterogeneous-registry, or undeclared dynamic-protocol
  boundaries. Public occurrences MUST have a documented boundary reason.
- MUST give authoring helpers concrete input types and reserve `unknown` inputs
  for APIs that actually parse, decode, or validate external values.
- MUST give callback results concrete types and correlate protocol identifiers
  with their payload and result types.
- MUST derive public types from the canonical schema or domain union when one
  exists instead of maintaining a broader handwritten shadow type.
- MUST add positive inference and negative `@ts-expect-error` consumer fixtures
  for changed public types and inspect generated declarations for broad-type
  leakage.
- MUST keep optional framework adapters optional.
- MUST run `pnpm verify:public-api` after public API or export-map changes.
- MUST record a history entry for public API changes.
- SHOULD validate facade names from package metadata instead of hardcoding the
  current package name in tests.

## Document Model Rules

- MUST keep saved documents renderer-independent.
- MUST make scene and document JSON serializable.
- MUST validate public document inputs with schemas.
- MUST reject invalid identity relationships such as duplicate node ids.
- MUST reject built-in nodes whose dimension does not match the scene `mode`.
- SHOULD design document data so it can survive renderer backend changes.
- SHOULD prefer explicit migrations over silent shape changes.
- MUST document migration policy before making breaking persistence changes.

## Editing Rules

- MUST model editing as commands, patches, transactions, or another explicit
  change representation.
- MUST preserve enough information for undo and redo in editor-facing flows.
- MUST keep editing semantics separate from renderer implementation details.
- SHOULD make selection, transform, grouping, metadata, and asset changes
  representable without coupling to Three.js or Canvas2D objects.
- SHOULD keep command payloads serializable unless a documented escape hatch is
  required.

## Persistence Rules

- MUST separate scene data, asset references, runtime caches, and command
  history.
- MUST NOT store renderer instance objects in persisted documents.
- SHOULD support local-first storage paths before collaboration protocols.
- SHOULD keep future sync and collaboration compatible with deterministic
  commands or patches.
- MUST document any persistence format change that can affect saved user data.

## Rendering Rules

- MUST treat WebGPU as reserved target vocabulary and a future adapter
  milestone, not the current `auto` result and not the only supported runtime.
- MUST keep WebGL2 and Canvas2D as the implemented built-in backends.
- MUST NOT describe or implement `auto` as resolving to WebGPU until a
  compatible runtime exists.
- MUST NOT silently substitute another backend for an explicitly requested
  backend. `auto` MAY resolve only to an implemented, mode-compatible backend
  whose required capability is available; otherwise it MUST fail explicitly.
- MUST use capability detection for backend selection.
- MUST verify browser-facing rendering with Playwright screenshots or canvas
  pixel checks before marking rendering work complete.
- SHOULD also exercise changed playgrounds and visual surfaces in ego-browser
  (click, drag, overlay, camera) and treat a real-use screenshot as required
  evidence, not optional decoration.
- SHOULD use demand-based render loops where static scenes do not require
  continuous frames.
- SHOULD prefer instancing, direct buffer geometry, batching, LOD, frustum
  culling, chunk loading, and worker offload for large scenes.
- MUST keep renderer hot paths imperative and allocation-aware.

## Dependency Rules

- MUST use dependencies as engines, not as leaked product surface.
- MUST keep dependency choices documented in
  [Dependency Strategy](./dependency-strategy.md).
- MUST use TypeScript 7 as the repository development toolchain.
- MUST NOT require TypeScript 7 from consumers until ecosystem compatibility is
  verified and documented.
- SHOULD use Effect as the default composition model for non-public command,
  migration, import/export, worker, server, resource-lifecycle, concurrency,
  retry, and typed-failure workflows.
- MAY keep small synchronous transforms and performance-sensitive code as plain
  TypeScript when Effect would add no semantic value.
- MUST adapt internal Effect programs to ordinary TypeScript values, promises,
  and domain errors at public boundaries.
- MUST NOT leak Effect types through the facade API.
- MUST NOT encode Effect runtime values in persisted documents or plugin state.
- MUST NOT put Effect in renderer hot paths.
- SHOULD use Zod for public document validation unless a better schema layer is
  explicitly chosen and documented.
- SHOULD use Zustand, TanStack Query, Three.js, R3F, Drei, three-mesh-bvh,
  xeokit, web-ifc, workers, WASM, or Rust only where the package boundary makes
  the dependency optional or intentional.

## Implementation Rules

- MUST inspect existing code and docs before changing behavior.
- MUST keep edits narrowly scoped.
- MUST avoid unrelated refactors while completing milestone verification.
- MUST preserve user changes and avoid destructive git operations.
- SHOULD add tests or verification scripts when changing shared behavior.
- SHOULD prefer boring, explicit APIs over clever abstractions until repeated
  complexity justifies the abstraction.

## Verification Rules

For TypeScript/package/API work, run:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
```

For editor command, transaction, selection, or history work, also run:

```sh
pnpm verify:editor-core
```

For documentation work, run:

```sh
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

For browser rendering work:

- MUST run the relevant app or example.
- MUST verify desktop and mobile viewports when layout, canvas sizing, or UI can
  change.
- MUST check that canvas output is non-blank.
- SHOULD run `pnpm verify:browser-rendering` when the vanilla web example is a
  relevant smoke target.
- SHOULD record known browser warnings separately from blocking failures.

For performance work:

- MUST define the workload.
- MUST measure before and after.
- MUST record object count, viewport, backend, browser, and device class.

## Documentation Rules

- MUST keep repository Markdown as the source of truth.
- MUST keep status in [Project Status](./project-status.md).
- MUST keep chronological evidence under [History](./history/README.md).
- MUST update [Documentation Index](./README.md) when adding durable docs.
- MUST add a history entry for durable rule, contract, boundary, or milestone
  changes.
- MUST NOT create duplicate status tables in history or plan documents.
- SHOULD update the narrowest stale document when docs conflict.

## Handoff Rules

At the end of a task, report:

- what changed;
- what was verified;
- what was not verified;
- where the source-of-truth documents are;
- the next recommended action.

## Forbidden Shortcuts

- MUST NOT mark a milestone complete without verification evidence.
- MUST NOT make core depend on framework adapters.
- MUST NOT couple saved documents to renderer objects.
- MUST NOT expose optional implementation libraries through the default facade.
- MUST NOT silently rewrite unresolved Obsidian links unrelated to repository
  docs.
- MUST NOT add large editor/runtime features while M0 contracts remain
  unverified unless the user explicitly asks for implementation.
