# M3.1 Surface Placement and Stacking Contract

## Purpose

This document defines the first object-on-object placement slice after the
verified [M3 Authoring Contract](./m3-authoring-contract.md). It adds precise
surface placement without changing M3's verified grid-only scope or treating a
failed surface query as work-plane placement.

This is a target contract, not a status claim. Current work and verification
evidence belong in [Project Status](./project-status.md).

The slice lets a host place a new world-aligned 3D `box` on a supported face of
an existing world-aligned 3D `box`. The renderer resolves transient surface
geometry; editor core owns placement semantics and the persistent command.

## Relationship To M3 And M4

M3 continues to define work-plane creation and grid-only snapping. M3.1 is a
new, explicit placement strategy with its own runtime capability and tool. It
does not add `surface` to the verified M3 grid-snap union and does not alter the
behavior of `create3DPrimitiveTool({ workPlane })`.

M4 may accelerate the surface query with BVH or other spatial indexes, but it
must not own placement semantics. The M3.1 capability must remain correct with
the ordinary built-in Three.js raycast before an acceleration layer is present.

## First Slice Scope

The first slice supports:

- a new source node whose type is exactly `box`;
- an existing target node whose type is exactly `box`;
- a root target with zero rotation and finite, strictly positive scale, making
  its effective world transform non-degenerate and world-axis aligned;
- a source box with finite, strictly positive scale and world-aligned rotation;
- placement on the exact visible target face returned by the active runtime;
- a transient ghost while a desktop pointer hovers or a touch pointer is in an
  active placement contact;
- one persistent `node.add` command after a successful primary commit;
- repeated placement, including selecting the newly added box as the next
  target surface.

General arbitrary-mesh placement, sphere tangency, edge or vertex snapping,
collision or occupancy solving, automatic parenting, automatic layer choice,
and rotated-source alignment are not part of this slice. Unsupported input
fails explicitly; it is not approximated as an axis-aligned placement.

## Surface Query Contract

The public contract is expressed through strict, schema-derived values. The
type relationship is equivalent to:

```ts
type CanvasBoxFaceAxis = "x" | "y" | "z";
type CanvasBoxFaceSide = -1 | 1;

type CanvasBoxFaceFeature = {
  readonly kind: "box.face";
  readonly axis: CanvasBoxFaceAxis;
  readonly side: CanvasBoxFaceSide;
};

type Canvas3DSurfacePointRequest = {
  readonly mode: "3d";
  readonly target: {
    readonly kind: "node";
    readonly nodeType: "box";
  };
  readonly viewportPoint: Point2;
};

type Canvas3DSurfacePointResult =
  | {
      readonly kind: "hit";
      readonly mode: "3d";
      readonly nodeId: NodeId;
      readonly nodeType: "box";
      readonly point: Vector3;
      readonly normal: UnitVector3;
      readonly feature: CanvasBoxFaceFeature;
    }
  | {
      readonly kind: "miss";
      readonly mode: "3d";
    };

type Canvas3DSurfacePointRuntime = {
  readonly resolveSurfacePoint: (
    request: Canvas3DSurfacePointRequest
  ) => Canvas3DSurfacePointResult | Promise<Canvas3DSurfacePointResult>;
};
```

`UnitVector3` is a strict finite three-component vector whose Euclidean length
is one within the documented schema tolerance. A hit is valid only when its
normal agrees with the reported box axis and side in world space. The target ID
and type are correlated and are validated against the current document before
preview and again before commit.

`miss` is a valid negative query result, not an instruction to search another
surface or placement strategy. Because this request targets boxes, an
unsupported frontmost node produces `miss` and the renderer does not skip it to
search for a box behind it. A box hit with an unsupported target transform, an
invalid point or normal, or a stale target is an ordinary typed
surface-placement error rather than `miss`.

The query and result must not expose `THREE.Intersection`, `Object3D`, faces,
materials, DOM events, renderer handles, `unknown`, `Record<string, ...>`, or an
unconstrained target or feature string as a convenience public contract.

### Extension 2026-08-22: `mesh` surface targets

