import { createDenovoWorkerHandler } from "@denovo/canvas/worker";

self.addEventListener("message", createDenovoWorkerHandler());
