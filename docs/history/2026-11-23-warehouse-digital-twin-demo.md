# Interactive Warehouse Digital Twin demo (2D floorplan + 3D 5,020 pallets & AGVs)

Issue: [#20](https://github.com/de-novo/canvas/issues/20).

## Summary

- Added interactive Warehouse Digital Twin demo
  (`apps/playground-field/warehouse.html`, `apps/playground-field/src/warehouse.ts`)
  mounted via one-line `createCanvas(stageEl, { editor })` with `render.batch: true`:
  - 3D Rack View: 20 aisles × 5 tiers × 50 stacked pallets (5,000 boxes) + 20
    moving AGVs across 6 distinct status colors rendered in **1 single drawCall**
    (`instanceColor`), live telemetry toggle (50 status flips + 20 AGV moves per
    tick), camera sweep, and click-to-inspect SKU / Aisle / Slot / Tier panel
    with instant status actions.
  - 2D Floorplan View: instant 3D ↔ 2D switch with top-down aisle labels,
    culled bin rendering, minimap, and live AGV dots.
- Added `warehouse/` to `scripts/build-pages-site.mjs`, multilingual hub
  `index.html`, and `scripts/verify-pages-site.mjs`.
- Switched `.github/workflows/pages.yml` trigger to `workflow_dispatch` so
  `main` pushes stay green until GitHub Pages is enabled in repository settings.

## Verification

- `pnpm --filter @de-novo/canvas-field-example typecheck`
- `pnpm verify:pages` (5/5 checks including `pages-warehouse-digital-twin-3d-and-2d`)
- `pnpm verify:docs`
- Ruby `YAML.safe_load` on all `.github/**/*.yml`
- `git diff --check`