The request vocabulary additively widens to a correlated `mesh` variant
beside `box`; the miss semantics, unit-normal tolerance, and no-fallback
rules are unchanged:

```ts
type CanvasMeshTriangleFeature = {
  readonly kind: "mesh.triangle";
  readonly triangleIndex: number; // integer ≥ 0, geometry-triangle scoped
};

type Canvas3DSurfacePointRequest = {
  readonly mode: "3d";
  readonly target: {
    readonly kind: "node";
    readonly nodeType: "box" | "mesh";
  };
  readonly viewportPoint: Point2;
};
```

A `mesh` hit correlates `nodeType: "mesh"` with the triangle-index feature
and a world-space unit normal derived from the intersected triangle under
the node's world matrix. Requesting one node type never returns a hit for
another: an unsupported frontmost node still yields `miss`. The placement
tool continues to accept box targets only; mesh-surface measurement
endpoint capture is the follow-up slice inside this same contract.

## Tool Contract

Surface placement uses a dedicated tool contract rather than optional fields
that make work-plane and surface placement ambiguous. Its public shape is
equivalent to:

```ts
type Canvas3DSurfacePlacementToolOptions<TId extends string = string> = {
  readonly createId: CanvasCreateId;
  readonly cursor?: string;
  readonly id?: TId;
  readonly label?: string;
  readonly layerId: CanvasLayerId;
  readonly mode: "3d";
  readonly placement: {
    readonly kind: "box-face";
    readonly orientation: "world-aligned";
  };
  readonly scale?: CanvasNodeByType<"3d", "box">["scale"];
  readonly color?: CanvasNodeByType<"3d", "box">["color"];
  readonly type: "box";
};

create3DSurfacePlacementTool(options);
```

`Canvas3DSurfacePointRequest`, `Canvas3DSurfacePointResult`,
`Canvas3DSurfacePointRuntime`, `Canvas3DSurfacePlacementToolOptions`, and
`create3DSurfacePlacementTool` are the exported contract names. `layerId` and
`createId` stay required. The tool does not choose a default layer, generate an
implicit ID, or persist a relationship to the target node.

## Exact Placement Semantics

The target hit point is already on the target face in world space. For the
world-aligned source box, editor core calculates the support distance along the
reported face normal from the validated source scale:

```text
supportDistance = sourceScale[feature.axis] / 2
sourceCenter = hit.point + hit.normal * supportDistance
```

The calculation uses the schema-defined unit box and source transform. It must
not add a visual epsilon, reuse the target half extent, use a hard-coded `0.5`,
or derive position from CSS pixels. The complete candidate box is validated
before it becomes a preview and again before dispatch.

The new box is added to the explicitly requested layer with the canonical
common node defaults. It remains a root node with `parentId: null`; touching a
target surface does not imply hierarchy, grouping, attachment, or ownership.

The committed node is an ordinary canonical `0.2.0` box node. Surface hit data,
the ghost, and the target relationship are transient and are not written to
the document, metadata, plugin state, command history, or asset records. No
document migration is required for this slice.

## Interaction And Lifecycle

Pointer movement requests the nearest intended surface from the active runtime.
A valid result produces one transient ghost at the exact candidate transform.
Desktop hover shows the ghost before the primary commit. Touch input shows the
same candidate during its active contact before release commits it.

A successful primary commit revalidates the target and candidate, obtains one
explicit ID, and dispatches one `node.add` command. It creates exactly one
history entry. After commit, the new node is available to the next surface
query, which makes repeated stacking use the same path as the first placement.

The tool clears its ghost on miss, pointer cancellation, pointer leave, Escape,
tool change, editor disconnect, scene replacement, runtime replacement, commit,
and runtime destruction. Pending asynchronous queries are invalidated at the
same lifecycle boundaries and cannot commit after cancellation.

## Responsibility Boundaries

