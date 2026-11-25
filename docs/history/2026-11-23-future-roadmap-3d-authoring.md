# Future roadmap recorded: glTF importer, 3D WebGPU batching, and long-term optional mesh-editing layer

## Summary

- Recorded the post-`v0.1` optional extension roadmap in
  `docs/vision-and-milestones.md` (`Future Roadmap (Post-v0.1 Optional Extensions)`):
  - Near-term: optional `@de-novo/canvas-gltf` (`.glb`/`.gltf` -> canonical
    `mesh` + `geometryAssetId`), 3D WebGPU `InstancedMesh` batching parity, and
    optional PBR texture/environment extensions.
  - Long-term horizon: optional Blender-inspired mesh-editing package
    (`@de-novo/canvas-mesh-edit` — sub-object vertex/edge/face selection,
    extrude/bevel/subdivide/sculpt, and parametric modifiers) layered strictly
    outside `@de-novo/canvas-core` and `@de-novo/canvas/2d` with `0 B` impact on
    2D/base consumers.

## Verification

- `pnpm verify:docs`: passed
- `git diff --check`: passed
