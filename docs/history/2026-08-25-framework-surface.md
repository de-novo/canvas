# 2026-08-25 Framework surface design

## Date

2026-08-25

## Scope

Design only. How the product becomes a framework: kinds and properties
that humans and agents write, engines stay behind the facade. No schema
or runtime change.

## Changes

- Added [Framework Surface](../framework-surface.md).
- Locked the user-facing units as kind, properties, and named
  operations. `pluginState` plus a vendor renderer is not a kind.
- New kinds start as `plugin.denovo.*` on the next schema version, not
  as silent `0.2.0` literals. The first official hero kind is named
  `plugin.denovo.field`.
- Property grammar: JSON only, closed unions, no shader or engine
  objects on the default path. Backend is not a saved field.
- Implementation order is schema → official drawer → catalog. Catalog
  first is hosting.

## Verification

- `pnpm verify:docs`: passed on 2026-08-25 — 128 Markdown files,
  421/421 local targets.

## Residual risk

- Plugin nodes do not exist in `0.2.0`. Until the next schema version,
  a hero catalog cannot pass the absorption test without violating this
  design.
- Official field properties in the example (`pattern`, `speed`) are
  the shape, not a shipped renderer. They must not be implemented by
  wrapping ThreeUI.

## Next action

Implement the plugin-node union on the next schema version when that
slice is scheduled. Do not wrap ThreeUI rooms to simulate
`plugin.denovo.field`.
