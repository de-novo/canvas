# Framework Surface

This is the design for the layer users and agents write. Identity stays in
[Product Identity](./product-identity.md). Package and schema rules stay in
[M0](./m0-product-contract.md). This file decides how that identity becomes
a framework: sayable kinds and properties, not engine APIs.

It is a target contract, not a status table. Current completion stays in
[Project Status](./project-status.md).

## Aim

Denovo is a canvas framework. WebGL, WebGPU, Three.js, and Canvas2D are
engines behind it. A person or an AI should be able to read and write a
document without knowing which engine will draw it.

The default path is:

1. name a kind (`box`, `edge`, `html`, `plugin.denovo.field`,
   `plugin.denovo.sparkline`);
2. set closed properties;
3. change it with named operations or commands;
4. see, pick, hide, undo, and save the same JSON.

If the user must supply a shader, a `Scene`, a component, or an HTML
page, they are using the engine. That path is an escape hatch, not the
framework.

## User-Facing Units

The framework has three user-facing units. All are JSON.

| Unit | What it is | Who writes it |
| --- | --- | --- |
| Kind | `node.type` — a closed name | human or AI |
| Properties | fields on that kind | human or AI |
| Operation | named helper or command | human or AI |

The runtime has units the user does not write: backend, GPU program,
engine object, animation loop. Those stay off the facade.

`pluginState` is host bookkeeping. It is not a kind. A bag of knobs plus
someone else's renderer is not this surface. See the absorption test in
[Product Identity](./product-identity.md).

## Kind Tiers

### Built-in

Frozen in schema `0.2.0`: `rect`, `circle`, `box`, `sphere`, `instances`,
`mesh`, `group`, `measurement`, `annotation`, `edge`, `text`, `html`.

Do not append new built-in kinds to `0.2.0`. That freeze stands.

### Official plugin kinds

New framework kinds start as namespaced plugin nodes, not as silent
core literals.

```text
type: "plugin.denovo.<kind>"
```

The first official hero kind is `plugin.denovo.field`. It is a node on
a layer, so it can be selected, hidden, undone, and saved. It is not a
full-page host and not an empty scene.

Official kinds ship with:

- a Zod schema for their properties;
- an official renderer that reads only those properties;
- a catalog document that uses only the facade.

They graduate to a built-in literal only on a later schema version, when
the kind is as common as `box`.

### Host plugin kinds

Hosts may register `plugin.<org>.<kind>` with the same rules. The
namespace is required. A general `string` type is not a kind.

## Property Grammar

These rules are for every public kind, built-in or plugin.

- Properties are JSON. No functions, class instances, engine objects, or
  DOM nodes.
- Discriminators are literals or template-literal namespaces, not open
  strings.
- Enums are closed unions (`"streaks" | "letters"`, not `string`).
- Numbers are finite. Ranges belong in the schema (`speed` 0–40), not in
  prose only.
- Colors stay hex (or a later closed token union). No CSS expression
  language in v1 of this surface.
- Shader source, raw GLSL, and engine material objects are not default
  properties. A future escape-hatch kind must be named and documented
  separately.
- `id`, `layerId`, `visible`, `locked`, `parentId` stay the shared
  node shell. Kind-specific fields do not repeat them.

A human and an AI should be able to complete a node from the schema
alone. If the schema needs a comment to be usable, the properties are
too wide.

## Backend

The document describes what the scene is. It does not name WebGL or
WebGPU.

Allowed on the document today: `mode`, `render.loop`, `render.dpr`,
camera, lights that already exist as schema. Those are scene intent.

Forbidden on the document: `backend`, `renderer: "three"`, WebGPU
feature flags, engine revision pins.

`auto` remains the default runtime choice. An explicit backend is a
host config, not a saved property. The same JSON must draw after the
backend changes.

## How A Kind Is Drawn

Each kind has one official drawer inside the SDK or the official plugin
package.

```text
document node  →  kind schema  →  official drawer  →  engine
```

The drawer may use Three.js or Canvas2D. The catalog and the public
types must not import those engines.

Absorption for a new kind:

1. The example document names only kinds and properties.
2. The official drawer is our source.
3. Deleting any vendor file still redraws that document.

## Example — Hero Field As Properties

This is the shipped official kind. No Three types appear.

```ts
import { createCanvas, defineDocument } from "@denovo/canvas";

const document = defineDocument({
  id: "landing-hero",
  scene: {
    id: "landing-hero-scene",
    mode: "3d",
    layers: [{ id: "hero", name: "Hero" }],
    nodes: [
      {
        id: "field",
        layerId: "hero",
        type: "plugin.denovo.field",
        props: {
          brightness: 1,
          density: 0.6,
          hue: 0,
          pattern: "streaks",
          speed: 15
        }
      }
    ]
  }
});

createCanvas("#stage", { document });
```

