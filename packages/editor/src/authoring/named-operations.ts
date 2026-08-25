import {
  BoxNodeSchema,
  CanvasCommandSchema,
  CanvasDocumentSchema,
  CanvasLayerIdSchema,
  CanvasLayerSchema,
  DENOVO_FIELD_NODE_TYPE,
  DENOVO_SPARKLINE_NODE_TYPE,
  DenovoFieldPatternSchema,
  DenovoFieldPropsSchema,
  DenovoSparklinePropsSchema,
  DenovoSparklineStyleSchema,
  NodeIdSchema,
  isDenovoFieldNode,
  isDenovoSparklineNode,
  type CanvasCommand,
  type CanvasCreateId,
  type CanvasDocument,
  type CanvasLayerId,
  type CanvasNode,
  type CanvasNodeByType,
  type DenovoFieldPattern,
  type DenovoSparklineStyle,
  type NodeId,
  type Vector3
} from "@denovo/canvas-core";
import { createNodeUpdateCommand } from "../commands/builders.js";
import { CanvasEditorError } from "../errors.js";
import {
  getEffectiveNodeState,
  resolveEffectiveNodeState
} from "../node-state.js";
import { freezeValue, isPlainObject, jsonEqual } from "../utils.js";

export type NamedOperationResult = {
  readonly document: CanvasDocument;
  readonly changed: boolean;
  readonly commands: readonly CanvasCommand[];
};

export type NamedOperation = (
  document: CanvasDocument
) => NamedOperationResult;

export type SetLayerVisibleInput = {
  readonly layerId: CanvasLayerId;
  readonly visible: boolean;
};

export type SetLayerLockedInput = {
  readonly layerId: CanvasLayerId;
  readonly locked: boolean;
};

export type SetLayerNameInput = {
  readonly layerId: CanvasLayerId;
  readonly name: string;
};

export type StackBoxFace = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

const STACK_BOX_FACES: readonly StackBoxFace[] = [
  "+x",
  "-x",
  "+y",
  "-y",
  "+z",
  "-z"
];

export type StackBoxInput = {
  readonly on: NodeId;
  readonly face: StackBoxFace;
  readonly createId: CanvasCreateId;
  readonly layerId?: CanvasLayerId;
};

export type SetFieldPatternInput = {
  readonly nodeId: NodeId;
  readonly pattern: DenovoFieldPattern;
};

export type SetSparklineStyleInput = {
  readonly nodeId: NodeId;
  readonly style: DenovoSparklineStyle;
};

export type SetNodeVisibleInput = {
  readonly nodeId: NodeId;
  readonly visible: boolean;
};

export type SetNodeLockedInput = {
  readonly nodeId: NodeId;
  readonly locked: boolean;
};

export type SetNodeLayerInput = {
  readonly nodeId: NodeId;
  readonly layerId: CanvasLayerId;
};

export type SetTextInput = {
  readonly nodeId: NodeId;
  readonly text: string;
};

export type RemoveNodeInput = {
  readonly nodeId: NodeId;
};

export type RemoveEdgeInput = {
  readonly nodeId: NodeId;
};

export type RemoveLayerInput = {
  readonly layerId: CanvasLayerId;
  readonly targetLayerId: CanvasLayerId | null;
};

export type AddLayerInput = {
  readonly layerId: CanvasLayerId;
  readonly name: string;
  readonly index?: number;
};

export type ReorderLayerInput = {
  readonly layerId: CanvasLayerId;
  readonly index: number;
};

export type ListNodesOptions = {
  readonly layerId?: CanvasLayerId;
};

export type ListedNode = {
  readonly id: NodeId;
  readonly type: CanvasNode["type"];
  readonly layerId: CanvasLayerId;
  readonly visible: boolean;
  readonly locked: boolean;
};

export type ListedLayer = {
  readonly id: CanvasLayerId;
  readonly name: string;
  readonly visible: boolean;
  readonly locked: boolean;
};

const SET_LAYER_VISIBLE_KEYS = new Set(["layerId", "visible"]);
const SET_LAYER_LOCKED_KEYS = new Set(["layerId", "locked"]);
const SET_LAYER_NAME_KEYS = new Set(["layerId", "name"]);
const SET_FIELD_PATTERN_KEYS = new Set(["nodeId", "pattern"]);
const SET_SPARKLINE_STYLE_KEYS = new Set(["nodeId", "style"]);
const SET_NODE_VISIBLE_KEYS = new Set(["nodeId", "visible"]);
const SET_NODE_LOCKED_KEYS = new Set(["nodeId", "locked"]);
const SET_NODE_LAYER_KEYS = new Set(["nodeId", "layerId"]);
const SET_TEXT_KEYS = new Set(["nodeId", "text"]);
const REMOVE_NODE_KEYS = new Set(["nodeId"]);
const REMOVE_EDGE_KEYS = new Set(["nodeId"]);
const REMOVE_LAYER_KEYS = new Set(["layerId", "targetLayerId"]);
const ADD_LAYER_KEYS = new Set(["layerId", "name", "index"]);
const REORDER_LAYER_KEYS = new Set(["layerId", "index"]);
const STACK_BOX_KEYS = new Set(["on", "face", "createId", "layerId"]);
const STACK_BOX_FACE_SET: ReadonlySet<string> = new Set(STACK_BOX_FACES);

export function setLayerVisible(input: SetLayerVisibleInput): NamedOperation {
  const parsed = parseSetLayerVisibleInput(input);

  return (document) => {
    const layer = document.scene.layers.find(
      (candidate) => candidate.id === parsed.layerId
    );

    if (!layer) {
      throw new CanvasEditorError(
        "layer-not-found",
        `Layer was not found: ${parsed.layerId}`
      );
    }

    if (layer.locked) {
      throw new CanvasEditorError(
        "locked-target",
        `Layer is locked: ${layer.id}`
      );
    }

    if (layer.visible === parsed.visible) {
      return {
        changed: false,
        commands: [],
        document
      };
    }

    const command = parseLayerUpdateCommand(
      parsed.layerId,
      { visible: parsed.visible },
      "setLayerVisible"
    );
    const nextLayers = document.scene.layers.map((candidate) =>
      candidate.id === parsed.layerId
        ? { ...candidate, visible: parsed.visible }
        : candidate
    );

    return {
      changed: true,
      commands: [command],
      document: parseNamedOperationDocument({
        ...document,
        scene: {
          ...document.scene,
          layers: nextLayers
        }
      })
    };
  };
}

