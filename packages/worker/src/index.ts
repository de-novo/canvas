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
