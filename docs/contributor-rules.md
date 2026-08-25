# Contributor Rules

This document defines enforceable repository rules for human and automated
contributors. It complements the
[Contributor Operating Policy](./contributor-operating-policy.md), which owns
workflow, status, documentation, verification, decisions, history, and handoff.

## Rule Levels

- `MUST`: required for an acceptable contribution.
- `SHOULD`: the default unless repository evidence justifies another choice.
- `MAY`: allowed but not required.

## Startup And Scope Rules

- MUST read [Contributing](../CONTRIBUTING.md) before non-trivial work.
- MUST identify the active phase and relevant acceptance criteria from
  [Project Status](./project-status.md).
- MUST identify whether the change affects a public contract, package boundary,
  document schema, renderer backend, persistence format, dependency or license
  policy, security boundary, or documentation policy.
- MUST read the narrowest contract governing the affected surface.
- MUST keep a contribution to one coherent concern.
- SHOULD use the narrowest matching repository skill for automated public
  contract, editor-core, browser-rendering, or governance work.
- SHOULD prefer existing package, code, test, and document patterns over new
  structure.
- SHOULD avoid unrelated refactors, formatting churn, and generated-file noise.

## Product Invariants

- MUST treat the SDK as a general-purpose web ecosystem SDK, not a React-only
  or Next.js-only library.
- MUST keep vanilla web usage first-class.
- MUST keep React, Next.js, R3F, Vue, Svelte, Solid, Astro, BIM, diagrams,
  workers, and server utilities as adapters or extensions around the core
  model.
- MUST treat the current library name as provisional.
- MUST preserve the stable contract through facade API shape, package
  boundaries, document schemas, renderer vocabulary, and verification policy.
- SHOULD make low-level 2D/3D engines easier to use without hiding escape
  hatches.
- MUST treat rendering, diagram, graph, and BIM libraries as engines, not
  as the product identity. See [Product Identity](./product-identity.md).
- MUST NOT present an upstream component, HTML host, or iframe as a
  Denovo case unless the document still redraws after that host is
  removed.
- SHOULD prefer catalog cases that stay on the facade rails and remain
  editable. Impressive hosting without a pickable document is not
  absorption.
- MUST keep the default user and agent path on kinds and JSON
  properties. Engine objects, shader source, and vendor hosts are not
  that path. See [Framework Surface](./framework-surface.md).

## Package Boundary Rules

- MUST keep `packages/core` framework-agnostic.
- MUST NOT add React, Next.js, DOM, R3F, Drei, xeokit, or web-ifc dependencies
  to core.
- MUST expose the default public SDK through the facade package first.
- SHOULD keep lower-level packages available as escape hatches.
- SHOULD add optional capability through explicit subpath entrypoints or
  adapters instead of broadening the default import.
- MUST update package boundary documentation and public API verification when
  exports change.
- MUST review license compatibility before adding or changing a dependency.

## Public API And Type Rules

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
- MUST use the documented namespace for plugin-owned identifiers instead of a
  general `string`.
- MUST derive public types from the canonical schema or domain union when one
  exists instead of maintaining a broader handwritten shadow type.
- MUST add positive inference and negative `@ts-expect-error` consumer fixtures
  for changed public types and inspect generated declarations for broad-type
  leakage.
- MUST keep optional framework adapters optional.
- MUST run `pnpm typecheck`, `pnpm build`, and `pnpm verify:public-api` after a
  public type, facade, or export-map change.
- MUST record a history entry for public API changes.
- SHOULD validate facade names from package metadata instead of hardcoding the
  current package name in tests.

## Document Model Rules

- MUST keep saved documents renderer-independent and JSON serializable.
- MUST validate public document inputs with schemas.
- MUST reject invalid identity relationships such as duplicate node IDs.
- MUST reject built-in nodes whose dimension does not match scene `mode`.
- SHOULD design documents to survive renderer backend changes.
- SHOULD prefer explicit migrations over silent shape changes.
- MUST document migration policy before making a breaking persistence change.

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
- MUST NOT store renderer instances in persisted documents.
- SHOULD support local-first storage paths before collaboration protocols.
- SHOULD keep future sync compatible with deterministic commands or patches.
- MUST document any persistence format change that can affect saved user data.
- MUST provide an explicit migration, rollback, or incompatibility decision
  before merging a destructive format change.

## Rendering Rules

- MUST treat WebGPU as an explicit 3D built-in, not the current `auto`
  result or the only supported runtime.
- MUST keep WebGL2 and Canvas2D as the `auto` built-in backends.
- MUST NOT implement `auto` as resolving to WebGPU.
- MUST NOT silently substitute another backend for an explicit request. `auto`
  MAY resolve only to an implemented, compatible backend whose required
  capability is available; otherwise it MUST fail explicitly.
- MUST use capability detection for backend selection.
- MUST verify browser-facing rendering with Playwright or the repository browser
  verifier using screenshots or canvas pixel checks before marking rendering
  work complete.
