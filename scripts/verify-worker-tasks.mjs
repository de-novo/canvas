// @ts-check
/**
 * M4 worker task queue verification.
 *
 * Exercises the @de-novo/canvas-worker task vocabulary, handler, and pool
 * queue through in-process loopback "workers" (deterministic, no real
 * threads). Real cross-thread RTT numbers live in
 * docs/m4-performance-thresholds.md and are captured in the browser.
 */

import assert from "node:assert/strict";

import {
  convertDenovoGeometry,
  createDenovoWorkerHandler,
  createWorkerHandler,
  createWorkerTaskQueue,
  supportsOffscreenCanvas
} from "../packages/worker/dist/index.js";
import { createCheckRunner } from "./lib/checks.mjs";

const { check, report } = createCheckRunner();

/**
 * The worker-side handler posts through the global `self` scope. Loopback
 * workers register their emitter here so responses route back to whichever
 * worker was created last; every queue test that relies on this runs its
 * requests sequentially, which keeps the routing unambiguous. The
 * concurrency test bypasses the global scope entirely.
 */
let currentEmit = null;
const originalSelf = globalThis.self;
globalThis.self = { postMessage: (message) => currentEmit?.({ data: message }) };

/**
 * In-process stand-in for a real Worker. `handle(message, respond)` runs on
 * each posted message via microtasks so promise ordering matches the
 * browser event loop closely enough for queue-semantics assertions.
 */
function createLoopbackWorker(handle) {
  const listeners = new Map();
  let terminated = false;

  const emit = (type, event) => {
    for (const listener of [...(listeners.get(type) ?? [])]) {
      listener(event);
    }
  };

  currentEmit = (event) => emit("message", event);

  return {
    addEventListener(type, listener) {
      const list = listeners.get(type) ?? [];
      list.push(listener);
      listeners.set(type, list);
    },
    removeEventListener(type, listener) {
      const list = listeners.get(type) ?? [];
      const index = list.indexOf(listener);

      if (index >= 0) {
        list.splice(index, 1);
      }
    },
    postMessage(message) {
      if (terminated) {
        return;
      }

      Promise.resolve().then(() => {
        if (!terminated) {
          handle(message, (response) => emit("message", { data: response }));
        }
      });
    },
    terminate() {
      terminated = true;
    }
  };
}

const denovoHandler = createDenovoWorkerHandler();

function createDenovoLoopbackWorker() {
  return createLoopbackWorker((message) => {
    denovoHandler({ data: message });
  });
}

// 1. The conversion task is correct on its own.
{
  const result = convertDenovoGeometry({
    indices: [0, 1, 2],
    positions: [0, 0, 0, 1, 0, 0, 0.5, 2, 0]
  });

  assert.ok(result.positions instanceof Float32Array);
  assert.ok(result.indices instanceof Uint32Array);
  assert.deepEqual(result.bounds.min, [0, 0, 0]);
  assert.deepEqual(result.bounds.max, [1, 2, 0]);
  check("convert-denovo-geometry-normalizes-and-computes-bounds", () => {});

  assert.throws(
    () => convertDenovoGeometry({ indices: [0, 1], positions: [0, 0, 0] }),
    /triangle indices/
  );
  assert.throws(
    () => convertDenovoGeometry({ indices: [0, 1, 2], positions: [1, 2] }),
    /position triple/
  );
  check("convert-denovo-geometry-rejects-invalid-input", () => {});
}

// 2. Queue round-trips the first-party task through the handler contract.
{
  const queue = createWorkerTaskQueue({
    createWorker: createDenovoLoopbackWorker,
    size: 1
  });

  try {
    const result = await queue.request("denovo.geometry.convert", {
      indices: Uint32Array.from([0, 1, 2]),
      positions: Float32Array.from([-1, -2, -3, 4, 5, 6])
    });

    assert.deepEqual(result.bounds.min, [-1, -2, -3]);
    assert.deepEqual(result.bounds.max, [4, 5, 6]);
    check("queue-round-trips-denovo-geometry-convert", () => {});
  } finally {
    queue.dispose();
  }
}