export function setLayerLocked(input: SetLayerLockedInput): NamedOperation {
  const parsed = parseSetLayerLockedInput(input);

  return (document) => {
    const layer = document.scene.layers.find(
      (candidate) => candidate.id === parsed.layerId
    );

    if (!layer) {
      throw new CanvasEditorError(
        "layer-not-found",
        `Layer was not found: ${parsed.layerId}`
      );
    }

    if (layer.locked === parsed.locked) {
      return {
        changed: false,
        commands: [],
        document
      };
    }

    const command = parseLayerUpdateCommand(
      parsed.layerId,
      { locked: parsed.locked },
      "setLayerLocked"
    );
    const nextLayers = document.scene.layers.map((candidate) =>
      candidate.id === parsed.layerId
        ? { ...candidate, locked: parsed.locked }
        : candidate
    );

    return {
      changed: true,
      commands: [command],
      document: parseNamedOperationDocument({
        ...document,
        scene: {
          ...document.scene,
          layers: nextLayers
        }
      })
    };
  };
}

export function setLayerName(input: SetLayerNameInput): NamedOperation {
  const parsed = parseSetLayerNameInput(input);

  return (document) => {
    const layer = document.scene.layers.find(
      (candidate) => candidate.id === parsed.layerId
    );

    if (!layer) {
      throw new CanvasEditorError(
        "layer-not-found",
        `Layer was not found: ${parsed.layerId}`
      );
    }

    if (layer.locked) {
      throw new CanvasEditorError(
        "locked-target",
        `Layer is locked: ${layer.id}`
      );
    }

    if (layer.name === parsed.name) {
      return {
        changed: false,
        commands: [],
        document
      };
    }

    const command = parseLayerUpdateCommand(
      parsed.layerId,
      { name: parsed.name },
      "setLayerName"
    );
    const nextLayers = document.scene.layers.map((candidate) =>
      candidate.id === parsed.layerId
        ? { ...candidate, name: parsed.name }
        : candidate
    );

    return {
      changed: true,
      commands: [command],
      document: parseNamedOperationDocument({
        ...document,
        scene: {
          ...document.scene,
          layers: nextLayers
        }
      })
    };
  };
}

export function stackBox(input: StackBoxInput): NamedOperation {
  const parsed = parseStackBoxInput(input);

  return (document) => {
    if (document.scene.mode !== "3d") {
      throw new CanvasEditorError(
        "mode-mismatch",
        "stackBox requires a 3D document."
      );
    }

    const source = document.scene.nodes.find(
      (candidate) => candidate.id === parsed.on
    );

    if (!source) {
      throw new CanvasEditorError(
        "node-not-found",
        `Node was not found: ${parsed.on}`
      );
    }

    if (source.type !== "box") {
      throw new CanvasEditorError(
        "invalid-command",
        `stackBox source must be a box: ${source.id}`
      );
    }

    if (source.parentId != null) {
      throw new CanvasEditorError(
        "invalid-command",
        `stackBox requires a root box: ${source.id}`
      );
    }

    if (source.rotation.some((component) => component !== 0)) {
      throw new CanvasEditorError(
        "invalid-command",
        `stackBox requires a world-aligned box: ${source.id}`
      );
    }

    if (
      !source.scale.every(
        (component) => Number.isFinite(component) && component > 0
      )
    ) {
      throw new CanvasEditorError(
        "invalid-command",
        `stackBox source scale must be finite and strictly positive: ${source.id}`
      );
    }

    const layerId = parsed.layerId ?? source.layerId;
    const layer = document.scene.layers.find(
      (candidate) => candidate.id === layerId
    );

    if (!layer) {
      throw new CanvasEditorError(
        "layer-not-found",
        `Layer was not found: ${layerId}`
      );
    }

    if (source.locked || layer.locked) {
      throw new CanvasEditorError(
        "locked-target",
        source.locked
          ? `Box is locked: ${source.id}`
          : `Layer is locked: ${layer.id}`
      );
    }

    if (source.visible === false || layer.visible === false) {
      throw new CanvasEditorError(
        "invalid-command",
        `Box is not effectively visible: ${source.id}`
      );
    }

    const nodeId = createStackedBoxId(parsed.createId, document);
    const position = resolveStackedBoxPosition(source, parsed.face, source.scale);
    const existing = document.scene.nodes.find(
      (candidate) => candidate.id === nodeId
    );

    if (existing) {
      if (isStackedBoxAlreadyInState(existing, layerId, position, source.scale)) {
        return {
          changed: false,
          commands: [],
          document
        };
      }

      throw new CanvasEditorError(
        "node-already-exists",
        `Node already exists: ${nodeId}`
      );
    }

    const node = parseStackedBoxNode({
      ...(source.color === undefined ? {} : { color: source.color }),
      id: nodeId,
      layerId,
      position,
      rotation: [0, 0, 0],
      scale: source.scale,
      type: "box"
    });
    const command = parseNodeAddCommand(node);

    return {
      changed: true,
      commands: [command],
      document: parseNamedOperationDocument({
        ...document,
        scene: {
          ...document.scene,
          nodes: [...document.scene.nodes, node]
        }
      })
    };
  };
}

export function setFieldPattern(input: SetFieldPatternInput): NamedOperation {
  const parsed = parseSetFieldPatternInput(input);

  return (document) => {
    if (document.scene.mode !== "3d") {
      throw new CanvasEditorError(
        "mode-mismatch",
        "setFieldPattern requires a 3D document."
      );
    }

    const node = document.scene.nodes.find(
      (candidate) => candidate.id === parsed.nodeId
    );

    if (!node) {
      throw new CanvasEditorError(
        "node-not-found",
        `Node was not found: ${parsed.nodeId}`
      );
    }

    if (!isDenovoFieldNode(node)) {
      throw new CanvasEditorError(
        "invalid-command",
        `setFieldPattern requires ${DENOVO_FIELD_NODE_TYPE}: ${node.id}`
      );
    }

    const layer = document.scene.layers.find(
      (candidate) => candidate.id === node.layerId
    );

    if (!layer) {
      throw new CanvasEditorError(
        "layer-not-found",
        `Layer was not found: ${node.layerId}`
      );
    }

    if (node.locked || layer.locked) {
      throw new CanvasEditorError(
        "locked-target",
        node.locked
          ? `Field is locked: ${node.id}`
          : `Layer is locked: ${layer.id}`
      );
    }

    const props = DenovoFieldPropsSchema.parse(node.props);

    if (props.pattern === parsed.pattern) {
      return {
        changed: false,
        commands: [],
        document
      };
    }

    const nextProps = DenovoFieldPropsSchema.parse({
      ...props,
      pattern: parsed.pattern
    });
    const command = parseFieldPatternUpdateCommand(node.id, nextProps);
    const nextNodes = document.scene.nodes.map((candidate) =>
      candidate.id === node.id ? { ...candidate, props: nextProps } : candidate
    );

    return {
      changed: true,
      commands: [command],
      document: parseNamedOperationDocument({
        ...document,
        scene: {
          ...document.scene,
          nodes: nextNodes
        }
      })
    };
  };
}

