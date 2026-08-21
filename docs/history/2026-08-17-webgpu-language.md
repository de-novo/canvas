# WebGPU language: reserved vocabulary, not auto

**Date:** 2026-08-17
**Status:** landed (type/build/`verify:public-api` evidence in this change)

## Context

Docs still called the product WebGPU-first. The runtime already resolves
`auto` to Canvas2D or WebGL2 and throws `backend-unimplemented` for
`webgpu`. The type for a successful resolve still allowed `webgpu`.

## Changes

- Facade: `CanvasImplementedBackend`, `CanvasUnimplementedBackend`, and
  `CanvasResolvedBackend`. `ResolvedCanvasRenderer.resolved` is the last
  of those, so `webgpu` and `auto` cannot type a successful resolve.
- `auto` comments record that `capabilities.webgpu` is detection-only.
- Product docs, agent rules, and the backend strategy drop
  “WebGPU-first” as current posture. WebGPU stays reserved vocabulary and
  a future adapter milestone.

## Verification

Ran after the code change on 2026-08-17:

- `pnpm typecheck` — 30/30
- `pnpm build` — 20/20
- `pnpm verify:public-api` — ok, including `CanvasResolvedBackend`
  rejecting `webgpu` / `auto`

## Residual risk

- No WebGPU runtime was added. Explicit `webgpu` still fails.
- `navigator.gpu` remains a capability flag only.

## Next action

Open-source governance (LICENSE and related files) stays last, deferred
to public release.
