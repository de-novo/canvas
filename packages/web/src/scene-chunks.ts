/**
 * Progressive scene application for large documents. Large `update()` calls
 * rebuild every changed object synchronously, which can block the main thread
 * on tens of thousands of nodes. The chunk loader applies node ranges across
 * scheduled slices so hosts can stream a scene in without freezing input.
 *
 * This is an opt-in M4 performance helper: hosts that load small scenes keep
 * calling `runtime.update(scene)` directly.
 */

export class CanvasSceneChunkCancelledError extends Error {
  readonly appliedNodes: number;

  constructor(appliedNodes: number) {
    super("Canvas scene chunk loading was cancelled.");
    this.name = "CanvasSceneChunkCancelledError";
    this.appliedNodes = appliedNodes;
  }
}

export type CanvasSceneChunkProgress = {
  appliedNodes: number;
  totalNodes: number;
};

export type CanvasSceneChunkLoaderOptions = {
  /**
   * Maximum nodes applied per update call. Default 2000.
   */
  chunkSize?: number;
  /**
   * Soft time budget per scheduled slice in milliseconds. Fast chunks are
   * batched inside one slice until the budget elapses. Default 8.
   */
  budgetMs?: number;
  /**
   * Waits between slices. Defaults to `requestAnimationFrame` when available,
   * falling back to `setTimeout(0)`.
   */
  yieldSlice?: () => Promise<void>;
};

export type CanvasSceneChunkLoader<TScene extends { nodes: readonly unknown[] }> =
  {
    cancel: () => void;
    load: (
      scene: TScene,
      onProgress?: (progress: CanvasSceneChunkProgress) => void
    ) => Promise<TScene>;
  };

function defaultYieldSlice(): Promise<void> {
  if (typeof requestAnimationFrame === "function") {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export function createSceneChunkLoader<
  TScene extends { nodes: readonly unknown[] }
>(
  runtime: { update: (scene: TScene) => unknown },
  options: CanvasSceneChunkLoaderOptions = {}
): CanvasSceneChunkLoader<TScene> {
  const chunkSize = options.chunkSize ?? 2_000;
  const budgetMs = options.budgetMs ?? 8;

  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error("Scene chunk size must be a positive integer.");
  }

  if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
    throw new Error("Scene chunk budget must be a positive finite number.");
  }

  const yieldSlice = options.yieldSlice ?? defaultYieldSlice;
  let cancelled = false;

  return {
    cancel() {
      cancelled = true;
    },
    async load(scene, onProgress) {
      // A stale cancel from a previous run must not poison a new load.
      cancelled = false;
      const totalNodes = scene.nodes.length;

      if (totalNodes <= chunkSize) {
        runtime.update(scene);
        onProgress?.({ appliedNodes: totalNodes, totalNodes });
        return scene;
      }

      let appliedNodes = 0;
      let lastAppliedNodes = 0;

      while (appliedNodes < totalNodes) {
        const sliceStartedAt = Date.now();

        do {
          const end = Math.min(appliedNodes + chunkSize, totalNodes);
          // Intermediate states are the same scene with a shorter node list;
          // the structural cast keeps the public signature precise.
          const partial = {
            ...scene,
            nodes: scene.nodes.slice(0, end)
          } as TScene;
          runtime.update(partial);
          appliedNodes = end;
          lastAppliedNodes = end;
        } while (
          appliedNodes < totalNodes &&
          Date.now() - sliceStartedAt < budgetMs
        );

        onProgress?.({ appliedNodes, totalNodes });

        if (appliedNodes < totalNodes) {
          await yieldSlice();

          if (cancelled) {
            throw new CanvasSceneChunkCancelledError(appliedNodes);
          }
        }
      }

      // When the last chunk already covered every node, the runtime holds a
      // content-equal scene; committing again would rebuild it for nothing.
      if (lastAppliedNodes < totalNodes) {
        runtime.update(scene);
      }

      return scene;
    }
  };
}
