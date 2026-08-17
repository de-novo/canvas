# 2026-07-11 3D Depth Cues

## Scope

Correct the demand-mode 3D fixture that rendered successfully but appeared like
an irregular flat polygon instead of a clearly readable cube, then verify the
change with real desktop pointer and mobile touch input.

## Root Cause

The camera direction and the cube's rotation were nearly aligned. That made the
front face dominate the projection and hid most of the top and side faces. High
ambient light, a single broad key light, and the absence of a ground reference
further reduced the depth cues.

## Changes

- Moved the fixture camera to a deliberate three-quarter view and aimed it
  slightly below the cube center.
- Reduced ambient light, strengthened the key light, and added a cool opposing
  fill light so adjacent faces remain distinct without crushing the shadowed
  side.
- Made the standard box material rougher and less metallic for a clearer matte
  response.
- Added a low pedestal as a scale, orientation, and contact reference. The
  pedestal is an ordinary selectable document node, and browser verification
  now asserts hits for both `static-box` and `static-pedestal`.
- Styled the textual selection readout as an amber status pill. A mesh outline
  was intentionally not added because behavioral selection visuals remain M3
  work.
- Kept the renderer, raycasting, and pointer hot paths as imperative TypeScript;
  no Effect type crosses a public boundary.

## Visual Evidence

- [Original desktop capture](../../artifacts/verification/desktop-3d-static-box-selected.png)
- [Polished desktop canvas](../../artifacts/verification/desktop-3d-cube-polished-canvas.png)
- [Polished desktop interaction](../../artifacts/verification/desktop-3d-static-box-selected-polished.png)
- [Polished mobile touch interaction](../../artifacts/verification/mobile-touch-3d-static-box-selected-polished.png)

The new captures show visible top, left, and right faces, a grounded silhouette,
and successful selection feedback at both viewport classes.

## Verification

Passed on 2026-07-11:

```sh
pnpm typecheck
pnpm build
pnpm verify:document-schema
pnpm verify:editor-core
pnpm verify:hit-testing
pnpm verify:public-api
pnpm verify:browser-rendering
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

The browser verifier retained resize, demand-loop, orbit, pan, zoom, console,
and page-error checks while adding actual hit selection of the pedestal on both
desktop and mobile runs.

## Residual Risk

- Automated browser checks detect non-blank rendering, color variation, and
  interaction regressions, but they do not yet enforce a golden composition or
  perceptual similarity threshold. The listed captures were therefore also
  inspected directly.
- A rendered selection outline or other in-canvas selection treatment remains
  intentionally deferred to M3.

## Next Action

Continue the active M2 slice by connecting `CanvasPlugin.setup` command and tool
registrations to editor registries through the facade lifecycle.
