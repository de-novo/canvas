import {
  CanvasToolInputSchema,
  type CanvasCommand,
  type CanvasStorageAdapter,
  type CanvasSaveResult,
  type CanvasCommandResult,
  type CanvasCreateId,
  type CanvasDocument,
  type CanvasDocumentInput,
  type CanvasHitResult,
  type CanvasLayoutAdapter,
  type CanvasNode,
  type CanvasRectBounds,
  type Point2,
  type CanvasPluginCommandDescriptor,
  type CanvasPluginCommandHandler,
  type CanvasPluginCommandType,
  type CanvasSelectionMode,
  type CanvasToolContext,
  type CanvasToolDefinition,
  type CanvasToolInput,
  type JsonValue,
  type NodeId,
  type SelectionState,
  type SelectionStateInput
} from "@denovo/canvas-core";
import { Cause, Effect, Either, Option } from "effect";
import { CanvasEditorError } from "./errors.js";
import type {
  ApplyCommandResult,
  EditorEffect,
  EditorSnapshot,
  RegisteredPluginCommand
} from "./internal-types.js";
import { freezeValue, isPlainObject, uniqueIds } from "./utils.js";
import { resolveEffectiveNodeState } from "./node-state.js";
import {
  getHitNodeId,
  getSelectionFromHit,
  parseHitResultEffect,
  parseSelectionModeEffect,
  readonlyStringsEqual,
  sanitizeSelectionForDocument,
  selectionsEqual
} from "./parsers.js";
import {
  applyCommandEffect,
  applySelectionEffect,
  createInitialSnapshot,
  getCommandTimestampEffect,
  getCommandTypeEffect
} from "./commands/handlers.js";
import {
  assertPluginCommandRegistration,
  assertToolDefinition,
  cloneCommand,
  createRegisteredPluginCommand,
  runEditorEffect
} from "./runtime.js";
import { takeAuthoringDeactivationCleanups } from "./authoring/coordinator.js";

export type CanvasEditorHistoryState = {
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  readonly redoDepth: number;
  readonly undoDepth: number;
};

export type CanvasEditorState = {
  readonly activeToolId: string | null;
  readonly document: CanvasDocument;
  readonly history: CanvasEditorHistoryState;
  readonly selection: SelectionState;
};

export type CanvasEditorHistoryEntry = {
  readonly affectedNodeIds: readonly NodeId[];
  readonly command: CanvasCommand;
  readonly label: string;
  readonly timestamp: string;
};

export type CanvasEditorDispatchResult = CanvasCommandResult & {
  readonly affectedNodeIds: readonly NodeId[];
  readonly historyChanged: boolean;
  readonly selection: SelectionState;
};

export type CanvasEditorChange =
  | {
      readonly affectedNodeIds: readonly NodeId[];
      readonly command: CanvasCommand;
      readonly type: "dispatch";
    }
  | {
      readonly entry: CanvasEditorHistoryEntry;
      readonly type: "redo" | "undo";
    }
  | {
      readonly activeToolId: string | null;
      readonly previousToolId: string | null;
      readonly type: "tool.activate";
    };

export type CanvasEditorListener = (
  state: CanvasEditorState,
  change: CanvasEditorChange
) => void;

/**
 * Persistence event emitted by the editor so a storage bridge can derive
 * patches, debounce saves, and reconcile conflicts without coupling the editor
 * to a storage adapter.
 */
export type CanvasPersistenceEvent =
  | {
      readonly type: "transaction.committed";
      readonly documentId: NodeId;
      readonly baseRevision: number;
      readonly revision: number;
      readonly command: CanvasCommand;
      readonly inverseCommand?: CanvasCommand;
    }
  | {
      /**
       * Undo or redo restored a historical snapshot. The editor does not
       * increment `baseRevision` here; `connectEditorToStorage` flushes the
       * restored document and advances the acknowledged revision on save.
       */
      readonly type: "history.changed";
      readonly documentId: NodeId;
      readonly action: "undo" | "redo";
      readonly revision: number;
    }
  | {
      readonly type: "revision.changed";
      readonly documentId: NodeId;
      readonly revision: number;
    };

export type CanvasPersistenceListener = (
  event: CanvasPersistenceEvent
) => void;

export type CreateCanvasEditorOptions = {
  readonly activeToolId?: string | null;
  readonly baseRevision?: number;
  readonly document: CanvasDocumentInput;
  readonly documentId?: NodeId;
  readonly historyLimit?: number;
  readonly now?: () => string;
  readonly onError?: (error: CanvasEditorError) => void;
  readonly selection?: SelectionStateInput;
  readonly tools?: readonly CanvasToolDefinition[];
};

export type CanvasEditorToolRuntimeContext = Readonly<
  Pick<
    CanvasToolContext,
    | "getNodesInBounds"
    | "resolveNodeBounds"
    | "hitTest"
    | "nodeTransformKinds"
    | "resolveNodeTransform"
    | "resolveScenePoint"
    | "resolveSurfacePoint"
    | "setAuthoringPreviews"
    | "setNodeTransformPreview"
  >
>;

