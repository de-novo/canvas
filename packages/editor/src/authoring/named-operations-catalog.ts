export type NamedOperationRole = "read" | "write";

export type NamedOperationFieldKind =
  | "align-2d-mode"
  | "boolean"
  | "create-id"
  | "distribute-2d-axis"
  | "field-pattern"
  | "layer-id"
  | "layer-id-or-null"
  | "node-id"
  | "node-id-list"
  | "number"
  | "shade-pattern"
  | "sparkline-style"
  | "stack-box-face"
  | "string";

export type NamedOperationFieldName =
  | "alignment"
  | "axis"
  | "createId"
  | "face"
  | "index"
  | "layerId"
  | "locked"
  | "name"
  | "nodeId"
  | "nodeIds"
  | "on"
  | "pattern"
  | "style"
  | "targetLayerId"
  | "text"
  | "visible";

export type NamedOperationField = {
  readonly kind: NamedOperationFieldKind;
  readonly name: NamedOperationFieldName;
  readonly required: boolean;
};

export type NamedOperationName =
  | "addLayer"
  | "alignNodes"
  | "distributeNodes"
  | "listLabels"
  | "listLayers"
  | "listNodes"
  | "removeEdge"
  | "removeLayer"
  | "removeNode"
  | "reorderLayer"
  | "setAnnotationText"
  | "setFieldPattern"
  | "setLayerLocked"
  | "setLayerName"
  | "setLayerVisible"
  | "setNodeLayer"
  | "setNodeLocked"
  | "setNodeVisible"
  | "setShadePattern"
  | "setSparklineStyle"
  | "setText"
  | "stackBox";

export type NamedOperationManifestEntry = {
  readonly fields: readonly NamedOperationField[];
  readonly name: NamedOperationName;
  readonly role: NamedOperationRole;
};

const NAMED_OPERATION_MANIFEST: readonly NamedOperationManifestEntry[] = [
  {
    fields: [
      { kind: "layer-id", name: "layerId", required: true },
      { kind: "string", name: "name", required: true },
      { kind: "number", name: "index", required: false }
    ],
    name: "addLayer",
    role: "write"
  },
  {
    fields: [
      { kind: "node-id-list", name: "nodeIds", required: true },
      { kind: "align-2d-mode", name: "alignment", required: true }
    ],
    name: "alignNodes",
    role: "write"
  },
  {
    fields: [
      { kind: "node-id-list", name: "nodeIds", required: true },
      { kind: "distribute-2d-axis", name: "axis", required: true }
    ],
    name: "distributeNodes",
    role: "write"
  },
  {
    fields: [{ kind: "layer-id", name: "layerId", required: false }],
    name: "listLabels",
    role: "read"
  },
  {
    fields: [],
    name: "listLayers",
    role: "read"
  },
  {
    fields: [{ kind: "layer-id", name: "layerId", required: false }],
    name: "listNodes",
    role: "read"
  },
  {
    fields: [{ kind: "node-id", name: "nodeId", required: true }],
    name: "removeEdge",
    role: "write"
  },
  {
    fields: [
      { kind: "layer-id", name: "layerId", required: true },
      { kind: "layer-id-or-null", name: "targetLayerId", required: true }
    ],
    name: "removeLayer",
    role: "write"
  },
  {
    fields: [{ kind: "node-id", name: "nodeId", required: true }],
    name: "removeNode",
    role: "write"
  },
  {
    fields: [
      { kind: "layer-id", name: "layerId", required: true },
      { kind: "number", name: "index", required: true }
    ],
    name: "reorderLayer",
    role: "write"
  },
  {
    fields: [
      { kind: "node-id", name: "nodeId", required: true },
      { kind: "string", name: "text", required: true }
    ],
    name: "setAnnotationText",
    role: "write"
  },
  {
    fields: [
      { kind: "node-id", name: "nodeId", required: true },
      { kind: "field-pattern", name: "pattern", required: true }
    ],
    name: "setFieldPattern",
    role: "write"
  },
  {
    fields: [
      { kind: "layer-id", name: "layerId", required: true },
      { kind: "boolean", name: "locked", required: true }
    ],
    name: "setLayerLocked",
    role: "write"
  },
  {
    fields: [
      { kind: "layer-id", name: "layerId", required: true },
      { kind: "string", name: "name", required: true }
    ],
    name: "setLayerName",
    role: "write"
  },
  {
    fields: [
      { kind: "layer-id", name: "layerId", required: true },
      { kind: "boolean", name: "visible", required: true }
    ],
    name: "setLayerVisible",
    role: "write"
  },
  {
    fields: [
      { kind: "node-id", name: "nodeId", required: true },
      { kind: "layer-id", name: "layerId", required: true }
    ],
    name: "setNodeLayer",
    role: "write"
  },
  {
    fields: [
      { kind: "node-id", name: "nodeId", required: true },
      { kind: "boolean", name: "locked", required: true }
    ],
    name: "setNodeLocked",
    role: "write"
  },
  {
    fields: [
      { kind: "node-id", name: "nodeId", required: true },
      { kind: "boolean", name: "visible", required: true }
    ],
    name: "setNodeVisible",
    role: "write"
  },
  {
    fields: [
      { kind: "node-id", name: "nodeId", required: true },
      { kind: "shade-pattern", name: "pattern", required: true }
    ],
    name: "setShadePattern",
    role: "write"
  },
  {
    fields: [
      { kind: "node-id", name: "nodeId", required: true },
      { kind: "sparkline-style", name: "style", required: true }
    ],
    name: "setSparklineStyle",
    role: "write"
  },
  {
    fields: [
      { kind: "node-id", name: "nodeId", required: true },
      { kind: "string", name: "text", required: true }
    ],
    name: "setText",
    role: "write"
  },
  {
    fields: [
      { kind: "node-id", name: "on", required: true },
      { kind: "stack-box-face", name: "face", required: true },
      { kind: "create-id", name: "createId", required: true },
      { kind: "layer-id", name: "layerId", required: false }
    ],
    name: "stackBox",
    role: "write"
  }
];

export const NAMED_OPERATION_NAMES: readonly NamedOperationName[] =
  NAMED_OPERATION_MANIFEST.map((entry) => entry.name);

export function listNamedOperations(): readonly NamedOperationManifestEntry[] {
  return NAMED_OPERATION_MANIFEST;
}
