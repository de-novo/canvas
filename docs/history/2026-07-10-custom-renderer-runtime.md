# 2026-07-10 Custom Renderer Runtime

## Scope

Make a custom renderer adapter participate in the facade runtime path instead of
only appearing in resolved configuration metadata.

## Changes

- Added facade-specific renderer adapter and runtime types.
- Changed custom adapters to create the runtime used by `createCanvas`.
- Forwarded canvas getters, lifecycle methods, readiness, scene reads, and scene
  updates to the custom runtime.
- Exposed custom runtimes through `canvas.current` alongside built-in Canvas2D
  and Three.js runtimes.
- Enforced adapter mode support before initial creation and updates.
- Added runtime-shape validation with a clear error for asynchronous or invalid
  adapter return values.
- Changed the generic renderer adapter contract to return its runtime
  synchronously; asynchronous initialization belongs in `runtime.ready`.
- Updated the vanilla example to capability-check Three.js-specific `objects`
  access.
- Extended public API verification with type and runtime custom-adapter smoke
  tests.

## Verification

Passed:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
pnpm verify:document-schema
pnpm verify:browser-rendering
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

## Residual Risk

- Plugin-registered renderers are collected in the registry but are not yet
  selected by a resolved capability graph.
- A custom runtime must currently expose an `HTMLCanvasElement` and the standard
  web runtime lifecycle to participate in the facade.
- Existing adapters returning `Promise<runtime>` must migrate to an immediate
  runtime object whose `ready` property represents asynchronous initialization.

## Next Action

Reconcile the remaining M1 acceptance scope for camera controls, JSON/document
loading, and basic asset references before starting the M2 command core.