export type CanvasEditor = {
  activateTool: (toolId: string | null) => CanvasToolDefinition | null;
  canRedo: () => boolean;
  canUndo: () => boolean;
  cancelActiveToolSession: () => Promise<void>;
  /**
   * Runs a registered layout adapter, committing its placements as a single
   * undoable transaction.
   */
  applyLayout: (
    adapterName: string,
    options?: CanvasApplyLayoutOptions
  ) => Promise<CanvasApplyLayoutResult>;
  getLayoutAdapters: () => readonly CanvasLayoutAdapter[];
  registerLayoutAdapter: (adapter: CanvasLayoutAdapter) => () => void;
  /** Copies the current selection into the in-memory clipboard. */
  copySelection: () => readonly CanvasNode[];
  /**
   * Re-adds the clipboard contents with fresh ids, offset so the copies are
   * visible, and selects them. Returns the ids that were added.
   */
  pasteClipboard: (
    createId: CanvasCreateId,
    offset?: readonly [number, number]
  ) => Promise<readonly NodeId[]>;
  dispatch: (command: CanvasCommand) => Promise<CanvasEditorDispatchResult>;
  getState: () => CanvasEditorState;
  getActiveTool: () => CanvasToolDefinition | null;
  getTools: () => readonly CanvasToolDefinition[];
  handleToolInput: (
    input: CanvasToolInput,
    runtime?: CanvasEditorToolRuntimeContext
  ) => Promise<boolean>;
  hoverFromHit: (
    hit: CanvasHitResult
  ) => Promise<CanvasEditorDispatchResult | null>;
  redo: () => Promise<CanvasEditorHistoryEntry | null>;
  registerCommand: <
    TType extends CanvasPluginCommandType,
    TPayload
  >(
    descriptor: CanvasPluginCommandDescriptor<TType, TPayload>,
    handler: CanvasPluginCommandHandler<TType, TPayload>
  ) => () => void;
  registerTool: (definition: CanvasToolDefinition) => () => void;
  selectFromHit: (
    hit: CanvasHitResult,
    mode?: CanvasSelectionMode
  ) => Promise<CanvasEditorDispatchResult | null>;
  subscribe: (listener: CanvasEditorListener) => () => void;
  subscribePersistence: (listener: CanvasPersistenceListener) => () => void;
  getDocumentId: () => NodeId;
  getBaseRevision: () => number;
  setBaseRevision: (revision: number) => void;
  undo: () => Promise<CanvasEditorHistoryEntry | null>;
};

export type CanvasApplyLayoutOptions = {
  /** Nodes to lay out. Defaults to the selection for `arrange` adapters. */
  readonly nodeIds?: readonly NodeId[];
  /** Passed through to the adapter untouched. */
  readonly options?: JsonValue;
  /**
   * Supplies node bounds explicitly. Layout otherwise borrows the geometry
   * capability the renderer last provided through tool input, which is only
   * present once a tool has run — pass this when calling layout directly.
   */
  readonly resolveNodeBounds?: (
    ids: readonly NodeId[]
  ) => ReadonlyMap<NodeId, CanvasRectBounds>;
};

export type CanvasApplyLayoutResult = {
  /** `false` when no renderer geometry was available to measure bounds. */
  readonly measured: boolean;
  readonly movedNodeIds: readonly NodeId[];
};

/** Node types that carry a `position` and can therefore be laid out. */
function isPositionableNode(node: CanvasNode): boolean {
  return (
    node.type === "rect" ||
    node.type === "circle" ||
    node.type === "group" ||
    node.type === "text" ||
    node.type === "html" ||
    node.type === "box" ||
    node.type === "sphere" ||
    node.type === "mesh" ||
    node.type === "instances"
  );
}

export type CanvasEditorRuntimeTarget = {
  update: (scene: CanvasDocument["scene"]) => CanvasDocument["scene"] | void;
};

type InternalHistoryEntry = CanvasEditorHistoryEntry & {
  readonly after: EditorSnapshot;
  readonly before: EditorSnapshot;
};


function toPublicHistoryEntry(
  entry: InternalHistoryEntry
): CanvasEditorHistoryEntry {
  return freezeValue({
    affectedNodeIds: [...entry.affectedNodeIds],
    command: entry.command,
    label: entry.label,
    timestamp: entry.timestamp
  });
}


