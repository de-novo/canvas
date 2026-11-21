# 3D sphere instancing batching and per-runtime resource cache

Issue: [#6](https://github.com/de-novo/canvas/issues/6).

## Summary

1. **Per-runtime 3D resource cache (`packages/web/src/3d.ts`)**: replaced the
   module-global `unitBoxGeometry` and `cachedSurfaceMaterials` singletons with
   a per-runtime `Canvas3DResourceCache` (`getUnitBoxGeometry`,
   `getUnitSphereGeometry`, `getSurfaceMaterial`, `dispose`) created per
   `createCanvas3D()` instance and disposed inside the owning context right
   before `renderer.dispose()` on `destroy()`. This eliminates cross-context
   `WebGL: INVALID_OPERATION: delete / deleteVertexArray: object does not belong
   to this context` warnings across 3D→2D→3D renderer replacements.
2. **Sphere draw-call batching (`packages/web/src/3d.ts`)**: extended
   `render.batch: true` so visible top-level (`parentId === null`) `sphere`
   nodes (when `render.lod.enabled` is off) collapse into one `InstancedMesh`
   per color using the shared BVH-indexed unit sphere geometry scaled by
   `[scale.x * radius, scale.y * radius, scale.z * radius]`, preserving
   `INSTANCE_NODE_IDS_USER_DATA_KEY` picking back to document node IDs. Also
   ensured hidden top-level boxes/spheres are skipped from batched meshes.
3. **Performance gate (`scripts/verify-performance.mjs`)**: added a
   `1k-spheres` mixed-radius workload to `pnpm verify:performance` under the
   same `drawCalls=1` batching gate.

No public API types or document schemas changed.

## Verification

- `pnpm verify:performance`: passed (`drawCalls=1`, `geometries=1` across all
  4 WebGL2 workloads: `100-boxes` 8.30 ms, `1k-boxes` 8.30 ms, `10k-boxes`
  8.30 ms, and `1k-spheres` 8.30 ms p50; WebGPU `1k-boxes` 8.30 ms p50;
  both 16 ms GPU gates passed on ANGLE Metal)
- `pnpm verify:browser-rendering`: passed (`ok: true`, desktop mouse & mobile
  touch 2D/3D authoring, transforms, handles, surface stacking, 3D→2D→3D
  replacement, and demand rendering — zero blocking WebGL console warnings)
- `pnpm verify:webgpu`: passed (11/11, desktop & mobile `drawn`)
- `pnpm verify:hit-testing`: passed (7/7)
- `pnpm verify:public-api`: passed
- `pnpm typecheck`: passed (25 packages)
- `pnpm build`: passed (25/25)
- `pnpm verify:docs`: passed

## Unmeasured Scope

- Linux, Windows, and physical mobile device 3D frame timings remain unmeasured.