export function setSparklineStyle(input: SetSparklineStyleInput): NamedOperation {
  const parsed = parseSetSparklineStyleInput(input);

  return (document) => {
    if (document.scene.mode !== "2d") {
      throw new CanvasEditorError(
        "mode-mismatch",
        "setSparklineStyle requires a 2D document."
      );
    }

    const node = document.scene.nodes.find(
      (candidate) => candidate.id === parsed.nodeId
    );

    if (!node) {
      throw new CanvasEditorError(
        "node-not-found",
        `Node was not found: ${parsed.nodeId}`
      );
    }

    if (!isDenovoSparklineNode(node)) {
      throw new CanvasEditorError(
        "invalid-command",
        `setSparklineStyle requires ${DENOVO_SPARKLINE_NODE_TYPE}: ${node.id}`
      );
    }

    const layer = document.scene.layers.find(
      (candidate) => candidate.id === node.layerId
    );

    if (!layer) {
      throw new CanvasEditorError(
        "layer-not-found",
        `Layer was not found: ${node.layerId}`
      );
    }

    if (node.locked || layer.locked) {
      throw new CanvasEditorError(
        "locked-target",
        node.locked
          ? `Sparkline is locked: ${node.id}`
          : `Layer is locked: ${layer.id}`
      );
    }

    const props = DenovoSparklinePropsSchema.parse(node.props);

    if (props.style === parsed.style) {
      return {
        changed: false,
        commands: [],
        document
      };
    }

    const nextProps = DenovoSparklinePropsSchema.parse({
      ...props,
      style: parsed.style
    });
    const command = parseSparklineStyleUpdateCommand(node.id, nextProps);
    const nextNodes = document.scene.nodes.map((candidate) =>
      candidate.id === node.id ? { ...candidate, props: nextProps } : candidate
    );

    return {
      changed: true,
      commands: [command],
      document: parseNamedOperationDocument({
        ...document,
        scene: {
          ...document.scene,
          nodes: nextNodes
        }
      })
    };
  };
}

export function setNodeVisible(input: SetNodeVisibleInput): NamedOperation {
  const parsed = parseSetNodeVisibleInput(input);

  return (document) => {
    const node = findNamedOperationNode(document, parsed.nodeId);

    if (node.visible === parsed.visible) {
      return {
        changed: false,
        commands: [],
        document
      };
    }

    const state = resolveEffectiveNodeState(document, node.id);

    if (state.locked) {
      throw new CanvasEditorError(
        "locked-target",
        `Node is locked: ${node.id}`
      );
    }

    return applyNodeFlagUpdate(document, node, { visible: parsed.visible });
  };
}

export function setNodeLocked(input: SetNodeLockedInput): NamedOperation {
  const parsed = parseSetNodeLockedInput(input);

  return (document) => {
    const node = findNamedOperationNode(document, parsed.nodeId);

    if (node.locked === parsed.locked) {
      return {
        changed: false,
        commands: [],
        document
      };
    }

    const state = resolveEffectiveNodeState(document, node.id);
    const isExplicitSelfUnlock =
      node.locked && !state.lockedByHierarchy && parsed.locked === false;

    if (state.locked && !isExplicitSelfUnlock) {
      throw new CanvasEditorError(
        "locked-target",
        `Node is locked: ${node.id}`
      );
    }

    return applyNodeFlagUpdate(document, node, { locked: parsed.locked });
  };
}

export function setNodeLayer(input: SetNodeLayerInput): NamedOperation {
  const parsed = parseSetNodeLayerInput(input);

  return (document) => {
    const node = findNamedOperationNode(document, parsed.nodeId);
    const layer = document.scene.layers.find(
      (candidate) => candidate.id === parsed.layerId
    );

    if (!layer) {
      throw new CanvasEditorError(
        "layer-not-found",
        `Layer was not found: ${parsed.layerId}`
      );
    }

    const state = resolveEffectiveNodeState(document, node.id);

    if (state.locked) {
      throw new CanvasEditorError(
        "locked-target",
        `Node is locked: ${node.id}`
      );
    }

    if (layer.locked) {
      throw new CanvasEditorError(
        "locked-target",
        `Layer is locked: ${layer.id}`
      );
    }

    if (node.layerId === parsed.layerId) {
      return {
        changed: false,
        commands: [],
        document
      };
    }

    return applyNodeLayerUpdate(document, node, parsed.layerId);
  };
}

export function setText(input: SetTextInput): NamedOperation {
  const parsed = parseSetTextInput(input);

  return (document) => {
    const node = findNamedOperationNode(document, parsed.nodeId);

    if (node.type !== "text") {
      throw new CanvasEditorError(
        "invalid-command",
        `setText requires a text node: ${node.id}`
      );
    }

    const state = resolveEffectiveNodeState(document, node.id);

    if (state.locked) {
      throw new CanvasEditorError(
        "locked-target",
        `Node is locked: ${node.id}`
      );
    }

    if (node.text === parsed.text) {
      return {
        changed: false,
        commands: [],
        document
      };
    }

    return applyNodeTextUpdate(document, node, parsed.text);
  };
}

export function listNodes(
  document: CanvasDocument,
  options?: ListNodesOptions
): readonly ListedNode[] {
  const parsedDocument = parseNamedOperationDocument(document);
  const parsedOptions = parseListNodesOptions(options);

  if (parsedOptions.layerId !== undefined) {
    const layer = parsedDocument.scene.layers.find(
      (candidate) => candidate.id === parsedOptions.layerId
    );

    if (!layer) {
      throw new CanvasEditorError(
        "layer-not-found",
        `Layer was not found: ${parsedOptions.layerId}`
      );
    }
  }

  const nodes =
    parsedOptions.layerId === undefined
      ? parsedDocument.scene.nodes
      : parsedDocument.scene.nodes.filter(
          (node) => node.layerId === parsedOptions.layerId
        );

  return freezeValue(
    nodes.map((node) => {
      const state = getEffectiveNodeState(parsedDocument, node.id);
      return {
        id: node.id,
        layerId: node.layerId,
        locked: state.locked,
        type: node.type,
        visible: state.visible
      };
    })
  );
}

export function listLayers(
  document: CanvasDocument,
  options?: undefined
): readonly ListedLayer[] {
  if (options !== undefined) {
    throw new CanvasEditorError(
      "invalid-command",
      "listLayers does not accept options. Use listLayers(document)."
    );
  }

  const parsedDocument = parseNamedOperationDocument(document);
  return freezeValue(
    parsedDocument.scene.layers.map((layer) => ({
      id: layer.id,
      locked: layer.locked,
      name: layer.name,
      visible: layer.visible
    }))
  );
}

