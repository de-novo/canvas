# Product Identity

Denovo is a facade that restates the impressiveness of open-source engines
as our documents and commands.

Three.js, Canvas2D, diagram hosts, graph layouts, and BIM parsers are
engines. They are not the product. The product is the document, the
commands, and the view that those documents draw.

This document is the identity source of truth. The user-facing framework
layer — kinds, properties, operations — is
[Framework Surface](./framework-surface.md). Package contracts stay in
[M0](./m0-product-contract.md). Expression targets and milestones stay in
[Vision and Milestones](./vision-and-milestones.md). Current phase stays in
[Project Status](./project-status.md).

## Why People Adopt

People do not buy an efficient internal model. They adopt a framework
when staying inside its rails produces a result they can show.

Adoption looks like:

- simple enough that a human or an AI can stay on the rails and get a
  strong UI;
- a hero graphic that a product can put on a landing page;
- diagrams and graphs that are near-mandatory in products and in
  back-office analysis;
- efficiency, expressiveness, and optimization after the result is
  visible.

Do not assume users or agents will compose the library in the most
efficient way. The default path inside the spec must be the best-looking
path.

A catalog of those cases is the product, not an appendix. More cases
expressed in our source raise usage. Cases that only run the upstream
source raise the upstream's usage.

## View And Edit

View is not decoration. If the document does not draw, it cannot be
selected, stacked, hidden, saved, or trusted. No view means no edit.

The required view is our document on screen: nodes that pick, commands
that change them, and a renderer that follows the document. A hosted
foreign page can look impressive and still have nothing to edit.

## Absorption Test

An open-source room is absorbed when all of the following are true:

1. The scene is sayable as our document and commands.
2. The view is drawn from that document.
3. Deleting the upstream component, HTML host, or iframe still leaves a
   document that redraws the same result.

If the room must remain for the pixels to exist, we are hosting, not
absorbing. Empty `nodes` plus `pluginState` plus the original renderer
fails this test.

Engines may stay behind the facade. Their scene graphs, HTML pages,
component trees, and product catalogs must not become our identity.

## What We Are Not

- a React-only or Next.js-only library;
- a pretty-Three catalog that wraps other teams' rooms;
- a second product called "diagrams" or "BIM";
- a decorative-universe renderer in the Obsidian-plugin sense.

The 2026-08-22 graph-field boundary still holds: glow, planetary classes,
and star-field skins stay host-owned. That boundary does not forbid a
strong diagram or graph case drawn from our vocabulary. It forbids
shipping someone else's skin as the SDK.

## What "Better" Means

A case is worth showing when it is impressive **and** efficient,
expressible, and optimized:

- **impressive** — a hero, diagram, or graph someone would put in a real
  product;
- **efficient** — the user-facing code stays on the facade rails;
- **expressible** — the same document can view, edit, undo, and save;
- **optimized** — the same document stays measurable under load.

Impressive hosting without those three is a showroom. Those three without
a visible result will not be adopted.

## First Showcases

The first catalog we should be able to show from our source, not from a
vendor host:

1. a hero graphic a product would put above the fold;
2. a diagram or graph a product or back-office tool would actually keep.

`apps/playground-flow` is the first absorbed diagram case: a release
board of `html` cards, `edge`s, and `text` labels in one document.
`pnpm verify:flow-showcase` proves there is no iframe, a card hit-tests,
`setLayerVisible` hides labels, and undo restores them.

`apps/playground-field` is the first absorbed hero case: ThreeUI Warp
Field restated as one `plugin.denovo.field` node. `pnpm verify:field-showcase`
proves there is no iframe, the field hit-tests, `setFieldPattern`
changes `letters`/`streaks`, and undo restores the pattern.

`apps/playground-network` is the first absorbed graph case: a service
map of `html` cards, `edge`s, and `text` labels. `pnpm verify:network-showcase`
proves there is no iframe, the API hub hit-tests, relation layout
moves positions, and undo restores them.

None of these cases may require an upstream file to remain mounted.
`apps/playground-threeui` still vendors the original rooms as a visual
reference. That host is not this catalog. `apps/playground-graph` stays
the throughput bench, not the graph catalog.