export function createEditor(options: CreateCanvasEditorOptions): CanvasEditor {
  const historyLimit = options.historyLimit ?? 100;

  if (!Number.isInteger(historyLimit) || historyLimit < 1) {
    throw new CanvasEditorError(
      "invalid-command",
      "historyLimit must be a positive integer."
    );
  }

  let snapshot = createInitialSnapshot(options.document, options.selection);
  let history: InternalHistoryEntry[] = [];
  let historyIndex = 0;
  let operationQueue: Promise<void> = Promise.resolve();
  let toolInputQueue: Promise<void> = Promise.resolve();
  let toolInputGeneration = 0;
  let activeToolRuntimeContext: CanvasEditorToolRuntimeContext = {};
  let activeToolId = options.activeToolId ?? null;
  let deferredToolCleanupError: CanvasEditorError | null = null;
  const commandHandlers = new Map<
    CanvasPluginCommandType,
    RegisteredPluginCommand
  >();
  const listeners = new Set<CanvasEditorListener>();
  const persistenceListeners = new Set<CanvasPersistenceListener>();
  const documentId: NodeId = options.documentId ?? snapshot.document.id;
  let baseRevision: number =
    options.baseRevision ?? snapshot.document.revision ?? 0;
  const now = options.now ?? (() => new Date().toISOString());
  const onError = options.onError;
  const tools = new Map<string, CanvasToolDefinition>();

  for (const tool of options.tools ?? []) {
    assertToolDefinition(tool);

    if (tools.has(tool.id)) {
      throw new CanvasEditorError(
        "invalid-command",
        `Tool is already registered: ${tool.id}`
      );
    }

    tools.set(tool.id, freezeValue({ ...tool }));
  }

  if (activeToolId !== null && !tools.has(activeToolId)) {
    throw new CanvasEditorError(
      "tool-not-found",
      `Active tool is not registered: ${activeToolId}`
    );
  }

  function getState(): CanvasEditorState {
    return freezeValue({
      activeToolId,
      document: snapshot.document,
      history: {
        canRedo: historyIndex < history.length,
        canUndo: historyIndex > 0,
        redoDepth: history.length - historyIndex,
        undoDepth: historyIndex
      },
      selection: snapshot.selection
    });
  }

  function notifyPersistence(event: CanvasPersistenceEvent) {
    for (const listener of persistenceListeners) {
      try {
        listener(event);
      } catch {
        // Persistence listeners must never break the editor hot path.
      }
    }
  }

  function notify(change: CanvasEditorChange) {
    const state = getState();

    for (const listener of listeners) {
      try {
        listener(state, change);
      } catch (cause) {
        try {
          onError?.(
            new CanvasEditorError(
              "subscriber-failed",
              "Editor subscriber failed after an edit was committed.",
              { cause }
            )
          );
        } catch {
          // Error observers cannot roll back an already committed edit.
        }
      }
    }
  }

  function getActiveTool(): CanvasToolDefinition | null {
    return activeToolId === null ? null : (tools.get(activeToolId) ?? null);
  }

  function activateTool(toolId: string | null): CanvasToolDefinition | null {
    if (toolId !== null && !tools.has(toolId)) {
      throw new CanvasEditorError(
        "tool-not-found",
        `Tool is not registered: ${toolId}`
      );
    }

    if (toolId === activeToolId) {
      return getActiveTool();
    }

    const previousTool = getActiveTool();

    if (previousTool) {
      observeToolCleanup(deactivateTool(previousTool));
    }

    toolInputGeneration += 1;
    toolInputQueue = Promise.resolve();
    activeToolRuntimeContext = {};

    const previousToolId = activeToolId;
    activeToolId = toolId;
    notify({
      activeToolId,
      previousToolId,
      type: "tool.activate"
    });
    return getActiveTool();
  }

  function deactivateTool(tool: CanvasToolDefinition): Promise<void> {
    let deactivationError: CanvasEditorError | null = null;

    try {
      tool.onDeactivate?.(toolContext);
    } catch (cause) {
      deactivationError =
        cause instanceof CanvasEditorError
          ? cause
          : new CanvasEditorError(
              "tool-handler-failed",
              `Tool deactivation failed: ${tool.id}`,
              { cause }
            );
    }

    const cleanups = takeAuthoringDeactivationCleanups(toolContext);
    return Promise.allSettled(cleanups).then((results) => {
      if (deactivationError) {
        throw deactivationError;
      }

      const failed = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );

      if (failed) {
        throw failed.reason instanceof CanvasEditorError
          ? failed.reason
          : new CanvasEditorError(
              "tool-handler-failed",
              `Tool deactivation failed: ${tool.id}`,
              { cause: failed.reason }
            );
      }
    });
  }

  function observeToolCleanup(cleanup: Promise<void>): void {
    void cleanup.then(
      () => undefined,
      (cause: unknown) => {
        const error =
          cause instanceof CanvasEditorError
            ? cause
            : new CanvasEditorError(
                "tool-handler-failed",
                "Tool cleanup failed.",
                { cause }
              );

        if (onError) {
          try {
            onError(error);
            return;
          } catch (reporterCause) {
            deferredToolCleanupError = new CanvasEditorError(
              "tool-handler-failed",
              "The editor error observer failed while reporting tool cleanup.",
              { cause: reporterCause }
            );
            return;
          }
        }

        deferredToolCleanupError = error;
      }
    );
  }

  function cancelActiveToolSession(): Promise<void> {
    const tool = getActiveTool();
    const deferredError = deferredToolCleanupError;
    deferredToolCleanupError = null;
    const cleanup = tool ? deactivateTool(tool) : Promise.resolve();

    toolInputGeneration += 1;
    toolInputQueue = Promise.resolve();
    activeToolRuntimeContext = {};

    return cleanup.then(() => {
      if (deferredError) {
        throw deferredError;
      }
    });
  }

  const toolContext: CanvasToolContext = {
    activateTool(toolId) {
      activateTool(toolId);
    },
    dispatch: dispatchFromTool,
    getDocument: () => snapshot.document,
    get getNodesInBounds() {
      return activeToolRuntimeContext.getNodesInBounds;
    },
    get resolveNodeBounds() {
      return activeToolRuntimeContext.resolveNodeBounds;
    },
    get hitTest() {
      return activeToolRuntimeContext.hitTest;
    },
    hoverFromHit,
    get nodeTransformKinds() {
      return activeToolRuntimeContext.nodeTransformKinds;
    },
    get resolveNodeTransform() {
      return activeToolRuntimeContext.resolveNodeTransform;
    },
    get resolveScenePoint() {
      return activeToolRuntimeContext.resolveScenePoint;
    },
    get resolveSurfacePoint() {
      return activeToolRuntimeContext.resolveSurfacePoint;
    },
    selectFromHit,
    get setAuthoringPreviews() {
      return activeToolRuntimeContext.setAuthoringPreviews;
    },
    get setNodeTransformPreview() {
      return activeToolRuntimeContext.setNodeTransformPreview;
    },
    getSelection: () => snapshot.selection
  };

  function handleToolInput(
    input: CanvasToolInput,
    runtime: CanvasEditorToolRuntimeContext = {}
  ): Promise<boolean> {
    let stableInput: CanvasToolInput;

    try {
      stableInput = freezeValue(CanvasToolInputSchema.parse(input));
    } catch (cause) {
      return Promise.reject(
        new CanvasEditorError(
          "invalid-tool-input",
          "Canvas tool input validation failed.",
          { cause }
        )
      );
    }

    const toolId = activeToolId;
    const tool = toolId === null ? null : (tools.get(toolId) ?? null);
    const handler = tool?.onInput;
    const generation = toolInputGeneration;

    if (!toolId || !tool || !handler) {
      return Promise.resolve(false);
    }

    const run = async () => {
      if (
        generation !== toolInputGeneration ||
        activeToolId !== toolId ||
        tools.get(toolId) !== tool
      ) {
        return false;
      }

      const runtimeChanged =
        activeToolRuntimeContext.hitTest !== runtime.hitTest ||
        !readonlyStringsEqual(
          activeToolRuntimeContext.nodeTransformKinds,
          runtime.nodeTransformKinds
        ) ||
        activeToolRuntimeContext.resolveNodeTransform !==
          runtime.resolveNodeTransform ||
        activeToolRuntimeContext.resolveScenePoint !== runtime.resolveScenePoint ||
        activeToolRuntimeContext.resolveSurfacePoint !==
          runtime.resolveSurfacePoint ||
        activeToolRuntimeContext.setAuthoringPreviews !==
          runtime.setAuthoringPreviews ||
        activeToolRuntimeContext.setNodeTransformPreview !==
          runtime.setNodeTransformPreview;

      if (runtimeChanged) {
        await deactivateTool(tool);
      }

      activeToolRuntimeContext = runtime;

      return runEditorEffect(
        Effect.tryPromise({
          try: () =>
            Promise.resolve(handler(stableInput, toolContext)).then(
              () => true
            ),
          catch: (cause) =>
            cause instanceof CanvasEditorError
              ? cause
              : new CanvasEditorError(
                  "tool-handler-failed",
                  `Tool input handler failed: ${toolId}`,
                  { cause }
                )
        })
      );
    };
    const result = toolInputQueue.then(run, run);
    toolInputQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  function enqueue<Value>(operation: () => EditorEffect<Value>): Promise<Value> {
    const result = operationQueue.then(
      () => runEditorEffect(operation()),
      () => runEditorEffect(operation())
    );
    operationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }

  function dispatch(command: CanvasCommand): Promise<CanvasEditorDispatchResult> {
    return dispatchCommand(command, false);
  }

  function dispatchFromTool(
    command: CanvasCommand
  ): Promise<CanvasEditorDispatchResult> {
    return dispatchCommand(command, true);
  }

  function dispatchCommand(
    command: CanvasCommand,
    preserveToolSession: boolean
  ): Promise<CanvasEditorDispatchResult> {
    let stableCommand: CanvasCommand;

    try {
      stableCommand = cloneCommand(command);
    } catch (cause) {
      return Promise.reject(
        cause instanceof CanvasEditorError
          ? cause
          : new CanvasEditorError(
              "invalid-command",
              "Command must be JSON-serializable.",
              { cause }
            )
      );
    }

    return enqueue(() =>
      Effect.gen(function* () {
        const normalizedType = yield* getCommandTypeEffect(stableCommand);
        const before = snapshot;
        const timestamp = yield* getCommandTimestampEffect(stableCommand, now);
        const applied = yield* applyCommandEffect(
          stableCommand,
          before,
          timestamp,
          commandHandlers
        );

        if (applied.persistent && !preserveToolSession) {
          const activeTool = getActiveTool();

          if (activeTool) {
            observeToolCleanup(deactivateTool(activeTool));
          }
        }

        snapshot = applied.snapshot;
        let historyChanged = false;

        if (applied.persistent) {
          history = history.slice(0, historyIndex);
          history.push(
            freezeValue({
              affectedNodeIds: [...applied.affectedNodeIds],
              after: applied.snapshot,
              before,
              command: stableCommand,
              label: stableCommand.label ?? normalizedType,
              timestamp
            })
          );

          if (history.length > historyLimit) {
            history = history.slice(history.length - historyLimit);
          }

          historyIndex = history.length;
          historyChanged = true;

          const previousRevision = baseRevision;
          const committedRevision = previousRevision + 1;
          baseRevision = committedRevision;
          notifyPersistence({
            type: "transaction.committed",
            documentId,
            baseRevision: previousRevision,
            revision: committedRevision,
            command: stableCommand,
            ...(applied.inverse === undefined
              ? {}
              : { inverseCommand: applied.inverse })
          });
        }

        notify({
          affectedNodeIds: applied.affectedNodeIds,
          command: stableCommand,
          type: "dispatch"
        });

        return freezeValue({
          affectedNodeIds: [...applied.affectedNodeIds],
          document: snapshot.document,
          historyChanged,
          ...(applied.inverse === undefined ? {} : { inverse: applied.inverse }),
          selection: snapshot.selection
        });
      })
    );
  }

  function applyTransientSelection(
    selection: SelectionState
  ): EditorEffect<CanvasEditorDispatchResult> {
    return Effect.gen(function* () {
      const command = freezeValue({
        selection,
        type: "selection.set" as const
      });
      const applied = yield* applySelectionEffect(command, snapshot);
      snapshot = applied.snapshot;
      notify({
        affectedNodeIds: applied.affectedNodeIds,
        command,
        type: "dispatch"
      });
      return freezeValue({
        affectedNodeIds: [...applied.affectedNodeIds],
        document: snapshot.document,
        historyChanged: false,
        ...(applied.inverse === undefined ? {} : { inverse: applied.inverse }),
        selection: snapshot.selection
      });
    });
  }

  function hoverFromHit(
    hitInput: CanvasHitResult
  ): Promise<CanvasEditorDispatchResult | null> {
    return enqueue(() =>
      Effect.gen(function* () {
        const hit = yield* parseHitResultEffect(hitInput);
        const hoveredId = getHitNodeId(hit);

        if (hoveredId) {
          const state = resolveEffectiveNodeState(snapshot.document, hoveredId);

          if (!state.visible) {
            return null;
          }
        }

        if (hoveredId === snapshot.selection.hoveredId) {
          return null;
        }

        return yield* applyTransientSelection({
          ...snapshot.selection,
          hoveredId
        });
      })
    );
  }

  function selectFromHit(
    hitInput: CanvasHitResult,
    modeInput: CanvasSelectionMode = "replace"
  ): Promise<CanvasEditorDispatchResult | null> {
    return enqueue(() =>
      Effect.gen(function* () {
        const hit = yield* parseHitResultEffect(hitInput);
        const mode = yield* parseSelectionModeEffect(modeInput);
        const nodeId = getHitNodeId(hit);

        if (nodeId) {
          if (!snapshot.document.scene.nodes.some((node) => node.id === nodeId)) {
            return yield* Effect.fail(
              new CanvasEditorError(
                "invalid-selection",
                `Selection references missing node: ${nodeId}`
              )
            );
          }

          if ("subTarget" in hit && hit.subTarget === "locked") {
            return yield* Effect.fail(
              new CanvasEditorError(
                "locked-target",
                `Renderer hit is explicitly locked: ${nodeId}`
              )
            );
          }

          const state = resolveEffectiveNodeState(snapshot.document, nodeId);

          if (state.locked) {
            return yield* Effect.fail(
              new CanvasEditorError(
                "locked-target",
                `Node is effectively locked: ${nodeId}`
              )
            );
          }

          if (!state.visible) {
            return yield* Effect.fail(
              new CanvasEditorError(
                "invalid-selection",
                `Hidden node cannot be selected: ${nodeId}`
              )
            );
          }
        }

        const selection = getSelectionFromHit(hit, snapshot.selection, mode);

        if (!selection || selectionsEqual(selection, snapshot.selection)) {
          return null;
        }

        return yield* applyTransientSelection(selection);
      })
    );
  }

  function undo(): Promise<CanvasEditorHistoryEntry | null> {
    return enqueue(() =>
      Effect.gen(function* () {
        if (historyIndex === 0) {
          return null;
        }

        const entry = history[historyIndex - 1];

        if (!entry) {
          return yield* Effect.fail(
            new CanvasEditorError(
              "internal-error",
              "Undo history index is inconsistent."
            )
          );
        }

        const activeTool = getActiveTool();

        if (activeTool) {
          observeToolCleanup(deactivateTool(activeTool));
        }

        historyIndex -= 1;
        snapshot = entry.before;
        notifyPersistence({
          type: "history.changed",
          documentId,
          action: "undo",
          revision: baseRevision
        });
        notify({ entry: toPublicHistoryEntry(entry), type: "undo" });
        return toPublicHistoryEntry(entry);
      })
    );
  }

  function redo(): Promise<CanvasEditorHistoryEntry | null> {
    return enqueue(() =>
      Effect.sync(() => {
        const entry = history[historyIndex];

        if (!entry) {
          return null;
        }

        const activeTool = getActiveTool();

        if (activeTool) {
          observeToolCleanup(deactivateTool(activeTool));
        }

        historyIndex += 1;
        snapshot = entry.after;
        notifyPersistence({
          type: "history.changed",
          documentId,
          action: "redo",
          revision: baseRevision
        });
        notify({ entry: toPublicHistoryEntry(entry), type: "redo" });
        return toPublicHistoryEntry(entry);
      })
    );
  }

  /**
   * In-memory clipboard. Deliberately not backed by the OS clipboard: pasting
   * across documents needs id remapping for group/edge references, which is a
   * separate concern from same-document duplication.
   */
  let clipboard: readonly CanvasNode[] = [];

  const layoutAdapters = new Map<string, CanvasLayoutAdapter>();

  function registerLayoutAdapter(adapter: CanvasLayoutAdapter): () => void {
    if (typeof adapter?.name !== "string" || adapter.name.length === 0) {
      throw new CanvasEditorError(
        "invalid-command",
        "A layout adapter requires a non-empty name."
      );
    }

    if (adapter.kind !== "arrange" && adapter.kind !== "layout") {
      throw new CanvasEditorError(
        "invalid-command",
        `Layout adapter kind must be arrange or layout: ${adapter.name}`
      );
    }

    if (typeof adapter.apply !== "function") {
      throw new CanvasEditorError(
        "invalid-command",
        `Layout adapter must provide an apply function: ${adapter.name}`
      );
    }

    if (layoutAdapters.has(adapter.name)) {
      throw new CanvasEditorError(
        "invalid-command",
        `Layout adapter is already registered: ${adapter.name}`
      );
    }

    const registered = freezeValue({ ...adapter });
    layoutAdapters.set(adapter.name, registered);

    return () => {
      if (layoutAdapters.get(adapter.name) === registered) {
        layoutAdapters.delete(adapter.name);
      }
    };
  }

  function getLayoutAdapters(): readonly CanvasLayoutAdapter[] {
    return freezeValue([...layoutAdapters.values()]);
  }

  /**
   * Runs a registered adapter and commits its placements as one transaction, so
   * a multi-node arrange is a single undo step.
   *
   * `arrange` adapters operate on the current selection (or `options.nodeIds`);
   * `layout` adapters default to every positionable node in the scene.
   */
  async function applyLayout(
    adapterName: string,
    options: CanvasApplyLayoutOptions = {}
  ): Promise<CanvasApplyLayoutResult> {
    const adapter = layoutAdapters.get(adapterName);

    if (!adapter) {
      throw new CanvasEditorError(
        "invalid-command",
        `Unknown layout adapter: ${adapterName}`
      );
    }

    const scene = snapshot.document.scene;
    const requestedIds =
      options.nodeIds ??
      (adapter.kind === "arrange" ? snapshot.selection.ids : null);

    // Only nodes that carry a position can be moved; edges, measurements and
    // annotations are anchored to other things and must be left alone.
    const candidates = scene.nodes.filter(
      (node) =>
        isPositionableNode(node) &&
        (requestedIds === null || requestedIds.includes(node.id))
    );

    if (candidates.length === 0) {
      return { measured: false, movedNodeIds: [] };
    }

    const resolveBounds =
      options.resolveNodeBounds ?? activeToolRuntimeContext.resolveNodeBounds;
    const boundsById =
      resolveBounds?.(candidates.map((node) => node.id)) ?? null;
    const measured = boundsById !== null;

    const layoutNodes = candidates.map((node) => {
      const position = (node as { position: Point2 }).position;
      const bounds = boundsById?.get(node.id) ?? {
        minX: position[0],
        minY: position[1],
        maxX: position[0],
        maxY: position[1]
      };

      return { id: node.id, type: node.type, position, bounds };
    });

    const result = adapter.apply({
      nodes: layoutNodes,
      edges: scene.nodes
        .filter((node) => node.type === "edge")
        .map((node) => {
          const edge = node as unknown as {
            id: NodeId;
            sourceId: NodeId;
            targetId: NodeId;
          };
          return {
            id: edge.id,
            sourceId: edge.sourceId,
            targetId: edge.targetId
          };
        }),
      measured,
      ...(options.options === undefined ? {} : { options: options.options })
    });

    const known = new Map(candidates.map((node) => [node.id, node]));
    const commands: CanvasCommand[] = [];

    for (const placement of result.positions) {
      const node = known.get(placement.id);

      if (!node) {
        throw new CanvasEditorError(
          "invalid-command",
          `Layout adapter ${adapter.name} returned an unknown node: ${placement.id}`
        );
      }

      commands.push({
        label: adapter.label ?? adapter.name,
        nodeId: placement.id,
        nodeMode: scene.mode,
        nodeType: node.type,
        patch: { position: placement.position },
        type: "node.update"
      } as CanvasCommand);
    }

    if (commands.length === 0) {
      return { measured, movedNodeIds: [] };
    }

    await dispatch({
      commands,
      label: adapter.label ?? adapter.name,
      type: "transaction"
    } as CanvasCommand);

    return {
      measured,
      movedNodeIds: result.positions.map((placement) => placement.id)
    };
  }

  function copySelection(): readonly CanvasNode[] {
    const selected = new Set(snapshot.selection.ids);
    clipboard = snapshot.document.scene.nodes.filter((node) =>
      selected.has(node.id)
    );
    return clipboard;
  }

  async function pasteClipboard(
    createId: CanvasCreateId,
    offset: readonly [number, number] = [24, 24]
  ): Promise<readonly NodeId[]> {
    if (clipboard.length === 0) {
      return [];
    }

    const idMap = new Map<NodeId, NodeId>();
    let documentForIds = snapshot.document;

    for (const node of clipboard) {
      const nextId = createId({
        document: documentForIds,
        mode: documentForIds.scene.mode,
        type: node.type
      } as Parameters<CanvasCreateId>[0]);
      idMap.set(node.id, nextId);
      documentForIds = {
        ...documentForIds,
        scene: {
          ...documentForIds.scene,
          nodes: [...documentForIds.scene.nodes, { ...node, id: nextId }]
        }
      } as CanvasDocument;
    }

    const remapped = orderNodesForPaste(clipboard).map((node) =>
      remapPastedNode(node, idMap, offset)
    );
    const added = remapped.map((node) => node.id);
    const commands: CanvasCommand[] = remapped.map((node) => ({
      label: "Paste",
      node,
      type: "node.add"
    }));

    if (added.length > 0) {
      commands.push({
        label: "Paste",
        selection: {
          ids: added,
          primaryId: added[added.length - 1]!,
          hoveredId: snapshot.selection.hoveredId
        },
        type: "selection.set"
      });
    }

    if (commands.length === 1) {
      await dispatch(commands[0]!);
    } else if (commands.length > 1) {
      await dispatch({
        commands,
        label: "Paste",
        type: "transaction"
      });
    }

    return added;
  }

  return {
    activateTool,
    canRedo: () => historyIndex < history.length,
    canUndo: () => historyIndex > 0,
    cancelActiveToolSession,
    applyLayout,
    getLayoutAdapters,
    registerLayoutAdapter,
    copySelection,
    pasteClipboard,
    dispatch,
    getActiveTool,
    getState,
    getTools: () => freezeValue([...tools.values()]),
    handleToolInput,
    hoverFromHit,
    redo,
    registerCommand(descriptor, handler) {
      assertPluginCommandRegistration(descriptor, handler);
      const { parsePayload, type } = descriptor;
      const registeredDescriptor = Object.freeze({ parsePayload, type });
      const registration = createRegisteredPluginCommand(
        registeredDescriptor,
        handler
      );

      if (commandHandlers.has(type)) {
        throw new CanvasEditorError(
          "invalid-command",
          `Command handler is already registered: ${type}`,
          { commandType: type }
        );
      }

      commandHandlers.set(type, registration);

      return () => {
        if (commandHandlers.get(type) !== registration) {
          return;
        }

        commandHandlers.delete(type);
      };
    },
    registerTool(definition) {
      assertToolDefinition(definition);
      const { id } = definition;

      if (tools.has(id)) {
        throw new CanvasEditorError(
          "invalid-command",
          `Tool is already registered: ${id}`
        );
      }

      const registered = freezeValue({ ...definition });
      tools.set(id, registered);

      return () => {
        if (tools.get(id) !== registered) {
          return;
        }

        if (activeToolId === id) {
          observeToolCleanup(deactivateTool(registered));
        }

        tools.delete(id);

        if (activeToolId === id) {
          const previousToolId = activeToolId;
          activeToolId = null;
          notify({
            activeToolId,
            previousToolId,
            type: "tool.activate"
          });
        }
      };
    },
    selectFromHit,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribePersistence(listener) {
      persistenceListeners.add(listener);
      return () => persistenceListeners.delete(listener);
    },
    getDocumentId() {
      return documentId;
    },
    getBaseRevision() {
      return baseRevision;
    },
    setBaseRevision(revision) {
      const previous = baseRevision;
      baseRevision = revision;

      if (previous !== revision) {
        notifyPersistence({
          type: "revision.changed",
          documentId,
          revision
        });
      }
    },
    undo
  };
}

