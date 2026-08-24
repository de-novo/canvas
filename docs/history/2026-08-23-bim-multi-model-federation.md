# 2026-08-23 BIM multi-model federation

## Date

2026-08-23

## Scope

B-item ③ of the recorded residual risks: both BIM adapters held a single
staged model. `loadModel` closed the previous WASM model, `expressID` was
the only public element key, and `toDocument()` could not assemble two
IFC files without id collisions.

## Design decision

The adapter itself is the federation. Hosts do not hold one adapter per
file.

- `loadModel` is additive. It does not close already-open models.
  `unloadModel(modelId)` drops one slot; `dispose` drops every slot.
- `toDocument()` returns one merged document. A single staged model keeps
  the existing unprefixed ids (`ifc-element-12`, `ifc-storey-12`). Two or
  more models qualify element and storey ids with `modelId`
  (`ifc-element-alpha-12`) so express ids cannot collide. Category layers
  stay shared.
- `expressID` stays model-scoped. The public key is
  `{ modelId, expressID }`. `BimElementMetadata.modelId` is required.
  `getElementProperties` takes `BimElementRef[]` and returns correlated
  `BimElementProperties[]`.
- Worker protocol: `denovo.bim.parseIfc` keeps a `Map` of open models;
  `denovo.bim.readPropertySets` requires `modelId`;
  `denovo.bim.closeModel` releases one WASM slot. Property results are an
  `entries` array, not a `Record` keyed by express id.

Origin placement landed the same day as a follow-up: see
[2026-08-23 BIM federated origin](./2026-08-23-bim-federated-origin.md).

## Changes

- `packages/bim/src/index.ts`: `BimElementRef`, `BimElementProperties`,
  required `modelId` on provenance, optional `unloadModel` / `listModels`
  / `getElementProperties` on `BimAdapter`.
- `packages/bim/src/web-ifc-parse.ts`: `allocateModelId`, explicit
  `expressID` on parsed elements, `assembleBimDocument` accepts a list of
  staged models and namespaces only when federated.
- `packages/bim/src/web-ifc-adapter.ts` and
  `packages/bim/src/worker-adapter.ts`: `Map` of staged models; additive
  load; per-model unload; model-scoped property reads.
- `packages/bim/src/web-ifc-worker.ts`: multi-model WASM staging and
  `denovo.bim.closeModel`.

## Verification

- `pnpm verify:bim-worker`: 6 named checks. Existing single-model path
  unchanged (115/115 elements on storey layers "Level 1", "Level 2").
  New check `bim-worker-federates-two-models-without-id-collision`: two
  copies of `sample.ifc` as `alpha` and `beta` produce 230 unique
  namespaced node ids, namespaced storey layers (`alpha / Level 1`),
  model-scoped property reads after the second load, and unprefixed ids
  again after `unloadModel("beta")`. Unknown unload fails explicitly.
- `pnpm typecheck`: 32 tasks.
- `pnpm build`: 21 packages/apps.
- `pnpm verify:public-api`: bim-smoke fixtures — required `modelId`,
  `BimElementRef` pairing, numeric `modelId` rejection.

## Residual risk

- Category layers remain shared across models; filter by
  `metadata.__bim.modelId` when a host needs per-model category isolation.
  Origin placement is in
  [2026-08-23 BIM federated origin](./2026-08-23-bim-federated-origin.md).
- `loadModel` used to replace. Callers that loaded twice expecting the
  first model to disappear must now `unloadModel` or `dispose` first.
- Property-set reading is still best-effort and WASM-schema dependent.

## Next action

B residual risks ①–③ are closed. Origin placement for federation landed
the same day. Remaining deferred work is unchanged: WebGPU adapter and a
pinned-environment frame-budget gate.