export function removeNode(input: RemoveNodeInput): NamedOperation {
  const parsed = parseRemoveNodeInput(input);

  return (document) => {
    const node = findNamedOperationNode(document, parsed.nodeId);
    const state = resolveEffectiveNodeState(document, node.id);

    if (state.locked) {
      throw new CanvasEditorError(
        "locked-target",
        `Node is locked: ${node.id}`
      );
    }

    if (
      document.scene.nodes.some(
        (candidate) =>
          candidate.type === "edge" &&
          (candidate.sourceId === node.id || candidate.targetId === node.id)
      )
    ) {
      throw new CanvasEditorError(
        "invalid-command",
        `Node is referenced by an edge and cannot be removed: ${node.id}`
      );
    }

    if (
      node.type === "group" &&
      document.scene.nodes.some((candidate) => candidate.parentId === node.id)
    ) {
      throw new CanvasEditorError(
        "invalid-command",
        `A non-empty group must be ungrouped before removal: ${node.id}`
      );
    }

    return compileNodeRemove(document, node, "removeNode");
  };
}

export function removeEdge(input: RemoveEdgeInput): NamedOperation {
  const parsed = parseRemoveEdgeInput(input);

  return (document) => {
    const node = findNamedOperationNode(document, parsed.nodeId);

    if (node.type !== "edge") {
      throw new CanvasEditorError(
        "invalid-command",
        `removeEdge requires an edge: ${node.id}`
      );
    }

    const state = resolveEffectiveNodeState(document, node.id);

    if (state.locked) {
      throw new CanvasEditorError(
        "locked-target",
        `Node is locked: ${node.id}`
      );
    }

    if (
      document.scene.nodes.some(
        (candidate) =>
          candidate.type === "edge" &&
          candidate.id !== node.id &&
          (candidate.sourceId === node.id || candidate.targetId === node.id)
      )
    ) {
      throw new CanvasEditorError(
        "invalid-command",
        `Node is referenced by an edge and cannot be removed: ${node.id}`
      );
    }

    return compileNodeRemove(document, node, "removeEdge");
  };
}

export function removeLayer(input: RemoveLayerInput): NamedOperation {
  const parsed = parseRemoveLayerInput(input);

  return (document) => {
    const layers = document.scene.layers;
    const layer = layers.find((candidate) => candidate.id === parsed.layerId);

    if (!layer) {
      throw new CanvasEditorError(
        "layer-not-found",
        `Layer was not found: ${parsed.layerId}`
      );
    }

    if (layers.length === 1) {
      throw new CanvasEditorError(
        "invalid-command",
        "The final scene layer cannot be removed."
      );
    }

    const layerNodes = document.scene.nodes.filter(
      (node) => node.layerId === layer.id
    );

    if (
      layer.locked ||
      layerNodes.some(
        (node) => getEffectiveNodeState(document, node.id).locked
      )
    ) {
      throw new CanvasEditorError(
        "locked-target",
        `Layer removal includes a locked target: ${layer.id}`
      );
    }

    if (layerNodes.length === 0 && parsed.targetLayerId !== null) {
      throw new CanvasEditorError(
        "invalid-command",
        "Removing an empty layer requires targetLayerId: null."
      );
    }

    if (layerNodes.length > 0 && parsed.targetLayerId === null) {
      throw new CanvasEditorError(
        "invalid-command",
        "Removing a non-empty layer requires an explicit targetLayerId."
      );
    }

    const targetLayer =
      parsed.targetLayerId === null
        ? null
        : layers.find((candidate) => candidate.id === parsed.targetLayerId);

    if (parsed.targetLayerId !== null && !targetLayer) {
      throw new CanvasEditorError(
        "layer-not-found",
        `Layer was not found: ${parsed.targetLayerId}`
      );
    }

    if (targetLayer?.locked) {
      throw new CanvasEditorError(
        "locked-target",
        `Target layer is locked: ${targetLayer.id}`
      );
    }

    const command = parseLayerRemoveCommand(
      parsed.layerId,
      parsed.targetLayerId
    );

    return {
      changed: true,
      commands: [command],
      document: parseNamedOperationDocument({
        ...document,
        scene: {
          ...document.scene,
          layers: layers.filter((candidate) => candidate.id !== layer.id),
          nodes: targetLayer
            ? document.scene.nodes.map((node) =>
                node.layerId === layer.id
                  ? { ...node, layerId: targetLayer.id }
                  : node
              )
            : document.scene.nodes
        }
      } as CanvasDocument)
    };
  };
}

export function addLayer(input: AddLayerInput): NamedOperation {
  const parsed = parseAddLayerInput(input);

  return (document) => {
    const layers = document.scene.layers;

    if (layers.some((layer) => layer.id === parsed.layerId)) {
      throw new CanvasEditorError(
        "layer-already-exists",
        `Layer already exists: ${parsed.layerId}`
      );
    }

    const index = parsed.index ?? layers.length;

    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index > layers.length
    ) {
      throw new CanvasEditorError(
        "invalid-command",
        `addLayer index must be an integer between 0 and ${layers.length}.`
      );
    }

    let layer: ReturnType<typeof CanvasLayerSchema.parse>;

    try {
      layer = CanvasLayerSchema.parse({
        id: parsed.layerId,
        name: parsed.name
      });
    } catch (cause) {
      throw new CanvasEditorError(
        "invalid-command",
        "addLayer name must be a non-empty string.",
        { cause }
      );
    }

    const command = parseLayerAddCommand(layer, index);
    const nextLayers = [...layers];
    nextLayers.splice(index, 0, layer);

    return {
      changed: true,
      commands: [command],
      document: parseNamedOperationDocument({
        ...document,
        scene: {
          ...document.scene,
          layers: nextLayers
        }
      } as CanvasDocument)
    };
  };
}

