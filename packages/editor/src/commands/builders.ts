import {
  Canvas2DNodeSchema,
  Canvas3DNodeSchema,
  CanvasCommandSchema,
  type Canvas2DNode,
  type Canvas3DNode,
  type CanvasCommand,
  type CanvasNode,
  type CanvasNodeIdentity,
  type CanvasNodeIdentityFor,
  type CanvasNodePatch,
  type CanvasNodePatchFor
} from "@de-novo/canvas-core";
import { CanvasEditorError } from "../errors.js";
import { freezeValue, isPlainObject } from "../utils.js";

export type CanvasNodeUpdateCommand = Extract<
  CanvasCommand,
  { type: "node.update" }
>;

export type CanvasNodeUpdateCommandFor<TNode extends CanvasNode> =
  CanvasNodeUpdateCommand & CanvasNodeIdentityFor<TNode>;

export type CanvasTransactionCommand = Extract<
  CanvasCommand,
  { type: "transaction" }
>;

export type IdentifiedCanvasNode =
  | {
      readonly identity: Extract<CanvasNodeIdentity, { nodeMode: "2d" }>;
      readonly node: Canvas2DNode;
    }
  | {
      readonly identity: Extract<CanvasNodeIdentity, { nodeMode: "3d" }>;
      readonly node: Canvas3DNode;
    };

export function createNodeUpdateCommand<TNode extends CanvasNode>(
  node: TNode,
  patch: CanvasNodePatchFor<TNode>
): CanvasNodeUpdateCommandFor<TNode> {
  return createValidatedNodeUpdateCommand(
    node,
    patch as CanvasNodePatch
  ) as CanvasNodeUpdateCommandFor<TNode>;
}

export function createValidatedNodeUpdateCommand(
  nodeInput: CanvasNode,
  patch: CanvasNodePatch
): CanvasNodeUpdateCommand {
  const source = identifyCanvasNode(nodeInput);
  const node = source.node;

  if (!isPlainObject(patch) || Object.keys(patch).length === 0) {
    throw new CanvasEditorError(
      "invalid-command",
      "node.update patch must be a non-empty object.",
      { commandType: "node.update" }
    );
  }

  if ("id" in patch || "type" in patch) {
    throw new CanvasEditorError(
      "immutable-node-field",
      "node.update cannot change node id or type.",
      { commandType: "node.update" }
    );
  }

  for (const [field, value] of Object.entries(patch)) {
    if (!(field in node) || value === undefined) {
      throw new CanvasEditorError(
        "invalid-command",
        `Invalid ${node.type} patch field: ${field}`,
        { commandType: "node.update" }
      );
    }
  }

  try {
    const merged =
      source.identity.nodeMode === "2d"
        ? Canvas2DNodeSchema.parse({ ...node, ...patch })
        : Canvas3DNodeSchema.parse({ ...node, ...patch });

    if (
      merged.id !== node.id ||
      merged.type !== node.type ||
      merged.type !== source.identity.nodeType
    ) {
      throw new CanvasEditorError(
        "immutable-node-field",
        "node.update cannot change node id or type.",
        { commandType: "node.update" }
      );
    }

    return freezeValue(
      CanvasCommandSchema.parse({
        ...source.identity,
        nodeId: node.id,
        patch,
        type: "node.update"
      }) as CanvasNodeUpdateCommand
    );
  } catch (cause) {
    if (cause instanceof CanvasEditorError) {
      throw cause;
    }

    throw new CanvasEditorError(
      "invalid-command",
      `Invalid ${node.type} update patch.`,
      { cause, commandType: "node.update" }
    );
  }
}

export function identifyCanvasNode(nodeInput: CanvasNode): IdentifiedCanvasNode {
  const node2d = Canvas2DNodeSchema.safeParse(nodeInput);

  if (node2d.success) {
    return {
      identity: { nodeMode: "2d", nodeType: node2d.data.type },
      node: node2d.data
    };
  }

  const node3d = Canvas3DNodeSchema.safeParse(nodeInput);

  if (node3d.success) {
    return {
      identity: { nodeMode: "3d", nodeType: node3d.data.type },
      node: node3d.data
    };
  }

  throw new CanvasEditorError(
    "invalid-command",
    "Source node validation failed.",
    {
      cause: {
        node2d: node2d.error,
        node3d: node3d.error
      },
      commandType: "node.update"
    }
  );
}

export function getNodeIdentity(node: CanvasNode): CanvasNodeIdentity {
  return identifyCanvasNode(node).identity;
}

export function getNodeInputId(node: unknown): string | null {
  return isPlainObject(node) && typeof node.id === "string" ? node.id : null;
}