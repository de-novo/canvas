# 2026-08-22 M7 worker parsing and section plane

## Date

2026-08-22

## Scope

M7 BIM slice: worker-based IFC parsing (the performance-critical open
deliverable), a renderer-level section plane capability, lazy property-set
reads, and adapter refactoring that gives the main-thread and worker paths
one shared tessellation core.

## Changes

### Worker-based parsing flow

- `packages/bim/src/web-ifc-parse.ts` (new): shared parse core
  (`parseIfcModel`) producing transferable typed arrays + element
  provenance, `readIfcPropertySets` (best-effort `IfcPropertySet` →
  `IfcRelDefinesByProperties` walk), and `assembleBimDocument`
  (category layers, `AssetRef` geometry, framed camera). Both adapters now
  run this one core.
- `packages/bim/src/web-ifc-worker.ts` (new):
  `createBimWorkerHandler({ wasm? })` installs the first-party tasks
  `denovo.bim.parseIfc` / `denovo.bim.readPropertySets`. The model stays
  staged in the worker; WASM is fetched inside the worker so tessellation
  never touches the main thread. Node runtimes may omit the WASM config.
- `packages/bim/src/worker-adapter.ts` (new):
  `createWorkerBimAdapter({ queue, maxElements })` — a `BimAdapter` over a
  `@denovo/canvas-worker` queue with `getSkippedElementCount()` and
  `getElementProperties(expressIDs)`.
- New export subpath `@denovo/canvas-bim/web-ifc-worker`;
  `@denovo/canvas-worker` is an optional peer.
- `WebIfcBimAdapter` was refactored onto the same core and gained
  `getElementProperties`; its public API is unchanged.

### Section plane

- `Canvas3DSectionPlaneInput` in web types; Three.js runtime gains
  `setSectionPlane({ normal, constant } | null)` using renderer-level
  clipping planes (normalized normal; explicit failures for zero normals
  and non-finite constants). Forwarded through the dynamic web runtime and
  the facade runtime; re-exported from `@denovo/canvas`.
- v1 semantics documented on the method: global cut (handles/overlays clip
  too while active), hit testing unaffected.

### Verification

- New `pnpm verify:bim-worker` (`scripts/verify-bim-worker.mjs`, 5 named
  checks): real web-ifc parse of `apps/playground-bim/public/sample.ifc`
  through a loopback queue — end-to-end document assembly with `__bim`
  provenance and resolvable store geometry, best-effort property reads,
  `maxElements` skip accounting, explicit non-IFC rejection.
- Browser section-plane proof via ego-browser on
  `apps/vanilla/section-bench.html`: non-background pixel ratio per half —
  base upper 0.0952 → sectioned upper **0** while lower stays 0.0622 →
  clear restores both exactly. Fixed three points initially landed between
  spaced boxes; the ratio-over-half metric replaced them.
  - Along the same investigation: the dynamic web runtime had no
    forwarding for the new optional method — added and covered by this
    browser check.

## Verification (commands)

- `pnpm typecheck`, `pnpm build`, `pnpm verify:public-api`: passed.
- `pnpm verify:bim-worker`: passed (5 checks).
- `pnpm verify:bim-rendering`: passed (Bim smoke unchanged by the adapter
  refactor).
- `pnpm verify:editor-core`, `verify:worker-tasks`,
  `verify:m4-performance`, `verify:document-schema`: passed after the
  worker `collectTransferables` array-walk extension.

## Residual risk

- Section planes clip authoring handles/overlays while active and do not
  affect hit testing (documented v1 semantics).
- Property-set reading depends on web-ifc schema constants and relation
  shapes; failures degrade to empty arrays by contract.
- Open M7 deliverables: an XKT/xeokit viewer adapter (descoped — xeokit is
  AGPL and core must stay license-clean) and measurement endpoints picked
  on BIM surfaces instead of the work plane.

## Next action

~~Decide whether the two remaining gaps are accepted as descopes and M7 is
marked verified.~~

**Decision (2026-08-22, same day):** both gaps were accepted as recorded
descopes:

- **XKT/xeokit viewer adapter** — xeokit-sdk is AGPL-3.0 and the core must
  stay license-clean (verified governance, 2026-08-17); a viewer adapter,
  if ever built, is a separate optional package outside M7's scope.
- **Surface-picked BIM measurements** — M3 distance/annotation measurements
  already work in 3D scenes over imported BIM meshes via standard hit
  testing; mesh-surface endpoint picking is a future contract extension of
  the M3.1 surface-placement vocabulary, not a blocker.

With these recorded, every M7 acceptance criterion holds: the package is
optional, core stays license-clean from AGPL dependencies, and IFC
workflows use the same selection/metadata concepts as the rest of the SDK.
**M7 is verified.**
