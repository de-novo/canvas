# 2026-08-24 Warp Field as a Denovo document host

## Date

2026-08-24

## Scope

First ThreeUI Community room driven by a Denovo document. Isolated to
`apps/playground-threeui`. Not a schema, facade export, or
named-operation change.

## Changes

- Warp Field knobs live in `pluginState["threeui.warp-field"]`.
- The host reads that document and calls the existing ThreeUI engine.
  The `createCanvas` custom-adapter layer was removed; it did not
  shrink the effect.
- No `warp-field` node type was added to `@denovo/canvas`.

## Verification

- `pnpm --filter @denovo/canvas-threeui-example typecheck` passed.
- `pnpm --filter @denovo/canvas-threeui-example build` passed. Warp Field
  host is a separate `WarpFieldCanvas` chunk.
- Browser on `127.0.0.1:5180`: Warp Field host
  `data-denovo-backend=custom`, `data-denovo-mode=3d`, canvas 1408×547
  (backing 2816×1094). Letter Storm remounts `variant=letters`. Woven
  Cloth stays an HTML iframe host.
- Screenshot: `artifacts/verification/warp-field-denovo.png`.

## Residual risk

- Plugin nodes are still not a public contract. This slice uses
  `pluginState` plus a host adapter, which is the current legal
  extension path.
- Other catalog rooms remain vendor HTML/React hosts.
- The engine file is still ThreeUI Community code. The document is the
  Denovo part. The GPU loop did not disappear.

## Next action

Port the next live-canvas room the same way: document fields first,
no extra facade wrapper unless it removes code.