export function connectEditorToRuntime(
  editor: CanvasEditor,
  runtime: CanvasEditorRuntimeTarget
): () => void {
  let currentDocument = editor.getState().document;
  let currentSelection = editor.getState().selection;
  runtime.update(currentDocument.scene);
  const pushSelection = () => {
    const next = editor.getState().selection;
    if (next === currentSelection) {
      return;
    }
    currentSelection = next;
    const rt = runtime as {
      setSelection?: (ids: readonly string[], primaryId?: string | null) => void;
      setHoveredNode?: (id: NodeId | null) => void;
    };
    rt.setSelection?.([...next.ids], next.primaryId);
    rt.setHoveredNode?.(next.hoveredId);
  };
  pushSelection();
  return editor.subscribe((state) => {
    if (state.document !== currentDocument) {
      currentDocument = state.document;
      runtime.update(state.document.scene);
    }
    pushSelection();
  });
}

export type ConnectEditorToStorageOptions = {
  readonly debounceMs?: number;
  /**
   * Called when `saveDocument` reports an optimistic-concurrency conflict.
   * The bridge does not rebase `baseRevision` or overwrite the server document.
   */
  readonly onConflict?: (result: Extract<CanvasSaveResult, { ok: false; reason: "conflict" }>) => void;
};

/**
 * Connects an editor to a `CanvasStorageAdapter`. Listens for
 * `transaction.committed` and `history.changed` persistence events and saves
 * the document (debounced) via `adapter.saveDocument`, using the last
 * acknowledged server revision as `baseRevision`. Undo/redo therefore persist
 * the restored snapshot. On conflict the local document is left unchanged and
 * `onConflict` runs; the next save still uses the acknowledged revision.
 *
 * Returns a disconnect function. Pending saves are cancelled (not flushed) on
 * disconnect; callers that need a final flush should call `adapter.saveDocument`
 * directly before disconnecting.
 */
