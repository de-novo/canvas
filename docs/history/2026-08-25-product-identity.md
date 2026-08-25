# 2026-08-25 Product identity

## Date

2026-08-25

## Scope

Record the product identity after the ThreeUI playground showed that
hosting an upstream room is not facade absorption. Documentation only.
No schema, facade export, or playground change.

## Changes

- Added [Product Identity](../product-identity.md) as the identity source
  of truth.
- Linked it from the documentation index, vision, contributor policy,
  contributor rules, developer experience, dependency strategy, root
  README, and project status.
- Restated the absorption test: the document must survive deletion of
  the upstream component, HTML host, or iframe.
- Kept the 2026-08-22 graph-field presentation boundary. Host-owned
  decorative skins stay out of the SDK. Showcase cases must still be
  drawn from our vocabulary.

This does not reopen fluent editor APIs, a public Effect surface, copying
ThreeUI Pro, or treating `apps/playground-threeui` as product proof.
Warp Field remains a document host with empty `nodes` and the original
engine; that fails the absorption test.

## Verification

- `pnpm verify:docs`: passed on 2026-08-25 — 125 Markdown files, 394/394
  local targets, 0 symlinks, 0 conflict markers, 4/4 contributor
  entrypoints, 4/4 repository skills, 5/5 project-status headings, 6/6
  pull-request headings.

## Residual risk

- Identity and the existing "editor engine first" milestone language can
  drift if later work treats the catalog as a second product.
- The first absorbed hero or diagram/graph case is not implemented. The
  engine can already view and edit boxes; it cannot yet show the
  adoption cases named in the identity document.
- `apps/playground-threeui` is still in the tree as a visual reference.
  Readers can mistake it for absorption unless status keeps the failure
  explicit.

## Next action

Documented. Implementation waits for a case that can pass the absorption
test inside current or contracted vocabulary. Do not wrap more upstream
rooms to simulate that catalog.
