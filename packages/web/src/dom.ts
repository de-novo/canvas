import type { CanvasTarget } from "./types";

export type ResolvedCanvas = {
  canvas: HTMLCanvasElement;
  host: HTMLElement;
  overlay: HTMLDivElement;
  removeOnDestroy: boolean;
};

export type ResizeScheduler = {
  cancel: () => void;
  schedule: () => void;
};

export function createResizeScheduler(callback: () => void): ResizeScheduler {
  let frameId: number | null = null;
  let cancelled = false;

  return {
    cancel() {
      cancelled = true;

      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    },
    schedule() {
      if (cancelled || frameId !== null) {
        return;
      }

      frameId = requestAnimationFrame(() => {
        frameId = null;

        if (!cancelled) {
          callback();
        }
      });
    }
  };
}

export function getRenderRect(canvas: HTMLCanvasElement, host: HTMLElement) {
  const hostRect = host.getBoundingClientRect();

  if (hostRect.width > 0 && hostRect.height > 0) {
    return hostRect;
  }

  const canvasRect = canvas.getBoundingClientRect();

  if (canvasRect.width > 0 && canvasRect.height > 0) {
    return canvasRect;
  }

  if (canvas.width > 0 && canvas.height > 0) {
    return {
      height: canvas.height,
      width: canvas.width
    };
  }

  throw new Error(
    "Canvas layout is not measurable. Give the host or canvas explicit dimensions before creating the runtime."
  );
}

export function isCanvasElement(target: CanvasTarget): target is HTMLCanvasElement {
  return (
    typeof HTMLCanvasElement !== "undefined" &&
    target instanceof HTMLCanvasElement
  );
}

export function resolveCanvasCssColor(
  canvas: HTMLCanvasElement,
  property: string,
  fallback: string
): string {
  const value = getComputedStyle(canvas).getPropertyValue(property).trim();

  if (!value) {
    return fallback;
  }

  const colorCanvas = canvas.ownerDocument.createElement("canvas");
  colorCanvas.width = 1;
  colorCanvas.height = 1;
  const context = colorCanvas.getContext("2d");

  if (!context) {
    return fallback;
  }

  context.fillStyle = fallback;
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data;
  return `rgb(${red}, ${green}, ${blue})`;
}

export function resolveCanvas(target: CanvasTarget): ResolvedCanvas {
  const overlay = document.createElement("div");
  overlay.className = "denovo-canvas-overlay";
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.pointerEvents = "none";
  overlay.style.overflow = "hidden";

  if (isCanvasElement(target)) {
    target.style.position = "relative";
    target.appendChild(overlay);
    return {
      canvas: target,
      host: target,
      overlay,
      removeOnDestroy: false
    };
  }

  const canvas = document.createElement("canvas");
  canvas.dataset.denovoCanvas = "true";
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  target.appendChild(canvas);
  target.style.position = "relative";
  target.appendChild(overlay);

  return {
    canvas,
    host: target,
    overlay,
    removeOnDestroy: true
  };
}