export function connectEditorToStorage(
  editor: CanvasEditor,
  adapter: CanvasStorageAdapter,
  options: ConnectEditorToStorageOptions = {}
): () => void {
  const debounceMs = options.debounceMs ?? 0;
  let pending: ReturnType<typeof setTimeout> | null = null;
  let latestDocument = editor.getState().document;
  let acknowledgedRevision = editor.getBaseRevision();
  let disconnected = false;

  const flush = async () => {
    if (disconnected) {
      return;
    }

    const result = await adapter.saveDocument(latestDocument, {
      baseRevision: acknowledgedRevision
    });

    if (disconnected) {
      return;
    }

    if (result.ok) {
      acknowledgedRevision = result.revision;
      editor.setBaseRevision(result.revision);
      return;
    }

    if (result.reason === "conflict") {
      options.onConflict?.(result);
    }
  };

  const unsubscribe = editor.subscribePersistence((event) => {
    if (disconnected) {
      return;
    }

    if (
      event.type !== "transaction.committed" &&
      event.type !== "history.changed"
    ) {
      return;
    }

    latestDocument = editor.getState().document;

    if (pending) {
      clearTimeout(pending);
    }

    if (debounceMs <= 0) {
      void flush();
      return;
    }

    pending = setTimeout(() => {
      pending = null;
      void flush();
    }, debounceMs);
  });

  return () => {
    disconnected = true;
    unsubscribe();

    if (pending) {
      clearTimeout(pending);
      pending = null;
    }
  };
}

