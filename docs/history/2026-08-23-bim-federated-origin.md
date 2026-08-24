# 2026-08-23 BIM federated origin

## Date

2026-08-23

## Scope

Follow-up to
[multi-model federation](./2026-08-23-bim-multi-model-federation.md).
Two staged models both opened with `COORDINATE_TO_ORIGIN`, so a federation
drew on top of itself. Hosts could patch `node.position` after import, but
the camera frame ignored those positions and stayed on the overlapping
bounds.

## Design decision

Placement is a document transform, not baked vertices.

- `BimModelSource.origin` is an optional 3-tuple of finite numbers.
- Assemble writes that tuple onto every mesh `node.position` for the
  model. Geometry stays model-local (IFC `flatTransformation` already
  baked). Hosts can move a federated model with the existing transform
  tools.
- `frameCameraForMeshes` adds `node.position` when computing bounds, so
  a placed copy widens the initial camera.
- Non-finite or non-3-tuple origins fail explicitly before WASM open.

Omitted origin stays `[0, 0, 0]`. No rotation or scale in this slice.

## Changes

- `packages/bim/src/index.ts`: `BimModelOrigin`; optional `origin` on
  source and metadata.
- `packages/bim/src/web-ifc-parse.ts`: `resolveModelOrigin`, assemble
  writes `node.position`, camera framing includes the node translation.
- Both adapters validate origin on `loadModel` and pass it through
  staging. Worker parse protocol is unchanged — placement is assemble-time.

## Verification

- `pnpm verify:bim-worker`: 7 named checks. New
  `bim-worker-federated-origin-offsets-nodes-and-camera` — `NaN` origin
  is rejected; `beta` at `[40, 0, 0]` keeps `alpha` at the origin; every
  beta node carries that position; camera `target.x` is greater than the
  single-model frame. If framing ignored `node.position` the target would
  stay put (overlapping geometry).
- `pnpm typecheck`: 32 tasks.
- `pnpm build`: 21 packages/apps.
- `pnpm verify:public-api`: bim-smoke accepts a 3-tuple origin and
  rejects a 2-tuple.

## Residual risk

- Origin is translation only. A host that needs a survey-grid rotation
  still applies it after import.
- Category layers stay shared across models.

## Next action

WebGPU adapter and a pinned-environment frame-budget gate remain
deferred. Category isolation stays a host filter on
`metadata.__bim.modelId` until a filter-UI contract exists.