| Package | M3.1 responsibility | Must not own |
| --- | --- | --- |
| `@denovo/canvas-core` | Strict 3D surface request/result, unit-normal, box-face feature, and preview schemas and types | Raycasting, DOM input, tool sessions, Three.js values |
| `@denovo/canvas-editor` | Placement state machine, exact support-offset math, target/candidate revalidation, command dispatch, cancellation, and history | DOM events, renderer intersections, renderer resources |
| `@denovo/canvas-web` | Built-in runtime surface query, world-space point/normal/feature resolution, ghost rendering, and lifecycle cleanup | Document mutation, history, fallback placement policy |
| `@denovo/canvas-three` | Optional reusable ray, box-face, and later spatial-index helpers | Public editor semantics, facade policy, persisted relationships |
| `@denovo/canvas` | Explicit exports, structural capability wiring, runtime-replacement cancellation, and ordinary public domain errors | Duplicate schemas, duplicate placement math, implicit renderer selection |
| Framework adapters and examples | Host controls and desktop/mobile acceptance proof through the facade contract | Private mutation paths or renderer-specific placement semantics |

Core and editor remain usable without DOM, React, Canvas2D, Three.js, or R3F.
M4 acceleration must remain behind the same structural runtime capability.

## Failure And No-Fallback Policy

The operation fails or returns `miss` before persistent dispatch when the
pointer does not resolve to a supported box face. `miss` covers empty space and
an unsupported frontmost node. At minimum, ordinary public errors distinguish
missing capability, unsupported box target state, unsupported or degenerate
transform, invalid hit point, invalid or inconsistent normal, stale target,
missing or locked destination layer, invalid or duplicate ID, mode mismatch,
preview failure, and cancelled operation.

The following behavior is forbidden:

- substituting the existing M3 work plane after surface miss or failure;
- placing at the world origin, raw CSS pixel, previous hit, previous target, or
  nearest supported node;
- skipping an unsupported frontmost target to place on an unrelated surface
  behind it;
- normalizing a materially invalid normal or approximating a rotated target as
  world aligned;
- adding a hidden support epsilon or default box size after invalid input;
- silently generating another ID, choosing another layer, or parenting the new
  node to the target;
- keeping a stale ghost visible or allowing a cancelled asynchronous query to
  commit;
- storing renderer intersection data or transient target relationships in the
  canonical document.

Any failure leaves the document, selection, history, layers, and hierarchy
unchanged.

## Acceptance Criteria

M3.1 may be marked verified only when all of the following are true:

- desktop mouse can hover a supported top or side box face, see the ghost, and
  commit a flush world-aligned box;
- mobile touch shows the same candidate during contact and commits on release;
- at least three boxes can be placed successively by using each committed box
  as the next target;
- the committed center uses the exact support offset for X, Y, and Z faces;
- preview updates never change the document or history, and every successful
  placement adds one node and exactly one history entry;
- miss, unsupported target or transform, invalid normal, cancellation,
  disconnect, and runtime replacement clear the preview and commit nothing;
- a custom renderer without the surface-query or preview capability fails
  before mutation and does not fall back to work-plane placement;
- canonical `0.2.0` documents round-trip unchanged apart from the ordinary new
  box node;
- generated declarations contain no explicit `any` or unjustified broad
  boundary, and positive/negative fixtures prove all request/result/node/feature
  correlations.

## Verification

Schema and public-type fixtures must cover valid X/Y/Z face hits and reject
wrong modes, wrong target/node types, non-finite points, non-unit or mismatched
normals, excess fields, unsupported features, invalid source scale, and broad
callback results.

Editor and runtime fixtures must cover exact support math, stale-result
rejection, one-command commit, repeated stacking, lifecycle cleanup, and every
no-fallback branch. Browser verification must cover desktop mouse and real
mobile touch, visible ghost output, top and side placement, repeated stacking,
non-blank pixels, resize, demand-render bounds, and dynamic runtime replacement.

The completion baseline is:

```sh
pnpm typecheck
pnpm build
pnpm verify:public-api
pnpm verify:document-schema
pnpm verify:editor-core
pnpm verify:hit-testing
pnpm verify:browser-rendering
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-conflicts.py --root .
python3 ~/.agents/skills/doc-governance/scripts/doc-governance-audit.py --root .
```

Project Status must link to durable implementation and verification evidence
before the milestone changes from `active` to `verified`.