function orderNodesForPaste(nodes: readonly CanvasNode[]): CanvasNode[] {
  const remaining = new Map(nodes.map((node) => [node.id, node]));
  const ordered: CanvasNode[] = [];

  while (remaining.size > 0) {
    const ready = [...remaining.values()].filter((node) => {
      if (node.type === "edge") {
        return !remaining.has(node.sourceId) && !remaining.has(node.targetId);
      }

      return node.parentId === null || !remaining.has(node.parentId);
    });

    if (ready.length === 0) {
      ordered.push(...remaining.values());
      break;
    }

    for (const node of ready) {
      remaining.delete(node.id);
      ordered.push(node);
    }
  }

  return ordered;
}

function remapPastedNode(
  node: CanvasNode,
  idMap: ReadonlyMap<NodeId, NodeId>,
  offset: readonly [number, number]
): CanvasNode {
  const nextId = idMap.get(node.id);

  if (nextId === undefined) {
    throw new CanvasEditorError(
      "invalid-command",
      `Paste is missing a remapped id for ${node.id}.`
    );
  }

  const parentId =
    node.parentId === null ? null : (idMap.get(node.parentId) ?? null);

  if (node.type === "edge") {
    return {
      ...node,
      id: nextId,
      parentId,
      sourceId: idMap.get(node.sourceId) ?? node.sourceId,
      targetId: idMap.get(node.targetId) ?? node.targetId
    };
  }

  if (node.type === "annotation") {
    return {
      ...node,
      id: nextId,
      parentId,
      targetId:
        node.targetId === null ? null : (idMap.get(node.targetId) ?? node.targetId),
      anchor: offsetPoint(node.anchor, offset)
    } as CanvasNode;
  }

  if (node.type === "measurement") {
    return {
      ...node,
      id: nextId,
      parentId,
      start: offsetPoint(node.start, offset),
      end: offsetPoint(node.end, offset)
    } as CanvasNode;
  }

  if ("position" in node && Array.isArray(node.position)) {
    return {
      ...node,
      id: nextId,
      parentId,
      position: offsetPoint(node.position, offset)
    } as CanvasNode;
  }

  return {
    ...node,
    id: nextId,
    parentId
  };
}

function offsetPoint(
  value: readonly number[],
  offset: readonly [number, number]
): number[] {
  const next = [...value];
  next[0] = (next[0] ?? 0) + offset[0];
  next[1] = (next[1] ?? 0) + offset[1];
  return next;
}