The sayable mutation compiles to `node.update`:

```ts
editor.apply([
  setFieldPattern({ nodeId: "field", pattern: "letters" })
]);
```

The helper compiles to `node.update`. It does not accept a material.

## Example — What The User Does Not Write

These are out of the framework path, even if an escape hatch exists
later:

```ts
// not the framework
createWarpFieldRenderer(el, { variant: "streaks" });
document.pluginState["threeui.warp-field"] = { speed: 15 };
<iframe srcDoc={html} />
```

## Mutations And Reads

Humans and agents share one language.

- Read: `listNodes(document)` and the document JSON.
- Write: `apply([namedOp, ...])` or a validated command.
- No fluent `editor.field().speed(15)`.
- No parallel agent protocol. The document is the protocol.

New named operations are added only when the change is sayable
(`setLayerVisible`, `setLayerLocked`, `setLayerName`, `setFieldPattern`,
`setSparklineStyle`, `setNodeVisible`, `setNodeLocked`, `setNodeLayer`,
`setText`,
`removeNode`,
`removeEdge`, `removeLayer`, `addLayer`, `reorderLayer`). They compile to existing
commands. They do not write renderer objects.

## Schema Change

`0.2.0` stays canonical. New *built-in* literals still require a later
version. Plugin nodes are the reserved extension union in `0.2.0`:

- `type` matches `plugin.<owner>.<kind>` in lower-case;
- kind-specific values live in `props` and validate against the
  registered kind schema;
- unregistered plugin types fail closed at parse;
- a kind declares `mode: "2d"`, `mode: "3d"`, or `mode: "both"`;
- a single-mode kind is rejected in the other scene. `both` is current,
  not a later 3D slice.

`plugin.denovo.field` has an official 3D drawer that reads only those
properties. `plugin.denovo.sparkline` has an official 2D drawer that
reads only its props. Other registered plugin kinds still draw as a
marker until they have a drawer. That marker is not a hero catalog.

## Package Boundary

- `@denovo/canvas`: facade. Kinds, properties, named operations,
  `createCanvas`. No Three types.
- `@denovo/canvas-core`: schemas for built-ins and the plugin-node
  union.
- Official kind packages (for example a future field package): schema +
  drawer. Optional. The facade may re-export the official kind.
- `@denovo/canvas-web` / `@denovo/canvas-three`: engines. Not the
  default import for catalog examples.

## First Implementation Slice

1. Schema: 3D `plugin.<owner>.<kind>` union + registry + fixtures.
   Landed.
2. Official kind: `plugin.denovo.field` schema (closed pattern enum +
   numeric knobs). Landed.
3. Official drawer that reads only that node. No vendor file. Landed.
4. Catalog: one hero document in an example app. `createCanvas` +
   document only. Landed as `apps/playground-field`. The catalog
   shows ThreeUI source beside our document as text, not as a second
   runtime.
5. Browser gate that proves no iframe, a pickable node, a property
   change, and undo. Landed as `pnpm verify:field-showcase`.
6. Graph catalog: a service map of built-in `html` / `edge` / `text`
   nodes. Layout uses facade `applyLayout` adapters. Landed as
   `apps/playground-network` and `pnpm verify:network-showcase`.
7. Schema: 2D `plugin.<owner>.<kind>` union, same registry, mode-checked
   parse. Landed. A kind may declare `2d`, `3d`, or `both`.
8. Official 2D kind: `plugin.denovo.sparkline` schema, drawer, and
   `setSparklineStyle`. No new playground. Proof is
   `pnpm verify:denovo-sparkline`.

A catalog without the official drawer is another host. This catalog
deletes the ThreeUI renderer and still redraws.

## Non-Goals

- Accepting Three.js, R3F, or GLSL as kind properties.
- Pinning WebGPU or a Three revision in saved documents.
- Copying ThreeUI rooms or their HTML hosts.
- Making diagrams or BIM a second product identity.
- Shipping Obsidian-style decorative universes as core kinds.
- A public Effect or agent package.

## Relation To Other Documents

- [Product Identity](./product-identity.md) — why this surface exists.
- [M0 Product Contract](./m0-product-contract.md) — document and
  `0.2.0` freeze.
- [Named Authoring Operations](./named-authoring-operations.md) —
  mutation list shape.
- [Extensibility](./extensibility.md) — plugin categories. This file
  specializes node plugins to the `plugin.*` kind grammar.
- [Public API Contract](./public-api-contract.md) — facade exports and
  backend config.
