# 2026-07-10 Scene Dimension Contract

## Scope

Define and verify how scene `mode` constrains built-in node types.

## Decision

- `mode: "2d"` scenes accept only `rect` and `circle` built-in nodes.
- `mode: "3d"` scenes accept only `box`, `sphere`, and `instances` built-in
  nodes.
- An omitted mode retains the existing `3d` default.
- Mixed-dimensional composition requires a future explicit overlay, composite,
  or plugin contract rather than silently mixing nodes in one scene.

## Changes

- Split the public scene schema into 2D and 3D variants and combined them as a
  discriminated output union.
- Made `CanvasScene` and `CanvasSceneInput` preserve the relationship between
  scene mode and node types in TypeScript.
- Kept facade-generated configuration at a runtime schema boundary so dynamic
  mode overrides remain validated.
- Updated 2D and 3D renderer state assignments to retain their narrowed scene
  types after writing through the general scene store.
- Added fixtures rejecting 3D nodes in 2D scenes and 2D nodes in 3D scenes.

## Verification

Passed:

```sh
pnpm typecheck
pnpm build
pnpm verify:document-schema
pnpm verify:public-api
pnpm verify:browser-rendering
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

## Residual Risk

- Existing external documents that relied on mixed built-in node dimensions
  will now fail strict parsing and require an explicit migration or split.
- Plugin-defined node dimension metadata remains a future extension concern.

## Next Action

Resolve the remaining M1 runtime scope: custom renderer execution, camera
controls, JSON/document loading, and basic asset references.
