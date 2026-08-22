export type WorkerTaskDefinition<TPayload, TResult> = {
  readonly payload: TPayload;
  readonly result: TResult;
};

export type WorkerTaskMap = Record<
  string,
  WorkerTaskDefinition<unknown, unknown>
>;

type WorkerTaskType<TTasks> = Extract<keyof TTasks, string>;
type WorkerTaskPayload<
  TTasks,
  TType extends WorkerTaskType<TTasks>
> = TTasks[TType] extends WorkerTaskDefinition<infer TPayload, unknown>
  ? TPayload
  : never;
type WorkerTaskResult<
  TTasks,
  TType extends WorkerTaskType<TTasks>
> = TTasks[TType] extends WorkerTaskDefinition<unknown, infer TResult>
  ? TResult
  : never;

export type WorkerRequest<
  TPayload = unknown,
  TType extends string = string
> = {
  id: string;
  payload: TPayload;
  type: TType;
};

export type WorkerResponse<TResult = unknown> =
  | {
      id: string;
      ok: true;
      result: TResult;
    }
  | {
      id: string;
      ok: false;
      error: string;
    };

export type WorkerClient<
  TTasks extends Record<keyof TTasks, WorkerTaskDefinition<unknown, unknown>> =
    WorkerTaskMap
> = {
  dispose: () => void;
  request: <TType extends WorkerTaskType<TTasks>>(
    type: TType,
    payload: WorkerTaskPayload<TTasks, TType>,
    transfer?: Transferable[]
  ) => Promise<WorkerTaskResult<TTasks, TType>>;
};

export function supportsOffscreenCanvas() {
  return (
    typeof HTMLCanvasElement !== "undefined" &&
    "transferControlToOffscreen" in HTMLCanvasElement.prototype &&
    typeof OffscreenCanvas !== "undefined"
  );
}

export function transferCanvasIfSupported(canvas: HTMLCanvasElement) {
  if (!supportsOffscreenCanvas()) {
    return null;
  }

  return canvas.transferControlToOffscreen();
}

export function createWorkerClient<
  TTasks extends Record<keyof TTasks, WorkerTaskDefinition<unknown, unknown>> =
    WorkerTaskMap
>(worker: Worker): WorkerClient<TTasks> {
  const pending = new Map<
    string,
    {
      reject: (reason: Error) => void;
      resolve: (value: unknown) => void;
    }
  >();

  function onMessage(event: MessageEvent<WorkerResponse>) {
    const response = event.data;
    const request = pending.get(response.id);

    if (!request) {
      return;
    }

    pending.delete(response.id);

    if (response.ok) {
      request.resolve(response.result);
      return;
    }

    request.reject(new Error(response.error));
  }

  worker.addEventListener("message", onMessage);

  return {
    dispose() {
      worker.removeEventListener("message", onMessage);
      worker.terminate();
      pending.clear();
    },
    request<TType extends WorkerTaskType<TTasks>>(
      type: TType,
      payload: WorkerTaskPayload<TTasks, TType>,
      transfer: Transferable[] = []
    ) {
      const id = crypto.randomUUID();
      const message: WorkerRequest = {
        id,
        payload,
        type
      };

      return new Promise<WorkerTaskResult<TTasks, TType>>((resolve, reject) => {
        pending.set(id, {
          reject,
          resolve: (value) =>
            resolve(value as WorkerTaskResult<TTasks, TType>)
        });
        worker.postMessage(message, transfer);
      });
    }
  };
}

/**
 * Runtime implementation of one task in a {@link WorkerTaskMap}. The map type
 * carries the payload/result contract; implementations registered through
 * {@link createWorkerHandler} provide the behavior.
 */
export type WorkerTaskImplementation<TPayload, TResult> = (
  payload: TPayload
) => TResult | Promise<TResult>;

export type WorkerTaskImplementations<
  TTasks extends Record<keyof TTasks, WorkerTaskDefinition<unknown, unknown>>
> = {
  readonly [TType in WorkerTaskType<TTasks>]: WorkerTaskImplementation<
    WorkerTaskPayload<TTasks, TType>,
    WorkerTaskResult<TTasks, TType>
  >;
};

export type WorkerHandler<
  TTasks extends Record<keyof TTasks, WorkerTaskDefinition<unknown, unknown>> =
    WorkerTaskMap
> = (event: MessageEvent<WorkerRequest>) => void;

