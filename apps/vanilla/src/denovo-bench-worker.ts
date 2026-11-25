import { createDenovoWorkerHandler } from "@de-novo/canvas/worker";

self.addEventListener("message", createDenovoWorkerHandler());