- SHOULD also exercise changed playground interactions such as click, drag,
  overlay, and camera behavior with browser automation or an equivalent manual
  check, and retain a real-use screenshot as evidence.
- SHOULD use demand-based render loops for static scenes.
- SHOULD prefer instancing, direct buffer geometry, batching, LOD, frustum
  culling, chunk loading, and worker offload for large scenes.
- MUST keep renderer hot paths imperative and allocation-aware.

## Dependency Rules

- MUST use dependencies as engines, not as leaked product surface.
- MUST keep dependency choices documented in
  [Dependency Strategy](./dependency-strategy.md).
- MUST use TypeScript 7 as the repository development toolchain.
- MUST NOT require TypeScript 7 from consumers until compatibility is verified
  and documented.
- SHOULD use Effect as the default composition model for non-public command,
  migration, import/export, worker, server, resource lifecycle, concurrency,
  retry, and typed-failure workflows.
- MAY keep small synchronous transforms and performance-sensitive code as plain
  TypeScript when Effect adds no semantic value.
- MUST adapt internal Effect programs to ordinary TypeScript values, promises,
  and domain errors at public boundaries.
- MUST NOT leak Effect types through the facade API or persisted data.
- MUST NOT encode Effect runtime values in persisted documents or plugin state.
- MUST NOT put Effect in renderer hot paths.
- SHOULD use Zod for public document validation unless another schema layer is
  explicitly chosen and documented.
- SHOULD use Zustand, TanStack Query, Three.js, R3F, Drei, three-mesh-bvh,
  xeokit, web-ifc, workers, WASM, or Rust only where the package boundary makes
  the dependency optional or intentional.

## Implementation And Compatibility Rules

- MUST inspect existing code, tests, and documentation before changing
  behavior.
- MUST keep edits narrowly scoped and preserve unrelated contributor work.
- MUST add or update verification when changing shared behavior.
- MUST make unsupported capabilities and invalid inputs fail explicitly.
- MUST record compatibility and migration effects for public API, schema,
  persistence, backend, or package-boundary changes.
- SHOULD prefer boring, explicit APIs over abstractions justified only by
  hypothetical reuse.
- SHOULD preserve behavior and compatibility not named by the accepted scope.

## Verification Rules

- MUST run checks at the boundary affected by the change.
- MUST report exact commands and outcomes.
- MUST report check, assertion, package, task, viewport, or sample counts when
  the runner provides them.
- MUST distinguish directly measured results from derived estimates.
- MUST list skipped, unavailable, and out-of-scope checks as unmeasured.
- MUST NOT claim that runtime, browser, performance, persistence, or public API
  behavior passed when only a narrower check ran.
- SHOULD prove a new high-value guard can fail by exercising an invalid fixture
  or equivalent mutation, then restoring the valid state.

For TypeScript, package, or public API work, run:

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
pnpm verify:docs
```

For browser rendering work:

- MUST run the relevant app or example.
- MUST verify desktop and mobile when layout, canvas sizing, or interaction can
  change.
- MUST check that canvas output is non-blank.
- SHOULD run the matching repository browser verifier.
- SHOULD record known warnings separately from blocking failures.

For performance work:

- MUST define the workload and measurement environment.
- MUST measure before and after more than once.
- MUST report absolute and relative results.
- MUST identify synthetic workloads, proxies, and machine-dependent results.

## Documentation And Review Rules

- MUST keep repository Markdown as the source of truth.
- MUST keep canonical Markdown inside the repository and MUST NOT replace it
  with a symlink to an external vault.
- MAY use Obsidian or other knowledge-base tooling only for inspection and link
  audits.
- MUST keep status in [Project Status](./project-status.md).
- MUST keep chronological evidence under [History](./history/README.md).
- MUST update [Documentation Index](./README.md) when adding durable docs.
- MUST add history for durable rule, contract, boundary, or milestone changes.
- MUST NOT create duplicate status tables in history or planning documents.
- SHOULD update the narrowest stale document when documentation conflicts.
- MUST make each contribution reviewable as one coherent concern.
- MUST disclose public API, schema, persistence, backend, dependency, license,
  security, and migration effects in the review summary.
- MUST include verification results and unmeasured scope in the review summary.
- MUST keep `Current Phase`, `Active`, `Next`, and `Evidence` internally
  consistent whenever project status changes.
- MUST refresh project-status dates and evidence counts from actual verifier
  output rather than copying old claims.

## Forbidden Shortcuts

- MUST NOT mark a milestone complete without acceptance evidence.
- MUST NOT make core depend on framework adapters.
- MUST NOT couple saved documents to renderer objects.
- MUST NOT expose optional implementation libraries through the default facade.
- MUST NOT silently rewrite unrelated external or Obsidian-only links.
- MUST NOT publish or deploy as the first test of a destructive data path.
- MUST NOT add a large runtime feature while its contract remains undecided.
