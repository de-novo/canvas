# History

This directory stores chronological evidence for durable project changes.

History entries are not the status source of truth. Current status lives in
[Project Status](../project-status.md). History entries explain what happened,
what was verified, and what remains risky.

## Entry Rules

Create an entry when:

- a milestone or verification item is completed;
- public API shape changes;
- package boundaries change;
- renderer/backend policy changes;
- documentation governance changes;
- significant bugs are discovered or fixed.

Use filenames like:

```text
YYYY-MM-DD-short-topic.md
```

Each entry should include:

- date;
- scope;
- changes;
- verification;
- residual risk;
- next action.

## Entries

- [2026-07-10 M0 public API contract](./2026-07-10-m0-public-api-contract.md)
- [2026-07-10 agent operating policy](./2026-07-10-agent-operating-policy.md)
- [2026-07-10 agent rules](./2026-07-10-agent-rules.md)
- [2026-07-10 browser rendering stability](./2026-07-10-browser-rendering-stability.md)
- [2026-07-10 document schema stability](./2026-07-10-document-schema-stability.md)
- [2026-07-10 internal Effect setup](./2026-07-10-internal-effect-setup.md)
- [2026-07-10 internal Effect and TypeScript 7 policy](./2026-07-10-effect-ts7-internal-policy.md)
- [2026-07-10 3D demand rendering](./2026-07-10-3d-demand-rendering.md)
- [2026-07-10 scene dimension contract](./2026-07-10-scene-dimension-contract.md)
- [2026-07-10 custom renderer runtime](./2026-07-10-custom-renderer-runtime.md)
- [2026-07-10 document JSON and asset references](./2026-07-10-document-json-runtime.md)
- [2026-07-10 M1 camera controls and milestone verification](./2026-07-10-camera-controls-m1.md)
- [2026-07-11 M2 editor core first verified slice](./2026-07-11-editor-core-first-slice.md)
- [2026-07-11 normalized hit testing and pointer selection](./2026-07-11-normalized-hit-selection.md)
- [2026-07-11 3D depth cues](./2026-07-11-3d-depth-cues.md)
- [2026-07-11 M2 editor core verification](./2026-07-11-m2-editor-core-verified.md)
- [2026-07-12 M3 normalized tool input and select-tool routing](./2026-07-12-m3-tool-routing-first-slice.md)
- [2026-07-14 M3 Navigation ownership and shadcn styling](./2026-07-14-m3-navigation-shadcn-styling.md)
- [2026-07-14 M3 transient Transform tool](./2026-07-14-m3-transform-tool.md)
- [2026-07-14 M3 transform axis/plane handles](./2026-07-14-m3-transform-handles.md)
- [2026-07-14 public type contract hardening](./2026-07-14-public-type-contract-hardening.md)
- [2026-07-15 public type safety agent rule](./2026-07-15-public-type-safety-agent-rule.md)
- [2026-07-15 M3 authoring contract implementation](./2026-07-15-m3-authoring-tools.md)
- [2026-07-16 M3 authoring tools verification](./2026-07-16-m3-authoring-verified.md)
- [2026-07-16 M3.1 surface placement and stacking verification](./2026-07-16-m3-1-surface-placement.md)
- [2026-07-17 editor modularization](./2026-07-17-editor-modularization-phase1.md)
- [2026-07-17 M4 Phase A measurement infrastructure](./2026-07-17-m4-phase-a-measurement.md)
- [2026-07-17 M4 Phase B geometry/material caching](./2026-07-17-m4-phase-b-caching.md)
- [2026-07-17 M4 Phase B draw-call batching](./2026-07-17-m4-phase-b-batching.md)
- [2026-07-19 M5 Vue adapter](./2026-07-19-m5-vue-adapter.md)
- [2026-07-20 M6 Phase A persistence data model](./2026-07-20-m6-phase-a-persistence-model.md)
- [2026-07-20 M6 Phase B editor persistence events](./2026-07-20-m6-phase-b-persistence-events.md)
- [2026-07-20 M6 Phase C filesystem adapter](./2026-07-20-m6-phase-c-filesystem-adapter.md)
- [2026-07-20 M6 Phase D facade storage wiring](./2026-07-20-m6-phase-d-facade-storage.md)
- [2026-07-21 dead render-config cleanup](./2026-07-21-dead-config-cleanup.md)
- [2026-07-21 M6 IndexedDB adapter](./2026-07-21-m6-indexed-db-adapter.md)
- [2026-07-21 M6 vanilla save demo](./2026-07-21-m6-vanilla-save-demo.md)
- [2026-07-21 adapter runtime verification](./2026-07-21-adapter-runtime-verification.md)
- [2026-07-21 dpr wiring](./2026-07-21-dpr-wiring-3d-renderer.md)
- [2026-07-21 M6 applyCommands and uploadAsset](./2026-07-21-m6-applycommands-uploadasset.md)
- [2026-07-21 M6 inverse-command serialization](./2026-07-21-m6-inverse-command-serialization.md)
- [2026-07-21 M6 TanStack Query hooks](./2026-07-21-m6-tanstack-query-hooks.md)
- [2026-07-22 Svelte and Solid adapters](./2026-07-22-svelte-solid-adapters.md)
- [2026-07-22 M7 web-ifc BIM](./2026-07-22-m7-web-ifc-bim.md)
- [2026-07-22 M8 diagram slice 1](./2026-07-22-m8-diagram-slice-1.md)
- [2026-07-26 M8 slice 3 connector and flyTo](./2026-07-26-m8-slice-3-connector-flyto.md)
- [2026-07-26 M8 slice 4 routing and selection](./2026-07-26-m8-slice-4-virt-routing-selection.md)
- [2026-07-26 M8 slice 5 Figma parity](./2026-07-26-m8-slice-5-figma-parity.md)
- [2026-07-26 M8 slice 6 edge ports](./2026-07-26-m8-slice-6-edge-ports.md)
- [2026-07-26 M8 slice 7 layout adapters](./2026-07-26-m8-slice-7-layout-adapters.md)
- [2026-07-28 verification honesty](./2026-07-28-verification-honesty.md)
- [2026-07-29 2D runtime split](./2026-07-29-2d-refactor.md)
- [2026-08-17 review hardening](./2026-08-17-review-hardening.md)
- [2026-08-17 M8 diagram contract and 0.2.0 freeze](./2026-08-17-m8-contract-0.2.0-freeze.md)
- [2026-08-17 M8 contract verification](./2026-08-17-m8-contract-verification.md)
- [2026-08-17 M8 in-browser connector gesture](./2026-08-17-m8-connector-browser.md)
- [2026-08-17 ego-browser html overlay](./2026-08-17-ego-browser-html-overlay.md)
- [2026-08-17 trackpad wheel boundary](./2026-08-17-trackpad-wheel-boundary.md)
- [2026-08-17 v1 persistence applyCommands](./2026-08-17-v1-persistence-applycommands.md)
- [2026-08-17 geometry store](./2026-08-17-geometry-store.md)
- [2026-08-17 WebGPU language](./2026-08-17-webgpu-language.md)
- [2026-08-17 open-source governance](./2026-08-17-open-source-governance.md)
- [2026-08-17 geometry blob persistence](./2026-08-17-geometry-blob-persistence.md)
- [2026-08-21 M3 suite and ghost material](./2026-08-21-m3-suite-ghost-material.md)
- [2026-08-22 adapter facade mount](./2026-08-22-adapter-facade-mount.md)
- [2026-08-22 M5, M6, and M8 milestone verification](./2026-08-22-m5-m6-m8-milestone-verification.md)
- [2026-08-22 M4 worker task queue and OffscreenCanvas capability](./2026-08-22-m4-worker-task-queue.md)
- [2026-08-22 M4 LOD controls, chunk loading, and batching gate](./2026-08-22-m4-lod-chunk-loading.md)
- [2026-08-22 M7 worker parsing and section plane](./2026-08-22-m7-worker-parsing-section-plane.md)
- [2026-08-22 next contract decision](./2026-08-22-next-contract-decision.md)
- [2026-08-22 mesh surface points](./2026-08-22-mesh-surface-points.md)
- [2026-08-22 BIM storey layers](./2026-08-22-bim-storey-layers.md)
- [2026-08-22 graph layout adapters](./2026-08-22-graph-layout-adapters.md)
- [2026-08-22 graph field host presentation](./2026-08-22-graph-field-host-presentation.md)
- [2026-08-23 BIM multi-model federation](./2026-08-23-bim-multi-model-federation.md)
- [2026-08-23 BIM federated origin](./2026-08-23-bim-federated-origin.md)
- [2026-08-24 BIM federation browser QA](./2026-08-24-bim-federation-browser.md)
- [2026-08-24 Named authoring operations](./2026-08-24-named-authoring-operations.md)
- [2026-08-24 Named operations setLayerVisible](./2026-08-24-named-operations-set-layer-visible.md)