export function reorderLayer(input: ReorderLayerInput): NamedOperation {
  const parsed = parseReorderLayerInput(input);

  return (document) => {
    const layers = document.scene.layers;
    const currentIndex = layers.findIndex(
      (layer) => layer.id === parsed.layerId
    );

    if (currentIndex < 0) {
      throw new CanvasEditorError(
        "layer-not-found",
        `Layer was not found: ${parsed.layerId}`
      );
    }

    if (
      !Number.isInteger(parsed.index) ||
      parsed.index < 0 ||
      parsed.index >= layers.length
    ) {
      throw new CanvasEditorError(
        "invalid-command",
        `reorderLayer index must be an integer between 0 and ${layers.length - 1}.`
      );
    }

    if (currentIndex === parsed.index) {
      return {
        changed: false,
        commands: [],
        document
      };
    }

    const command = parseLayerReorderCommand(parsed.layerId, parsed.index);
    const nextLayers = [...layers];
    const [layer] = nextLayers.splice(currentIndex, 1);

    if (!layer) {
      throw new CanvasEditorError(
        "layer-not-found",
        `Layer was not found: ${parsed.layerId}`
      );
    }

    nextLayers.splice(parsed.index, 0, layer);

    return {
      changed: true,
      commands: [command],
      document: parseNamedOperationDocument({
        ...document,
        scene: {
          ...document.scene,
          layers: nextLayers
        }
      } as CanvasDocument)
    };
  };
}

export function applyNamedOperations(
  document: CanvasDocument,
  operations: readonly NamedOperation[]
): NamedOperationResult {
  const list = parseNamedOperationList(operations, "applyNamedOperations");
  let current = document;
  const commands: CanvasCommand[] = [];

  for (const operation of list) {
    const step = operation(current);
    current = step.document;
    commands.push(...step.commands);
  }

  return {
    changed: commands.length > 0,
    commands,
    document: current
  };
}

export function parseNamedOperationList(
  operations: readonly NamedOperation[],
  caller: "apply" | "applyNamedOperations"
): readonly NamedOperation[] {
  if (!Array.isArray(operations)) {
    throw new CanvasEditorError(
      "invalid-command",
      caller === "apply"
        ? "apply expects a list. Wrap helpers: editor.apply([setLayerVisible(...)])"
        : "applyNamedOperations expects a list as the second argument. Wrap helpers: applyNamedOperations(document, [setLayerVisible(...)])"
    );
  }

  for (const operation of operations) {
    if (typeof operation !== "function") {
      throw new CanvasEditorError(
        "invalid-command",
        `${caller} items must be named operations: (document) => result.`
      );
    }
  }

  return operations;
}

function parseSetLayerVisibleInput(
  input: SetLayerVisibleInput
): SetLayerVisibleInput {
  if (!isPlainObject(input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setLayerVisible input must be an object."
    );
  }

  for (const key of Object.keys(input)) {
    if (!SET_LAYER_VISIBLE_KEYS.has(key)) {
      throw new CanvasEditorError(
        "invalid-command",
        `setLayerVisible does not accept field: ${key}`
      );
    }
  }

  if (!("layerId" in input) || !("visible" in input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setLayerVisible requires layerId and visible."
    );
  }

  if (typeof input.visible !== "boolean") {
    throw new CanvasEditorError(
      "invalid-command",
      "setLayerVisible visible must be a boolean."
    );
  }

  let layerId: CanvasLayerId;

  try {
    layerId = CanvasLayerIdSchema.parse(input.layerId);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Layer ID must be non-empty.", {
      cause
    });
  }

  return { layerId, visible: input.visible };
}

function parseSetLayerLockedInput(
  input: SetLayerLockedInput
): SetLayerLockedInput {
  if (!isPlainObject(input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setLayerLocked input must be an object."
    );
  }

  for (const key of Object.keys(input)) {
    if (!SET_LAYER_LOCKED_KEYS.has(key)) {
      throw new CanvasEditorError(
        "invalid-command",
        `setLayerLocked does not accept field: ${key}`
      );
    }
  }

  if (!("layerId" in input) || !("locked" in input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setLayerLocked requires layerId and locked."
    );
  }

  if (typeof input.locked !== "boolean") {
    throw new CanvasEditorError(
      "invalid-command",
      "setLayerLocked locked must be a boolean."
    );
  }

  let layerId: CanvasLayerId;

  try {
    layerId = CanvasLayerIdSchema.parse(input.layerId);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Layer ID must be non-empty.", {
      cause
    });
  }

  return { layerId, locked: input.locked };
}

function parseSetLayerNameInput(input: SetLayerNameInput): SetLayerNameInput {
  if (!isPlainObject(input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setLayerName input must be an object."
    );
  }

  for (const key of Object.keys(input)) {
    if (!SET_LAYER_NAME_KEYS.has(key)) {
      throw new CanvasEditorError(
        "invalid-command",
        `setLayerName does not accept field: ${key}`
      );
    }
  }

  if (!("layerId" in input) || !("name" in input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setLayerName requires layerId and name."
    );
  }

  let layerId: CanvasLayerId;

  try {
    layerId = CanvasLayerIdSchema.parse(input.layerId);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Layer ID must be non-empty.", {
      cause
    });
  }

  let name: string;

  try {
    name = CanvasLayerSchema.parse({
      id: layerId,
      name: input.name
    }).name;
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "setLayerName name must be a non-empty string.",
      { cause }
    );
  }

  return { layerId, name };
}

function parseLayerUpdateCommand(
  layerId: CanvasLayerId,
  patch:
    | { readonly visible: boolean }
    | { readonly locked: boolean }
    | { readonly name: string },
  operation: "setLayerVisible" | "setLayerLocked" | "setLayerName"
): CanvasCommand {
  try {
    return freezeValue(
      CanvasCommandSchema.parse({
        layerId,
        patch,
        type: "layer.update"
      })
    );
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      `${operation} could not compile to layer.update.`,
      { cause, commandType: "layer.update" }
    );
  }
}

function parseStackBoxInput(input: StackBoxInput): StackBoxInput {
  if (!isPlainObject(input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "stackBox input must be an object."
    );
  }

  for (const key of Object.keys(input)) {
    if (!STACK_BOX_KEYS.has(key)) {
      throw new CanvasEditorError(
        "invalid-command",
        `stackBox does not accept field: ${key}`
      );
    }
  }

  if (!("on" in input) || !("face" in input) || !("createId" in input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "stackBox requires on, face, and createId."
    );
  }

  if (!STACK_BOX_FACE_SET.has(input.face)) {
    throw new CanvasEditorError(
      "invalid-command",
      "stackBox face must be +x, -x, +y, -y, +z, or -z."
    );
  }

  if (typeof input.createId !== "function") {
    throw new CanvasEditorError(
      "invalid-command",
      "stackBox createId must be a function."
    );
  }

  let on: NodeId;

  try {
    on = NodeIdSchema.parse(input.on);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Node ID must be non-empty.", {
      cause
    });
  }

  let layerId: CanvasLayerId | undefined;

  if ("layerId" in input && input.layerId !== undefined) {
    try {
      layerId = CanvasLayerIdSchema.parse(input.layerId);
    } catch (cause) {
      throw new CanvasEditorError("invalid-id", "Layer ID must be non-empty.", {
        cause
      });
    }
  }

  return {
    createId: input.createId,
    face: input.face,
    on,
    ...(layerId === undefined ? {} : { layerId })
  };
}