function collectTransferables(
  value: unknown,
  into: Transferable[],
  seen: Set<ArrayBuffer>
): void {
  if (value instanceof ArrayBuffer) {
    if (!seen.has(value)) {
      seen.add(value);
      into.push(value);
    }
    return;
  }

  if (ArrayBuffer.isView(value)) {
    const buffer = value.buffer as ArrayBuffer;

    if (!seen.has(buffer)) {
      seen.add(buffer);
      into.push(buffer);
    }
    return;
  }

  // One array level: results like `{ elements: [{ positions, indices }] }`
  // are the common multi-object shape.
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTransferables(item, into, seen);
    }
  }
}

/**
 * Worker-side dispatcher. Install its return value as the worker's
 * `message` listener; it resolves the task implementation for the requested
 * type, awaits the result, and posts the correlated response. Array buffers
 * of top-level typed arrays or `ArrayBuffer`s on the result are transferred
 * back instead of copied.
 *
 * Unknown task types and throwing implementations are reported to the main
 * side as `{ ok: false, error }` responses instead of crashing the worker.
 */
export function createWorkerHandler<
  TTasks extends Record<keyof TTasks, WorkerTaskDefinition<unknown, unknown>>
>(
  implementations: WorkerTaskImplementations<TTasks>
): WorkerHandler<TTasks> {
  return (event: MessageEvent<WorkerRequest>) => {
    const request = event.data;
    const run = (implementations as Record<
      string,
      WorkerTaskImplementation<unknown, unknown>
    >)[request.type];

    if (typeof run !== "function") {
      const response: WorkerResponse = {
        error: `Unknown worker task type: ${request.type}`,
        id: request.id,
        ok: false
      };
      self.postMessage(response);
      return;
    }

    Promise.resolve()
      .then(() => run(request.payload))
      .then((result) => {
        const transfer: Transferable[] = [];
        const seen = new Set<ArrayBuffer>();
        collectTransferables(result, transfer, seen);

        if (result !== null && typeof result === "object") {
          for (const value of Object.values(
            result as Record<string, unknown>
          )) {
            collectTransferables(value, transfer, seen);
          }
        }

        const response: WorkerResponse = {
          id: request.id,
          ok: true,
          result
        };
        postDedicatedMessage(response, transfer);
      })
      .catch((cause: unknown) => {
        const response: WorkerResponse = {
          error: cause instanceof Error ? cause.message : String(cause),
          id: request.id,
          ok: false
        };
        postDedicatedMessage(response);
      });
  };
}

function postDedicatedMessage(
  response: WorkerResponse,
  transfer?: Transferable[]
): void {
  // Dedicated worker scopes live in the WebWorker lib, which conflicts with
  // the DOM lib this package compiles against; a structural view of the one
  // method we need keeps the boundary explicit without widening the lib.
  const scope = self as unknown as {
    postMessage: (message: unknown, transfer?: Transferable[]) => void;
  };
  scope.postMessage(response, transfer);
}

/**
 * First-party M4 task vocabulary. `denovo.geometry.convert` normalizes raw
 * geometry arrays into transferable typed arrays and computes the axis-aligned
 * bounds — representative of the parsing/conversion work that must not block
 * the main thread on large documents.
 */
export type DenovoGeometryConvertRequest = {
  indices: number[] | Uint32Array;
  positions: number[] | Float32Array;
};

export type DenovoGeometryBounds = {
  max: [number, number, number];
  min: [number, number, number];
};

export type DenovoGeometryConvertResult = {
  bounds: DenovoGeometryBounds;
  indices: Uint32Array;
  positions: Float32Array;
};

export type DenovoWorkerTaskMap = {
  "denovo.geometry.convert": WorkerTaskDefinition<
    DenovoGeometryConvertRequest,
    DenovoGeometryConvertResult
  >;
};

