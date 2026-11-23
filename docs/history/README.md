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
- [2026-08-24 Named operations stackBox](./2026-08-24-named-operations-stack-box.md)
- [2026-08-24 Named operations listNodes](./2026-08-24-named-operations-list-nodes.md)
- [2026-08-24 Contributor governance](./2026-08-24-contributor-governance.md)
- [2026-08-24 ThreeUI Community playground](./2026-08-24-threeui-community-playground.md)
- [2026-08-24 Warp Field as a Denovo document host](./2026-08-24-warp-field-denovo-host.md)
- [2026-08-25 Product identity](./2026-08-25-product-identity.md)
- [2026-08-25 Absorbed flow showcase](./2026-08-25-flow-showcase.md)
- [2026-08-25 Framework surface](./2026-08-25-framework-surface.md)
- [2026-08-25 3D plugin nodes](./2026-08-25-plugin-nodes.md)
- [2026-08-25 Official denovo field](./2026-08-25-denovo-field.md)
- [2026-08-25 Absorbed field showcase](./2026-08-25-field-showcase.md)
- [2026-08-25 Absorbed network showcase](./2026-08-25-network-showcase.md)
- [2026-08-25 HTML overlay follows zoom](./2026-08-25-html-overlay-zoom.md)
- [2026-08-25 HTML overlay culls by bounds](./2026-08-25-html-overlay-cull.md)
- [2026-08-25 Network layout routing](./2026-08-25-network-layout-routing.md)
- [2026-08-25 2D plugin nodes](./2026-08-25-plugin-nodes-2d.md)
- [2026-08-25 Plugin kinds in both modes](./2026-08-25-plugin-nodes-both-modes.md)
- [2026-08-25 Named operations node flags](./2026-08-25-named-operations-node-flags.md)
- [2026-08-25 Named operations setLayerLocked](./2026-08-25-named-operations-set-layer-locked.md)
- [2026-08-25 Named operations listLayers](./2026-08-25-named-operations-list-layers.md)
- [2026-08-25 Named operations removeNode](./2026-08-25-named-operations-remove-node.md)
- [2026-08-25 Named operations removeEdge](./2026-08-25-named-operations-remove-edge.md)
- [2026-08-25 Named operations removeLayer](./2026-08-25-named-operations-remove-layer.md)
- [2026-08-25 Named operations addLayer](./2026-08-25-named-operations-add-layer.md)
- [2026-08-25 Named operations reorderLayer](./2026-08-25-named-operations-reorder-layer.md)
- [2026-08-25 Official denovo sparkline](./2026-08-25-denovo-sparkline.md)
- [2026-08-25 Named operations setLayerName](./2026-08-25-named-operations-set-layer-name.md)
- [2026-08-25 Named operations setNodeLayer](./2026-08-25-named-operations-set-node-layer.md)
- [2026-08-25 Named operations setText](./2026-08-25-named-operations-set-text.md)
- [2026-08-25 Vanilla layer named ops](./2026-08-25-vanilla-layer-named-ops.md)
- [2026-08-26 Named operations listLabels](./2026-08-26-named-operations-list-labels.md)
- [2026-08-26 Named operations setAnnotationText](./2026-08-26-named-operations-set-annotation-text.md)
- [2026-08-26 WebGPU capability detect](./2026-08-26-webgpu-capability-detect.md)
- [2026-08-26 WebGPU mesh and instance surface points](./2026-08-26-webgpu-mesh-instances-surface.md)
- [2026-08-26 WebGPU auto 3D](./2026-08-26-webgpu-auto-3d.md)
- [2026-08-27 WebGPU 2D](./2026-08-27-webgpu-2d.md)
- [2026-08-28 WebGPU field compute](./2026-08-28-webgpu-compute-field.md)
- [2026-08-28 WebGPU field compute stays resident](./2026-08-28-webgpu-compute-resident.md)
- [2026-08-28 vgpu catalog as documents](./2026-08-28-vgpu-catalog.md)
- [2026-08-25 Explicit WebGPU 3D](./2026-08-25-webgpu-explicit-3d.md)
- [2026-08-25 WebGPU section plane](./2026-08-25-webgpu-section-plane.md)
- [2026-09-02 Canvas UI reference](./2026-09-02-canvas-ui-reference.md)
- [2026-09-04 Extension surface decision](./2026-09-04-extension-surface-decision.md)
- [2026-09-06 Kind drawer seam and kind enumeration](./2026-09-06-kind-drawer-seam.md)
- [2026-09-06 Kind colocation, named-operation catalog, and 2D WebGPU host drawers](./2026-09-06-kind-catalog-webgpu-drawer.md)
- [2026-09-06 Region/mask document and host-drawer pixels](./2026-09-06-region-mask-and-host-drawer-pixels.md)
- [2026-09-06 Host mask rasterization, 2D WebGPU readback, frame budget](./2026-09-06-host-mask-webgpu-readback-frame-budget.md)
- [2026-09-06 GPU 16 ms frame budget](./2026-09-06-gpu-frame-budget-gate.md)
- [2026-09-07 Status hygiene and 3D WebGPU 16 ms](./2026-09-07-status-hygiene-webgpu-frame-budget.md)
- [2026-09-07 Next playground region/mask host](./2026-09-07-playground-region-mask-host.md)
- [2026-11-20 mask editing controls](./2026-11-20-mask-editing-controls.md)
- [2026-11-21 release board card editing](./2026-11-21-release-board-editing.md)
- [2026-11-21 2D spatial index and viewport culling](./2026-11-21-2d-spatial-index-viewport-culling.md)
- [2026-11-21 TanStack-style fine-grained selector subscriptions](./2026-11-21-selector-subscriptions.md)
- [2026-11-21 2D WebGPU GPU-resident caching and spatial viewport culling](./2026-11-21-2d-webgpu-resident-caching.md)
- [2026-11-21 2D high-frequency input rAF render coalescing](./2026-11-21-2d-raf-render-coalescing.md)
- [2026-11-21 3D sphere instancing batching and per-runtime resource cache](./2026-11-21-3d-sphere-batching-and-resource-cache.md)
- [2026-11-21 2D minimap cache, HTML overlay diffing, and fast 3D node equality](./2026-11-21-minimap-cache-html-diff-3d-eq.md)
- [2026-11-21 Lightweight @denovo/canvas/2d entrypoint](./2026-11-21-2d-lightweight-entrypoint.md)
- [2026-11-21 Three.js-free @denovo/react-canvas/2d and @denovo/canvas/react/2d entrypoints](./2026-11-21-react-2d-entrypoint.md)
- [2026-11-21 GitHub Actions CI workflow](./2026-11-21-github-actions-ci.md)
- [2026-11-23 Open-source release prep: pack smoke verifier, package metadata, and README](./2026-11-23-open-source-pack-and-readme.md)
- [2026-11-23 Open-source distribution compliance: LICENSE/NOTICE tarballs, issue templates, changelog, and release workflow](./2026-11-23-open-source-distribution-compliance.md)