// 3. Bounded pool concurrency with FIFO buffering. This test bypasses the
// global self scope: the handler responds directly through `respond`.
{
  let created = 0;
  let activeTotal = 0;
  let maxActive = 0;
  const completionOrder = [];

  const queue = createWorkerTaskQueue({
    createWorker() {
      created += 1;

      return createLoopbackWorker((message, respond) => {
        activeTotal += 1;
        maxActive = Math.max(maxActive, activeTotal);

        setTimeout(() => {
          activeTotal -= 1;
          completionOrder.push(message.payload.positions[0]);
          respond({
            id: message.id,
            ok: true,
            result: convertDenovoGeometry(message.payload)
          });
        }, 2);
      });
    },
    size: 2
  });

  try {
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        queue
          .request("denovo.geometry.convert", {
            indices: [0, 1, 2],
            positions: [index, 0, 0]
          })
          .then((result) => result.positions[0])
      )
    );

    assert.deepEqual(results, [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(completionOrder, [0, 1, 2, 3, 4, 5]);
    assert.equal(created, 2, "pool must not exceed the requested size");
    assert.ok(
      maxActive <= 2,
      `each worker must run one request at a time (max=${maxActive})`
    );
    check("queue-dispatches-fifo-within-pool-size", () => {});
  } finally {
    queue.dispose();
  }
}

// 4. Task errors reject their caller without poisoning the queue.
{
  const queue = createWorkerTaskQueue({
    createWorker: createDenovoLoopbackWorker,
    size: 1
  });

  try {
    await assert.rejects(
      queue.request("denovo.geometry.convert", {
        indices: [0, 1],
        positions: [0, 0, 0]
      }),
      /triangle indices/
    );

    const recovered = await queue.request("denovo.geometry.convert", {
      indices: [0, 1, 2],
      positions: [7, 8, 9]
    });
    assert.deepEqual(recovered.bounds.min, [7, 8, 9]);
    check("queue-recovers-after-task-error", () => {});
  } finally {
    queue.dispose();
  }
}

// 5. Dispose rejects in-flight and buffered work, plus later requests.
{
  const queue = createWorkerTaskQueue({
    createWorker: createDenovoLoopbackWorker,
    size: 1
  });

  // Attach settlement handlers synchronously so dispose-time rejections are
  // never unhandled.
  const first = queue
    .request("denovo.geometry.convert", {
      indices: [0, 1, 2],
      positions: [0, 0, 0]
    })
    .then(
      () => "resolved",
      (cause) => (cause instanceof Error ? cause.message : "rejected")
    );
  const second = queue
    .request("denovo.geometry.convert", {
      indices: [0, 1, 2],
      positions: [1, 0, 0]
    })
    .then(
      () => "resolved",
      (cause) => (cause instanceof Error ? cause.message : "rejected")
    );

  queue.dispose();

  assert.equal(await first, "Worker task queue was disposed.");
  assert.equal(await second, "Worker task queue was disposed.");
  await assert.rejects(
    queue.request("denovo.geometry.convert", {
      indices: [0, 1, 2],
      positions: [2, 0, 0]
    }),
    /disposed/
  );
  check("queue-dispose-rejects-inflight-buffered-and-later-work", () => {});
}

// 6. Unknown task types fail explicitly through the generic handler.
{
  const handler = createWorkerHandler({
    "denovo.geometry.convert": convertDenovoGeometry
  });

  let posted;
  const previousEmit = currentEmit;
  currentEmit = (event) => {
    posted = event.data;
  };

  try {
    handler({ data: { id: "unknown-1", payload: {}, type: "denovo.missing" } });
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(posted?.ok, false);
    assert.match(posted?.error ?? "", /Unknown worker task type/);
    check("handler-rejects-unknown-task-types-explicitly", () => {});
  } finally {
    currentEmit = previousEmit;
  }
}

// 7. OffscreenCanvas capability check stays exported and honest.
{
  assert.equal(typeof supportsOffscreenCanvas(), "boolean");
  check("offscreen-canvas-capability-check-is-exported", () => {});
}

check("worker-tasks-suite", () => {});

report({});