export function convertDenovoGeometry(
  payload: DenovoGeometryConvertRequest
): DenovoGeometryConvertResult {
  const positions =
    payload.positions instanceof Float32Array
      ? payload.positions
      : Float32Array.from(payload.positions);
  const indices =
    payload.indices instanceof Uint32Array
      ? payload.indices
      : Uint32Array.from(payload.indices);

  if (positions.length < 3) {
    throw new Error(
      "denovo.geometry.convert requires at least one position triple."
    );
  }

  if (indices.length % 3 !== 0) {
    throw new Error("denovo.geometry.convert requires triangle indices.");
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (let offset = 0; offset + 2 < positions.length; offset += 3) {
    const x = positions[offset];
    const y = positions[offset + 1];
    const z = positions[offset + 2];

    if (x === undefined || y === undefined || z === undefined) {
      continue;
    }

    if (x < minX) {
      minX = x;
    }

    if (y < minY) {
      minY = y;
    }

    if (z < minZ) {
      minZ = z;
    }

    if (x > maxX) {
      maxX = x;
    }

    if (y > maxY) {
      maxY = y;
    }

    if (z > maxZ) {
      maxZ = z;
    }
  }

  return {
    bounds: {
      max: [maxX, maxY, maxZ],
      min: [minX, minY, minZ]
    },
    indices,
    positions
  };
}

/**
 * Ready-to-install handler for the first-party {@link DenovoWorkerTaskMap}.
 * Pair it with {@link createWorkerTaskQueue} on the main side.
 */
export function createDenovoWorkerHandler(): WorkerHandler<DenovoWorkerTaskMap> {
  return createWorkerHandler<DenovoWorkerTaskMap>({
    "denovo.geometry.convert": convertDenovoGeometry
  });
}

export type WorkerTaskQueueOptions<
  TTasks extends Record<keyof TTasks, WorkerTaskDefinition<unknown, unknown>>
> = {
  /** Creates one pool member. Called up to `size` times, lazily. */
  createWorker: () => Worker;
  /** Pool size. Defaults to 2; values below 1 fail explicitly. */
  size?: number;
};

export type WorkerTaskQueue<
  TTasks extends Record<keyof TTasks, WorkerTaskDefinition<unknown, unknown>> =
    WorkerTaskMap
> = {
  dispose: () => void;
  readonly size: number;
  request: WorkerClient<TTasks>["request"];
};

type QueueMember<TTasks extends Record<keyof TTasks, WorkerTaskDefinition<unknown, unknown>>> = {
  client: WorkerClient<TTasks>;
  idle: boolean;
  worker: Worker;
};

/**
 * Main-side pool around {@link createWorkerClient}. Requests dispatch to an
 * idle worker immediately or wait in a FIFO buffer until one frees up, so
 * callers get queue semantics without per-call bookkeeping. Each worker runs
 * one request at a time; results and errors correlate back to their callers.
 */
export function createWorkerTaskQueue<
  TTasks extends Record<keyof TTasks, WorkerTaskDefinition<unknown, unknown>> =
    WorkerTaskMap
>(
  options: WorkerTaskQueueOptions<TTasks>
): WorkerTaskQueue<TTasks> {
  const size = options.size ?? 2;

  if (!Number.isInteger(size) || size < 1) {
    throw new Error("Worker task queue size must be a positive integer.");
  }

  const members: Array<QueueMember<TTasks>> = [];
  const buffered: Array<{
    reject: (reason: Error) => void;
    run: (member: QueueMember<TTasks>) => void;
  }> = [];
  const inflight = new Set<{ reject: (reason: Error) => void }>();
  let disposed = false;

  function acquire(): QueueMember<TTasks> | null {
    for (const member of members) {
      if (member.idle) {
        return member;
      }
    }

    if (members.length < size) {
      const worker = options.createWorker();
      const member: QueueMember<TTasks> = {
        client: createWorkerClient<TTasks>(worker),
        idle: true,
        worker
      };
      members.push(member);
      return member;
    }

    return null;
  }

  function drain() {
    while (buffered.length > 0) {
      const member = acquire();

      if (member === null) {
        return;
      }

      const next = buffered.shift();
      next?.run(member);
    }
  }

  return {
    dispose() {
      disposed = true;

      for (const member of members) {
        member.client.dispose();
      }

      members.length = 0;

      for (const entry of buffered) {
        entry.reject(new Error("Worker task queue was disposed."));
      }

      buffered.length = 0;

      for (const entry of [...inflight]) {
        entry.reject(new Error("Worker task queue was disposed."));
      }

      inflight.clear();
    },
    request<TType extends WorkerTaskType<TTasks>>(
      type: TType,
      payload: WorkerTaskPayload<TTasks, TType>,
      transfer: Transferable[] = []
    ): Promise<WorkerTaskResult<TTasks, TType>> {
      if (disposed) {
        return Promise.reject(new Error("Worker task queue was disposed."));
      }

      return new Promise<WorkerTaskResult<TTasks, TType>>((resolve, reject) => {
        const run = (member: QueueMember<TTasks>) => {
          member.idle = false;
          const tracked = { reject };
          inflight.add(tracked);
          member.client
            .request(type, payload, transfer)
            .then(
              (result) => {
                inflight.delete(tracked);
                member.idle = true;
                resolve(result);
                drain();
              },
              (cause: Error) => {
                inflight.delete(tracked);
                member.idle = true;
                reject(cause);
                drain();
              }
            );
        };

        const member = acquire();

        if (member === null) {
          buffered.push({ reject, run });
          return;
        }

        run(member);
      });
    },
    get size() {
      return size;
    }
  };
}