function createStackedBoxId(
  createId: CanvasCreateId,
  document: CanvasDocument
): NodeId {
  let input: NodeId;

  try {
    input = createId({ document, mode: "3d", type: "box" });
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Node ID creation failed.", {
      cause
    });
  }

  try {
    return NodeIdSchema.parse(input);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Node ID must be non-empty.", {
      cause
    });
  }
}

function resolveStackedBoxPosition(
  source: CanvasNodeByType<"3d", "box">,
  face: StackBoxFace,
  scale: Vector3
): Vector3 {
  const axis = face.endsWith("x") ? 0 : face.endsWith("y") ? 1 : 2;
  const side = face.startsWith("+") ? 1 : -1;
  const position: Vector3 = [
    source.position[0],
    source.position[1],
    source.position[2]
  ];
  position[axis] =
    source.position[axis] +
    side * source.scale[axis] * 0.5 +
    side * scale[axis] * 0.5;

  if (!position.every(Number.isFinite)) {
    throw new CanvasEditorError(
      "invalid-command",
      "stackBox produced a non-finite box center."
    );
  }

  return position;
}

function isStackedBoxAlreadyInState(
  existing: CanvasDocument["scene"]["nodes"][number],
  layerId: CanvasLayerId,
  position: Vector3,
  scale: Vector3
): boolean {
  return (
    existing.type === "box" &&
    existing.layerId === layerId &&
    jsonEqual(existing.position, position) &&
    jsonEqual(existing.scale, scale) &&
    existing.rotation.every((component) => component === 0)
  );
}

function parseStackedBoxNode(node: {
  readonly color?: string;
  readonly id: NodeId;
  readonly layerId: CanvasLayerId;
  readonly position: Vector3;
  readonly rotation: Vector3;
  readonly scale: Vector3;
  readonly type: "box";
}): CanvasNodeByType<"3d", "box"> {
  try {
    return freezeValue(BoxNodeSchema.parse(node));
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "stackBox could not build a box node.",
      { cause }
    );
  }
}

function parseNodeAddCommand(node: CanvasNodeByType<"3d", "box">): CanvasCommand {
  try {
    return freezeValue(
      CanvasCommandSchema.parse({
        node,
        type: "node.add"
      })
    );
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "stackBox could not compile to node.add.",
      { cause, commandType: "node.add" }
    );
  }
}

function parseListNodesOptions(
  options: ListNodesOptions | undefined
): ListNodesOptions {
  if (options === undefined) {
    return {};
  }

  if (!isPlainObject(options)) {
    throw new CanvasEditorError(
      "invalid-command",
      "listNodes options must be an object. Use listNodes(document) or listNodes(document, { layerId })."
    );
  }

  for (const key of Object.keys(options)) {
    if (key !== "layerId") {
      throw new CanvasEditorError(
        "invalid-command",
        `listNodes does not accept field: ${key}`
      );
    }
  }

  if (!("layerId" in options) || options.layerId === undefined) {
    return {};
  }

  try {
    return { layerId: CanvasLayerIdSchema.parse(options.layerId) };
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Layer ID must be non-empty.", {
      cause
    });
  }
}

function parseSetFieldPatternInput(
  input: SetFieldPatternInput
): SetFieldPatternInput {
  if (!isPlainObject(input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setFieldPattern input must be an object."
    );
  }

  for (const key of Object.keys(input)) {
    if (!SET_FIELD_PATTERN_KEYS.has(key)) {
      throw new CanvasEditorError(
        "invalid-command",
        `setFieldPattern does not accept field: ${key}`
      );
    }
  }

  if (!("nodeId" in input) || !("pattern" in input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setFieldPattern requires nodeId and pattern."
    );
  }

  let pattern: DenovoFieldPattern;

  try {
    pattern = DenovoFieldPatternSchema.parse(input.pattern);
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "setFieldPattern pattern must be streaks or letters.",
      { cause }
    );
  }

  let nodeId: NodeId;

  try {
    nodeId = NodeIdSchema.parse(input.nodeId);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Node ID must be non-empty.", {
      cause
    });
  }

  return { nodeId, pattern };
}

function parseSetSparklineStyleInput(
  input: SetSparklineStyleInput
): SetSparklineStyleInput {
  if (!isPlainObject(input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setSparklineStyle input must be an object."
    );
  }

  for (const key of Object.keys(input)) {
    if (!SET_SPARKLINE_STYLE_KEYS.has(key)) {
      throw new CanvasEditorError(
        "invalid-command",
        `setSparklineStyle does not accept field: ${key}`
      );
    }
  }

  if (!("nodeId" in input) || !("style" in input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setSparklineStyle requires nodeId and style."
    );
  }

  let nodeId: NodeId;

  try {
    nodeId = NodeIdSchema.parse(input.nodeId);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Node ID must be non-empty.", {
      cause
    });
  }

  let style: DenovoSparklineStyle;

  try {
    style = DenovoSparklineStyleSchema.parse(input.style);
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "setSparklineStyle style must be linear or step.",
      { cause }
    );
  }

  return { nodeId, style };
}

function parseSparklineStyleUpdateCommand(
  nodeId: NodeId,
  props: ReturnType<typeof DenovoSparklinePropsSchema.parse>
): CanvasCommand {
  try {
    return freezeValue(
      CanvasCommandSchema.parse({
        nodeId,
        nodeMode: "2d",
        nodeType: DENOVO_SPARKLINE_NODE_TYPE,
        patch: { props },
        type: "node.update"
      })
    );
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "setSparklineStyle could not compile to node.update.",
      { cause, commandType: "node.update" }
    );
  }
}

function parseFieldPatternUpdateCommand(
  nodeId: NodeId,
  props: ReturnType<typeof DenovoFieldPropsSchema.parse>
): CanvasCommand {
  try {
    return freezeValue(
      CanvasCommandSchema.parse({
        nodeId,
        nodeMode: "3d",
        nodeType: DENOVO_FIELD_NODE_TYPE,
        patch: { props },
        type: "node.update"
      })
    );
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "setFieldPattern could not compile to node.update.",
      { cause, commandType: "node.update" }
    );
  }
}

function findNamedOperationNode(
  document: CanvasDocument,
  nodeId: NodeId
): CanvasNode {
  const node = document.scene.nodes.find((candidate) => candidate.id === nodeId);

  if (!node) {
    throw new CanvasEditorError(
      "node-not-found",
      `Node was not found: ${nodeId}`
    );
  }

  return node;
}

