# 2026-08-24 BIM federation browser QA

## Date

2026-08-24

## Scope

Close the leftover from
[federated origin](./2026-08-23-bim-federated-origin.md): worker-suite
placement was proven, but the playground still loaded one model and no
browser check clicked federation.

## Changes

- Playground BIM: `Federate copy` loads the same `sample.ifc` again as
  `copy` at `origin [40, 0, 0]`, remounts one merged document, and
  publishes `#model-count[data-bim-models]` plus
  `window.__bimFederation`.
- `pnpm verify:bim-federation` drives that control in Chromium and
  writes `artifacts/verification/bim-federation.png`.

## Verification

- `pnpm verify:bim-federation`: 1 named check —
  `bim-federation-browser-places-offset-copy`. After ready, click
  Federate copy → status `federated`, `data-bim-models="2"`,
  `sample:115@[0,0,0]` + `copy:115@[40,0,0]`, unique ids, camera
  `target.x` 8.219 → 28.219. Screenshot shows two houses side by side,
  Models 2, Elements 230.
- `pnpm verify:bim-rendering`: still green (76 colors, resize, no
  errors). Single-model first paint is unchanged.

If framing ignored `node.position`, `target.x` would stay 8.219 and the
check would fail.

## Residual risk

- The playground federates two copies of one file. Two different IFCs
  are still a host concern.
- Rotation/scale placement is still omitted.

## Next action

WebGPU adapter and a pinned-environment frame-budget gate remain
deferred.
