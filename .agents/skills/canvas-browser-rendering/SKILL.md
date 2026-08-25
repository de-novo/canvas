---
name: canvas-browser-rendering
description: Verify Denovo Canvas browser-visible rendering, canvas sizing, pointer or touch interaction, renderer replacement, overlays, or camera behavior. Do not use for type-only, document-only, or server-only changes with no browser effect.
---

# Canvas Browser Rendering

Read the rendering section of
[Contributor Rules](../../../docs/contributor-rules.md),
[Project Status](../../../docs/project-status.md), and the contract for the
changed vanilla, adapter, diagram, or BIM surface.

Identify the exact candidate code, app, renderer backend, interaction, desktop
and mobile viewports, and observable marker before running a browser. Use a
surface-specific state or pixel condition; do not infer success from generic
page text or the mere presence of a canvas.

Use the matching repository verifier:

- `pnpm verify:browser-rendering` for the vanilla facade and authoring surface;
- `pnpm verify:browser-rendering-adapters` for framework adapters;
- `pnpm verify:diagram-rendering` for diagram behavior;
- `pnpm verify:flow-showcase` for the absorbed release-board catalog case;
- `pnpm verify:field-showcase` for the absorbed Warp Field catalog case;
- `pnpm verify:network-showcase` for the absorbed service-map catalog case;
- `pnpm verify:bim-rendering` or a narrower BIM verifier for BIM behavior.

Check non-blank output, relevant pointer or touch behavior, resize or renderer
replacement when affected, page errors, and cleanup. Retain the screenshot or
pixel evidence required by the verifier. Stop background servers before
finishing.

Report the exact verifier, viewport and backend scope, observable before/after
state, available counts, screenshot path, warnings, and unmeasured devices or
interactions. Do not describe a browser surface as verified from typecheck or
unit evidence alone.