function applyNodeFlagUpdate(
  document: CanvasDocument,
  node: CanvasNode,
  patch: { readonly visible: boolean } | { readonly locked: boolean }
): NamedOperationResult {
  try {
    const command = createNodeUpdateCommand(node, patch);

    return {
      changed: true,
      commands: [command],
      document: parseNamedOperationDocument({
        ...document,
        scene: {
          ...document.scene,
          nodes: document.scene.nodes.map((candidate) =>
            candidate.id === node.id ? { ...candidate, ...patch } : candidate
          )
        }
      } as CanvasDocument)
    };
  } catch (cause) {
    if (cause instanceof CanvasEditorError) {
      throw cause;
    }

    throw new CanvasEditorError(
      "invalid-command",
      "Named operation could not compile to node.update.",
      { cause, commandType: "node.update" }
    );
  }
}

function parseSetNodeVisibleInput(
  input: SetNodeVisibleInput
): SetNodeVisibleInput {
  return parseNodeBooleanInput(input, {
    field: "visible",
    keys: SET_NODE_VISIBLE_KEYS,
    operation: "setNodeVisible"
  });
}

function parseSetNodeLockedInput(input: SetNodeLockedInput): SetNodeLockedInput {
  return parseNodeBooleanInput(input, {
    field: "locked",
    keys: SET_NODE_LOCKED_KEYS,
    operation: "setNodeLocked"
  });
}

function parseSetNodeLayerInput(input: SetNodeLayerInput): SetNodeLayerInput {
  if (!isPlainObject(input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setNodeLayer input must be an object."
    );
  }

  for (const key of Object.keys(input)) {
    if (!SET_NODE_LAYER_KEYS.has(key)) {
      throw new CanvasEditorError(
        "invalid-command",
        `setNodeLayer does not accept field: ${key}`
      );
    }
  }

  if (!("nodeId" in input) || !("layerId" in input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setNodeLayer requires nodeId and layerId."
    );
  }

  let nodeId: NodeId;

  try {
    nodeId = NodeIdSchema.parse(input.nodeId);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Node ID must be non-empty.", {
      cause
    });
  }

  let layerId: CanvasLayerId;

  try {
    layerId = CanvasLayerIdSchema.parse(input.layerId);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Layer ID must be non-empty.", {
      cause
    });
  }

  return { layerId, nodeId };
}

function applyNodeLayerUpdate(
  document: CanvasDocument,
  node: CanvasNode,
  layerId: CanvasLayerId
): NamedOperationResult {
  try {
    const command = createNodeUpdateCommand(node, { layerId });

    return {
      changed: true,
      commands: [command],
      document: parseNamedOperationDocument({
        ...document,
        scene: {
          ...document.scene,
          nodes: document.scene.nodes.map((candidate) =>
            candidate.id === node.id ? { ...candidate, layerId } : candidate
          )
        }
      } as CanvasDocument)
    };
  } catch (cause) {
    if (cause instanceof CanvasEditorError) {
      throw cause;
    }

    throw new CanvasEditorError(
      "invalid-command",
      "setNodeLayer could not compile to node.update.",
      { cause, commandType: "node.update" }
    );
  }
}

function parseSetTextInput(input: SetTextInput): SetTextInput {
  if (!isPlainObject(input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setText input must be an object."
    );
  }

  for (const key of Object.keys(input)) {
    if (!SET_TEXT_KEYS.has(key)) {
      throw new CanvasEditorError(
        "invalid-command",
        `setText does not accept field: ${key}`
      );
    }
  }

  if (!("nodeId" in input) || !("text" in input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "setText requires nodeId and text."
    );
  }

  let nodeId: NodeId;

  try {
    nodeId = NodeIdSchema.parse(input.nodeId);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Node ID must be non-empty.", {
      cause
    });
  }

  if (typeof input.text !== "string") {
    throw new CanvasEditorError(
      "invalid-command",
      "setText text must be a string."
    );
  }

  return { nodeId, text: input.text };
}

function applyNodeTextUpdate(
  document: CanvasDocument,
  node: CanvasNodeByType<"2d", "text">,
  text: string
): NamedOperationResult {
  try {
    const command = createNodeUpdateCommand(node, { text });

    return {
      changed: true,
      commands: [command],
      document: parseNamedOperationDocument({
        ...document,
        scene: {
          ...document.scene,
          nodes: document.scene.nodes.map((candidate) =>
            candidate.id === node.id ? { ...candidate, text } : candidate
          )
        }
      } as CanvasDocument)
    };
  } catch (cause) {
    if (cause instanceof CanvasEditorError) {
      throw cause;
    }

    throw new CanvasEditorError(
      "invalid-command",
      "setText could not compile to node.update.",
      { cause, commandType: "node.update" }
    );
  }
}

function parseRemoveNodeInput(input: RemoveNodeInput): RemoveNodeInput {
  return parseRemoveByNodeIdInput(input, "removeNode", REMOVE_NODE_KEYS);
}

function parseRemoveEdgeInput(input: RemoveEdgeInput): RemoveEdgeInput {
  return parseRemoveByNodeIdInput(input, "removeEdge", REMOVE_EDGE_KEYS);
}

function parseRemoveLayerInput(input: RemoveLayerInput): RemoveLayerInput {
  if (!isPlainObject(input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "removeLayer input must be an object."
    );
  }

  for (const key of Object.keys(input)) {
    if (!REMOVE_LAYER_KEYS.has(key)) {
      throw new CanvasEditorError(
        "invalid-command",
        `removeLayer does not accept field: ${key}`
      );
    }
  }

  if (!("layerId" in input) || !("targetLayerId" in input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "removeLayer requires layerId and targetLayerId."
    );
  }

  let layerId: CanvasLayerId;

  try {
    layerId = CanvasLayerIdSchema.parse(input.layerId);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Layer ID must be non-empty.", {
      cause
    });
  }

  let targetLayerId: CanvasLayerId | null;

  if (input.targetLayerId === null) {
    targetLayerId = null;
  } else {
    try {
      targetLayerId = CanvasLayerIdSchema.parse(input.targetLayerId);
    } catch (cause) {
      throw new CanvasEditorError("invalid-id", "Layer ID must be non-empty.", {
        cause
      });
    }
  }

  if (targetLayerId === layerId) {
    throw new CanvasEditorError(
      "invalid-command",
      "Layer removal target must differ from the removed layer."
    );
  }

  return { layerId, targetLayerId };
}

function parseLayerRemoveCommand(
  layerId: CanvasLayerId,
  targetLayerId: CanvasLayerId | null
): CanvasCommand {
  try {
    return freezeValue(
      CanvasCommandSchema.parse({
        layerId,
        targetLayerId,
        type: "layer.remove"
      })
    );
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "removeLayer could not compile to layer.remove.",
      { cause, commandType: "layer.remove" }
    );
  }
}

