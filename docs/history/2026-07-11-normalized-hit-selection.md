# 2026-07-11 Normalized Hit Testing And Pointer Selection

## Scope

Implement and verify the second M2 vertical slice: renderer-normalized 2D/3D
hit testing, renderer-independent hit-to-selection behavior, and a browser input
bridge that works after 2D/3D runtime canvas replacement.

## Changes

- Added strict `CanvasHitTestInputSchema` and `CanvasHitResultSchema` contracts,
  parse helpers, selection modes, and discriminated result types. Node hits now
  require stable document IDs; empty/scene hits reject node IDs; instanced hits
  expose a non-negative integer `instanceIndex`.
- Defined hit input coordinates as canvas-local CSS pixels independent of device
  pixel ratio.
- Added Canvas2D reverse-draw-order picking with inverse translation, rotation,
  and scale for rectangles and circles.
- Added a reusable `@de-novo/canvas-three` Raycaster helper with nearest-hit,
  parent-to-document-ID resolution, camera matrix refresh, world hit points, and
  Three.js `instanceId` to public `instanceIndex` mapping.
- Added built-in runtime and facade `hitTest()` forwarding while preserving hit
  testing as an optional custom-renderer capability. Unsupported custom use maps
  to the ordinary `CanvasHitTestUnsupportedError` public domain error.
- Added DOM-free `CanvasEditor.selectFromHit()` and `hoverFromHit()` transitions
  with replace/add/toggle semantics, stale-node rejection, no-op suppression,
  serialized execution, and no history entries.
- Added `connectCanvasSelection()` for primary pointer sessions, pointer capture,
  mouse/touch movement thresholds, modifier toggling, coalesced hover, cancel and
  lost-capture cleanup, and error observation without moving DOM types into the
  editor package.
- Added facade `connectEditorToCanvas()` to combine document synchronization and
  input selection. The bridge listens on the stable canvas host and delegates to
  the current runtime, so dynamic 3D→2D→3D canvas replacement does not disconnect
  input.
- Updated the vanilla facade example to own its scene through an editor plugin
  command, expose accessible selection state, and demonstrate live selection.
- Kept raycasting, geometry checks, and pointer hot paths as imperative
  TypeScript. Effect remains behind editor command/validation and asynchronous
  workflow boundaries and does not appear in public declarations.

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

The browser verifier performs real desktop pointer and mobile touch input. It
checks scaled/rotated topmost Canvas2D selection, 2D and 3D misses, modifier
toggle, selection without undo history, 3D center picking, mode-switch listener
continuity, and touch/mouse orbit drag without accidental selection. It retains
the existing screenshot, resize, demand-loop, orbit, pan, zoom, console, and
page-error gates.

The headless Three.js verifier executes actual Raycaster intersections for
nearest hit, miss, camera changes, invalid coordinates/viewports, and both
indices of an `InstancedMesh` batch.

## Decisions

- Custom renderer `hitTest` remains optional to avoid breaking the verified M1
  lifecycle. High-level editing requires the capability and fails explicitly
  when it is absent.
- The web input bridge owns DOM pointer lifecycle; editor core owns only
  renderer-independent hit-to-selection semantics.
- Behavioral select/transform tools stay in M3. Persistence patch emission is a
  storage/synchronization concern tracked in M6, not an M2 completion gate.

## Residual Risk

- Canvas2D picking is linear in node count and does not yet use a spatial index.
- Three.js picking returns the nearest normalized hit only; multi-hit queries
  and renderer-specific filtering are future extensions.
- Snapshot history still scales with document size; patch-based storage/history
  optimization remains deferred until measured.
- `CanvasPlugin.setup` registrations still populate the facade registry only and
  are not installed into editor registries through an official lifecycle.

## Next Action

Connect `CanvasPlugin.setup` command and tool registrations to editor instances,
verify asynchronous setup and cleanup through the facade, then run the complete
M2 acceptance audit.
