# 2026-07-10 Browser Rendering Stability

## Date

2026-07-10.

## Scope

Verified M0 browser rendering stability for the vanilla facade example.
The ResizeObserver loop was reproduced in the Vite dev client output while the
vanilla example was running.

## Changes

- Coalesced `ResizeObserver` resize work through `requestAnimationFrame`.
- Cancelled pending resize work during runtime destruction.
- Avoided repeated canvas and renderer size writes when the measured size did
  not change.
- Added `pnpm verify:browser-rendering`.
- Added Playwright verification for:
  - desktop viewport;
  - mobile viewport;
  - initial 3D render;
  - 2D scene swap;
  - viewport resize;
  - non-blank canvas screenshot pixels;
  - ResizeObserver loop messages;
  - page errors and blocking browser console errors.
- Updated agent and M0 docs to reference the browser rendering verifier.
- Marked M0 Product Contract as verified in the project status index.

## Reproduction

The vanilla Vite dev server reported repeated client errors:

```text
ResizeObserver loop completed with undelivered notifications.
```

The loop was emitted through Vite's client error overlay path while the canvas
runtime was resizing from `ResizeObserver` delivery.

## Verification

Passed:

```sh
pnpm typecheck
pnpm build
pnpm verify:browser-rendering
pnpm verify:document-schema
pnpm verify:public-api
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

## Residual Risk

- The runtime now avoids the reproduced ResizeObserver loop source by scheduling
  observer-triggered resize work outside the observer delivery phase, and the
  verifier fails on future ResizeObserver loop messages.
- Playwright screenshot capture can produce browser GPU `ReadPixels`
  performance warnings. The verifier ignores those test-induced warnings but
  still fails on ResizeObserver messages, page errors, and non-ignored console
  errors.
- The vanilla production bundle still emits Vite's large chunk warning.

## Next Action

Define M1 around command dispatch, mutation application, history, and
undo/redo foundations before building editor UI.