function parseAddLayerInput(input: AddLayerInput): AddLayerInput {
  if (!isPlainObject(input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "addLayer input must be an object."
    );
  }

  for (const key of Object.keys(input)) {
    if (!ADD_LAYER_KEYS.has(key)) {
      throw new CanvasEditorError(
        "invalid-command",
        `addLayer does not accept field: ${key}`
      );
    }
  }

  if (!("layerId" in input) || !("name" in input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "addLayer requires layerId and name."
    );
  }

  let layerId: CanvasLayerId;

  try {
    layerId = CanvasLayerIdSchema.parse(input.layerId);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Layer ID must be non-empty.", {
      cause
    });
  }

  let name: string;

  try {
    name = CanvasLayerSchema.parse({
      id: layerId,
      name: input.name
    }).name;
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "addLayer name must be a non-empty string.",
      { cause }
    );
  }

  if (!("index" in input) || input.index === undefined) {
    return { layerId, name };
  }

  if (!Number.isInteger(input.index) || input.index < 0) {
    throw new CanvasEditorError(
      "invalid-command",
      "addLayer index must be a non-negative integer."
    );
  }

  return { index: input.index, layerId, name };
}

function parseReorderLayerInput(input: ReorderLayerInput): ReorderLayerInput {
  if (!isPlainObject(input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "reorderLayer input must be an object."
    );
  }

  for (const key of Object.keys(input)) {
    if (!REORDER_LAYER_KEYS.has(key)) {
      throw new CanvasEditorError(
        "invalid-command",
        `reorderLayer does not accept field: ${key}`
      );
    }
  }

  if (!("layerId" in input) || !("index" in input)) {
    throw new CanvasEditorError(
      "invalid-command",
      "reorderLayer requires layerId and index."
    );
  }

  let layerId: CanvasLayerId;

  try {
    layerId = CanvasLayerIdSchema.parse(input.layerId);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Layer ID must be non-empty.", {
      cause
    });
  }

  if (!Number.isInteger(input.index) || input.index < 0) {
    throw new CanvasEditorError(
      "invalid-command",
      "reorderLayer index must be a non-negative integer."
    );
  }

  return { index: input.index, layerId };
}

function parseLayerReorderCommand(
  layerId: CanvasLayerId,
  index: number
): CanvasCommand {
  try {
    return freezeValue(
      CanvasCommandSchema.parse({
        index,
        layerId,
        type: "layer.reorder"
      })
    );
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "reorderLayer could not compile to layer.reorder.",
      { cause, commandType: "layer.reorder" }
    );
  }
}

function parseLayerAddCommand(
  layer: ReturnType<typeof CanvasLayerSchema.parse>,
  index: number
): Extract<CanvasCommand, { type: "layer.add" }> {
  try {
    return freezeValue(
      CanvasCommandSchema.parse({
        index,
        layer,
        type: "layer.add"
      })
    ) as Extract<CanvasCommand, { type: "layer.add" }>;
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "addLayer could not compile to layer.add.",
      { cause, commandType: "layer.add" }
    );
  }
}

function parseRemoveByNodeIdInput(
  input: { readonly nodeId: NodeId },
  operation: "removeNode" | "removeEdge",
  keys: ReadonlySet<string>
): { readonly nodeId: NodeId } {
  if (!isPlainObject(input)) {
    throw new CanvasEditorError(
      "invalid-command",
      `${operation} input must be an object.`
    );
  }

  for (const key of Object.keys(input)) {
    if (!keys.has(key)) {
      throw new CanvasEditorError(
        "invalid-command",
        `${operation} does not accept field: ${key}`
      );
    }
  }

  if (!("nodeId" in input)) {
    throw new CanvasEditorError(
      "invalid-command",
      `${operation} requires nodeId.`
    );
  }

  let nodeId: NodeId;

  try {
    nodeId = NodeIdSchema.parse(input.nodeId);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Node ID must be non-empty.", {
      cause
    });
  }

  return { nodeId };
}

function parseNodeRemoveCommand(
  nodeId: NodeId,
  operation: "removeNode" | "removeEdge"
): CanvasCommand {
  try {
    return freezeValue(
      CanvasCommandSchema.parse({
        nodeId,
        type: "node.remove"
      })
    );
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      `${operation} could not compile to node.remove.`,
      { cause, commandType: "node.remove" }
    );
  }
}

function compileNodeRemove(
  document: CanvasDocument,
  node: CanvasNode,
  operation: "removeNode" | "removeEdge"
): NamedOperationResult {
  const command = parseNodeRemoveCommand(node.id, operation);

  return {
    changed: true,
    commands: [command],
    document: parseNamedOperationDocument({
      ...document,
      scene: {
        ...document.scene,
        nodes: document.scene.nodes.filter(
          (candidate) => candidate.id !== node.id
        )
      }
    } as CanvasDocument)
  };
}

function parseNodeBooleanInput<TField extends "visible" | "locked">(
  input: { readonly nodeId: NodeId } & Record<TField, boolean>,
  options: {
    readonly field: TField;
    readonly keys: ReadonlySet<string>;
    readonly operation: "setNodeVisible" | "setNodeLocked";
  }
): { readonly nodeId: NodeId } & Record<TField, boolean> {
  if (!isPlainObject(input)) {
    throw new CanvasEditorError(
      "invalid-command",
      `${options.operation} input must be an object.`
    );
  }

  for (const key of Object.keys(input)) {
    if (!options.keys.has(key)) {
      throw new CanvasEditorError(
        "invalid-command",
        `${options.operation} does not accept field: ${key}`
      );
    }
  }

  if (!("nodeId" in input) || !(options.field in input)) {
    throw new CanvasEditorError(
      "invalid-command",
      `${options.operation} requires nodeId and ${options.field}.`
    );
  }

  if (typeof input[options.field] !== "boolean") {
    throw new CanvasEditorError(
      "invalid-command",
      `${options.operation} ${options.field} must be a boolean.`
    );
  }

  let nodeId: NodeId;

  try {
    nodeId = NodeIdSchema.parse(input.nodeId);
  } catch (cause) {
    throw new CanvasEditorError("invalid-id", "Node ID must be non-empty.", {
      cause
    });
  }

  return {
    nodeId,
    [options.field]: input[options.field]
  } as { readonly nodeId: NodeId } & Record<TField, boolean>;
}

function parseNamedOperationDocument(document: CanvasDocument): CanvasDocument {
  try {
    return freezeValue(CanvasDocumentSchema.parse(document));
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-document",
      "Named operation document validation failed.",
      { cause }
    );
  }
}
