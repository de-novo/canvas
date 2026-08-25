# M3 Authoring Contract

## Purpose

This document defines the durable product and implementation contract for
[M3 Authoring Tools](./vision-and-milestones.md#m3-authoring-tools). It narrows
the first built-in creation set, defines the persistence work required by the
remaining authoring domains, and fixes the responsibility boundaries between
core, editor, renderer, and facade packages.

This is a target contract, not a status table. Current completion evidence and
next actions remain in [Project Status](./project-status.md).

The following invariants apply throughout M3:

- persistent edits use validated commands or transactions;
- tool sessions, draft geometry, snap candidates, and previews remain
  transient;
- saved documents contain renderer-independent values only;
- public authoring types are derived from canonical schemas and retain their
  mode and node-kind relationships;
- missing capabilities and invalid relationships fail explicitly;
- authoring code does not substitute screen pixels, metadata, plugin state, or
  a different feature for a missing domain contract.

## Built-In Creation Scope

The first complete M3 creation scope is intentionally limited to the built-in
nodes already established by the M0 document vocabulary:

- 2D shape creation: `rect` and `circle`;
- 3D primitive creation: `box` and `sphere`.

`line`, `polyline`, `path`, `plane`, `points`, asset-backed geometry, and
instanced authoring are not implicit M3 creation fallbacks. They require their
own schema, renderer, hit-test, property, and migration slices before a public
creation tool may advertise them. The broader expression goals remain in
[Vision and Milestones](./vision-and-milestones.md#expression-goals).

The built-in creation tools are:

```ts
create2DShapeTool(options)
create3DPrimitiveTool(options)
```

Their option types must be discriminated by `mode` and `type`. A rect option
must not accept circle-only properties, and a sphere option must not accept
box-only properties. Implementations must derive node inputs and defaults from
the corresponding canonical node schemas instead of maintaining handwritten
shadow node types.

2D rect and circle tools use an explicit pointer gesture, show a transient
preview, and commit one `node.add` command or one transaction on successful
completion. A cancelled or degenerate gesture commits nothing; it must not
silently create a default-sized shape.

3D box and sphere tools resolve a document-space position on an explicit work
plane, show a transient preview, and commit one `node.add` command or one
transaction. Their documented schema defaults may provide initial color,
radius, rotation, and scale. A missing placement result must not place the node
at the world origin.

## Required Node IDs

Every creation tool requires a concrete ID factory:

```ts
type CanvasCreateIdContext<
  TMode extends CanvasMode,
  TType extends CanvasNodeForMode<TMode>["type"]
> = {
  readonly document: CanvasDocument;
  readonly mode: TMode;
  readonly type: TType;
};

type CanvasCreateId = <
  TMode extends CanvasMode,
  TType extends CanvasNodeForMode<TMode>["type"]
>(context: CanvasCreateIdContext<TMode, TType>) => NodeId;
```

`createId` is required in creation, group, measurement, and annotation tool
options whenever the operation creates a persistent node. Editor core must not
fall back to a counter, timestamp, renderer UUID, DOM ID, or implicit random
value. A facade may offer an explicit ID-factory utility, but the host must pass
or select it deliberately.

The returned ID is validated before preview or commit. An empty or duplicate ID
fails the operation; the SDK must not retry with a different implicit ID.

## Mode-Correlated Public Types

Canonical Zod schemas remain the source of truth. Public types must be inferred
from those schemas and preserve at least these relationships:

```ts
type CanvasCoordinateForMode<TMode extends CanvasMode> =
  TMode extends "2d" ? Point2 : Vector3;

type CanvasNodeForMode<TMode extends CanvasMode> =
  TMode extends "2d" ? Canvas2DNode : Canvas3DNode;

type CanvasNodeByType<
  TMode extends CanvasMode,
  TType extends CanvasNodeForMode<TMode>["type"]
> = Extract<CanvasNodeForMode<TMode>, { type: TType }>;
```

Mode-correlated requests and results use discriminated unions or equivalent
generic relationships. Public callbacks must return concrete correlated values;
they must not return `unknown`, `Record<string, ...>`, an unconstrained object,
or an unrelated 2D-or-3D union that callers must reinterpret.

All changed public types require positive inference fixtures and negative
`@ts-expect-error` fixtures for wrong modes, wrong node-specific fields, invalid
callback results, immutable fields, and unsupported operation kinds.

## Scene-Point Resolution Capability

Pointer input is expressed in canvas-local CSS pixels. Creation, measurement,
annotation, and grid snapping therefore require an explicit runtime capability
that maps a viewport point into document coordinates:

```ts
type CanvasScenePointRequest =
  | {
      readonly mode: "2d";
      readonly viewportPoint: Point2;
    }
  | {
      readonly mode: "3d";
      readonly viewportPoint: Point2;
      readonly workPlane: {
        readonly normal: Vector3;
        readonly constant: number;
      };
    };

type CanvasScenePointResult =
  | {
      readonly mode: "2d";
      readonly position: Point2;
    }
  | {
      readonly mode: "3d";
      readonly position: Vector3;
    };

type CanvasScenePointRuntime = {
  resolveScenePoint: (
    request: CanvasScenePointRequest
  ) => CanvasScenePointResult | Promise<CanvasScenePointResult>;
};
```

The implementation may express the request/result correlation with generics or
overloads, but the generated declaration must prevent a 2D request from being
treated as a 3D result.

Canvas2D resolves through the inverse transient viewport transform. The Three.js
runtime intersects the pointer ray with the requested work plane. The editor
owns neither calculation and imports neither DOM nor Three.js types.

A renderer result with the wrong mode, non-finite coordinates, or no valid
intersection is an explicit domain error. The tool must not use the input CSS
pixel as a document coordinate, reuse the last valid point, change the work
plane, or substitute `[0, 0, 0]`.

## Authoring Preview Capability

Drafts are renderer-independent runtime data and are never inserted into the
document or editor history. Core defines a strict discriminated
`CanvasAuthoringPreview` union for the previews supported by the active M3
tools. The union covers complete draft nodes, measurement segments, the active
grid, and the current grid-snap marker with mode-correlated coordinates.

Renderers expose an atomic capability:

```ts
type CanvasAuthoringPreviewRuntime = {
  setAuthoringPreviews: (
    previews: readonly CanvasAuthoringPreview[]
  ) => void | Promise<void>;
};
```

An empty array clears all authoring previews. Preview entries contain only
serializable domain values; they do not contain Canvas contexts, DOM nodes,
Three.js objects, materials, callbacks, or renderer handles.

The active tool clears its previews on commit, pointer cancel, pointer leave,
Escape, tool change, editor disconnect, scene replacement, runtime replacement,
and runtime destruction. If a tool requires visible preview support and the
runtime does not implement it, the operation fails before document mutation.
It must not continue invisibly.

## Property Editing Helpers

Property authoring must correlate a patch with the concrete node being edited.
The public helper relationship is:

```ts
type CanvasNodePatchFor<TNode extends CanvasNode> = AtLeastOne<
  Omit<TNode, "id" | "type">
> & {
  readonly id?: never;
  readonly type?: never;
};

function createNodeUpdateCommand<TNode extends CanvasNode>(
  node: TNode,
  patch: CanvasNodePatchFor<TNode>
): Extract<CanvasCommand, { type: "node.update" }> &
  CanvasNodeIdentityFor<TNode>;
```

The exact helper name may follow the existing facade vocabulary, but its
contract must retain this relationship. A rect patch cannot contain `radius`, a
sphere patch cannot contain `fill`, a 2D position cannot contain three values,
and an empty patch is invalid.

Every raw `node.update` includes the source identity as correlated `nodeMode`
and `nodeType` fields. Runtime command validation looks up the current node,
verifies that its actual mode and type still match that identity, merges the
patch, and validates the result through the concrete node schema. The helper
derives the identity from its validated source node. The public authoring helper
must not accept `Record<string, JsonValue>` as a convenience type.

Common authoring properties introduced by the M3 persistence schema are
`visible`, `locked`, `metadata`, `layerId`, and `parentId`. Optional mutable
fields that need to be cleared use explicit nullable schema values rather than
`undefined`, so command serialization and inverse generation remain exact.

## Persistence Schema Contract

The legacy `0.1.0` document schema cannot represent durable groups, layers,
measurements, or annotations. The canonical current version is `0.2.0`; these
features are represented by its strict schemas rather than opaque `metadata`
or `pluginState` conventions.

Core accepts known legacy `0.1.0` input only through the migration boundary.
The version field is a known-version contract rather than an arbitrary
non-empty string.

Loading follows this order:

1. decode JSON or accept an untrusted object;
2. inspect the schema version;
3. run the pure deterministic `0.1.0` to `0.2.0` migration;
4. validate the migrated value with the strict `0.2.0` schema;
5. expose and save only the canonical `0.2.0` output.

Unsupported past or future versions fail with a version-specific document
error. They must not be parsed as the current version.

The pure `0.1.0` migration adds the canonical default layer, assigns every
existing node to it, and adds explicit common node defaults:

- `visible: true`;
- `locked: false`;
- `metadata: {}`;
- `parentId: null`;
- `layerId` referencing the migrated default layer.

The migration must be deterministic, idempotent at its declared boundary, JSON
round-trip safe, and covered by fixtures. It must not inspect renderer state,
the clock, random values, or framework state. This prerequisite pulls only the
minimum schema migration needed by M3 forward; patch persistence and remote
synchronization remain M6 work.

## Group Semantics

Groups are built-in nodes, not metadata tags. Each scene-mode schema owns its
mode-specific group node:

- a 2D group has the canonical 2D transform;
- a 3D group has the canonical 3D transform;
- both use the public node type `group` inside their mode-specific node union.

All nodes own a persisted `parentId: NodeId | null`. A non-null parent must
reference a group in the same scene and layer. Scene validation rejects missing
parents, non-group parents, cross-layer parents, self-parenting, and cycles.
Transforms are local to the parent; a root node's transform is local to the
scene.

Group visibility and locking are inherited. A node is effectively visible only
when the node, every ancestor group, and its layer are visible. A node is
effectively locked when the node, any ancestor group, or its layer is locked.
Selection and transform tools respect effective lock state. A multi-node tool
operation containing an effectively locked node fails atomically instead of
silently skipping it.

Grouping and ungrouping are editor-owned transaction helpers:

- grouping requires explicit `groupId` or the required `createId` factory;
- the selected nodes must be siblings in the same layer;
- grouping inserts one group and reparents all selected nodes atomically;
- ungrouping reparents children to the group's parent and removes the empty
  group atomically;
- both operations preserve each child's world transform by recalculating its
  local transform;
- removing a non-empty group through plain `node.remove` fails.

If a rotated, non-uniformly scaled hierarchy would require shear or a
degenerate transform that the canonical node transform cannot represent,
ungrouping fails atomically. It must not approximate the result.

The persisted node is the single owner of `parentId`. A separate command-level
`node.add.parentId` field must not remain as a second source of truth.

## Layer Semantics

Layers are ordered scene records, not renderer objects and not group aliases:

```ts
type CanvasLayer = {
  readonly id: CanvasLayerId;
  readonly name: string;
  readonly visible: boolean;
  readonly locked: boolean;
  readonly metadata: CanvasMetadata;
};
```

Every scene contains at least one layer, and every node references exactly one
existing layer through `layerId`. Layer IDs use their canonical schema-derived
type and do not reuse renderer layer numbers.

Layer order defines 2D stacking before node order within each layer. In 3D it
defines authoring order and inherited visibility/locking only; it does not
override depth testing or camera distance.

Editor core owns serializable `layer.add`, `layer.update`, `layer.remove`, and
`layer.reorder` commands and their inverse behavior. Removing a non-empty layer
requires an explicit target layer in the command. Without one, the command
fails. Nodes are never silently moved to a default layer. Moving a group to a
different layer is one transaction that moves all descendants and preserves
their hierarchy.

The currently active layer is transient editor/workspace state. It is not part
of the saved document. Creation tools require an explicit target layer from
their options or tool context and fail if it is missing, locked, or absent.

## Grid-Only Snap Scope

The first M3 snap scope is grid snapping only. It does not advertise guide,
edge, vertex, center, surface, or arbitrary-node snapping.

Grid definitions are strict, mode-correlated authoring values:

- a 2D grid defines a 2D origin and positive X/Y spacing;
- a 3D grid defines a 3D origin, two finite non-parallel work-plane axes, and
  positive spacing along those axes.

The active grid and snap-enabled state are transient editor/workspace settings
in M3. They are passed through the authoring preview capability and are not
added to `CanvasDocument` by this slice. Persisted guide or grid nodes require a
future schema decision and migration.

When grid snapping is enabled, the editor snaps the resolved scene point to the
nearest grid intersection using pure deterministic math. A 3D point is resolved
on and snapped within the same explicit work plane. The snap marker is
transient, and only the final snapped coordinate is stored in the created or
updated node.

Guide and node-feature snap kinds are deliberately absent from the first public
snap union. External inputs that request them fail validation. A renderer or
tool must not reinterpret an unsupported guide/node request as grid snapping,
free placement, or the nearest hit.

## Measurement Node And Tool

M3 introduces a built-in distance-measurement node in each scene-mode union.
The 2D variant stores two `Point2` endpoints; the 3D variant stores two
`Vector3` endpoints. Both store:

- `type: "measurement"`;
- `measurement: "distance"`;
- common layer, parent, visibility, lock, and metadata fields;
- a strict measurement-unit description;
- a non-negative integer display precision.

The measured value is derived from endpoints and the unit description. It is
not duplicated in persisted JSON, where it could become stale. The first M3
measurement contract does not claim angle, area, volume, geodesic, or
surface-following measurement.

The measurement tool requires `createId`, scene-point resolution, and authoring
preview capabilities. It maintains its first point and draft segment
transiently, commits one validated `node.add` command after the second point,
and clears the draft on all cancellation and lifecycle boundaries. Optional
grid snapping uses only the grid contract above.

## Annotation Node And Tool

M3 introduces a built-in annotation node in each scene-mode union. The 2D
variant stores a `Point2` anchor and the 3D variant stores a `Vector3` anchor.
Both store:

- `type: "annotation"`;
- non-empty text content;
- an optional explicit target node ID represented as `NodeId | null`;
- common layer, parent, visibility, lock, and metadata fields.

Scene validation rejects a non-null target that does not exist. Annotation text
is document content; editor dialogs, DOM elements, layout measurements, and
renderer label objects are not persisted.

The annotation tool requires `createId`, scene-point resolution, authoring
preview, and a concrete annotation-draft provider supplied by the host. The
provider returns a validated draft or an explicit cancellation result. Editor
core does not open a prompt, import a UI framework, invent placeholder text, or
store an empty annotation. A successful placement commits one `node.add`
command.

## Package Responsibilities

| Package | M3 responsibility | Must not own |
| --- | --- | --- |
| `@denovo/canvas-core` | Versioned schemas, migrations, mode-correlated node and capability types, layers, group relationships, measurement and annotation values | DOM input, Three.js math, tool sessions, renderer resources |
| `@denovo/canvas-editor` | Creation/measurement/annotation state machines, precise property helpers, group/layer commands, grid snap math, transactions, lock enforcement, history | DOM events, renderer objects, persistence transport |
| `@denovo/canvas-web` | Canvas2D and Three.js scene-point resolution, transient preview rendering, built-in node rendering and hit testing, lifecycle cleanup | Document mutation, command history, framework UI |
| `@denovo/canvas-three` | Optional Three.js geometry, ray, picking, and performance helpers reused by the web 3D runtime | Public document semantics, editor commands, facade policy |
| `@denovo/canvas` | Explicit re-exports, runtime capability detection/wiring, dynamic renderer replacement, ordinary public errors | Duplicate schemas, duplicate tool logic, React-only semantics |
| Framework adapters and examples | Lifecycle bindings, host property UI, annotation draft UI, and acceptance proofs over the same facade/editor contracts | New document semantics or private mutation paths |

Core and editor remain usable without DOM, React, Next.js, Canvas2D, Three.js,
or R3F. Facade wiring must feature-detect structural runtime capabilities and
preserve them across 2D/3D or custom renderer replacement.

## Failure And No-Fallback Policy

M3 authoring operations use ordinary typed domain errors at public boundaries.
At minimum, implementations distinguish invalid input, missing capability,
mode mismatch, invalid or duplicate ID, locked target, missing parent/layer,
hierarchy cycle, invalid work plane, unsupported node kind, and invalid renderer
result.

The following behavior is forbidden:

- treating CSS pixels as document coordinates;
- using world origin, the previous valid point, or another plane after failed
  3D placement;
- generating a replacement ID after an invalid or duplicate host ID;
- storing groups, layers, measurements, or annotations in opaque metadata or
  plugin state;
- silently skipping locked or unsupported nodes in a batch operation;
- moving children or layer members without an explicit command strategy;
- treating an unsupported guide/node snap request as grid or free snapping;
- committing a mutation when required preview or placement capability is
  missing;
- silently dropping an unsupported built-in node in a renderer;
- accepting renderer, DOM, framework, or Effect values in persisted documents.

Capability failure occurs before persistent dispatch whenever possible.
Transactions are atomic: any validation or capability error leaves the document,
selection, history, and persisted layer/group relationships unchanged.

## M3 Acceptance Criteria

M3 is accepted only when all of the following are true:

- the existing select, navigation, and complete translate/rotate/scale tool
  contracts are verified;
- a vanilla host can create and property-edit rects, circles, boxes, and
  spheres without renderer-specific code;
- the host can group and ungroup nodes and can create, reorder, lock, hide,
  remove, undo, and redo layers through SDK commands;
- the host can enable an explicit 2D or 3D grid and author against grid-snapped
  points;
- the host can create, render, select, edit, serialize, load, undo, and redo
  built-in distance measurements and annotations in 2D and 3D;
- every drag or multi-step tool keeps draft state outside the document and
  creates at most one history entry on commit;
- `0.1.0` fixtures migrate deterministically to canonical `0.2.0` documents;
- saved documents round-trip as renderer-independent JSON;
- missing custom-renderer capabilities fail explicitly without changing the
  document;
- generated declarations preserve mode/node/property correlations and contain
  no forbidden broad-type leakage.

## Verification

Verification must cover behavior, persistence, types, and rendered output.

Schema and migration fixtures must prove:

- valid 2D/3D group, layer, measurement, and annotation documents;
- exact `0.1.0` to `0.2.0` migration and JSON round trips;
- rejection of unknown versions, excess fields, wrong-dimensional nodes,
  missing layers/parents/targets, non-group parents, cross-layer parents,
  duplicate IDs, and hierarchy cycles.

Editor fixtures must prove:

- precise creation and property commands;
- atomic grouping, ungrouping, layer changes, and inverse behavior;
- effective visibility/lock handling;
- grid-only snapping and rejection of unsupported snap kinds;
- transient previews and one commit-time history entry;
- cleanup on cancel, leave, Escape, tool change, disconnect, replacement, and
  destruction;
- no mutation after any required-capability failure.

Public type fixtures must include positive inference and negative
`@ts-expect-error` cases for mode, node type, node-specific patch fields,
coordinates, IDs, layer/group relationships, measurement/annotation drafts,
and callback results. Generated declarations must be inspected for explicit
`any`, unjustified `unknown`, convenience `Record<string, ...>`, unconstrained
protocol identifiers, renderer types, and Effect types.

Browser verification must cover desktop mouse and mobile touch for 2D and 3D:

- creation preview and commit;
- grid rendering and snapped placement;
- group/layer visibility and lock behavior;
- measurement and annotation rendering, hit testing, editing, and cleanup;
- non-blank pixels, bounded demand rendering, resize, and dynamic renderer
  replacement.

The completion baseline is:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
pnpm verify:document-schema
pnpm verify:editor-core
pnpm verify:hit-testing
pnpm verify:browser-rendering
pnpm verify:docs
```

M3 must not be marked verified until these checks pass and Project Status links
to durable history evidence.
