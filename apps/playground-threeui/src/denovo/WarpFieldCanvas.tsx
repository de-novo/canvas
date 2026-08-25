import { useEffect, useRef } from "react";
import { createWarpFieldRenderer } from "../vendor/threeui/warp-field/warpFieldRenderer";
import {
  createWarpFieldDocument,
  readWarpFieldState,
  WARP_FIELD_VARIANTS,
  type WarpFieldVariant
} from "./warp-field-document";

export type WarpFieldCanvasProps = {
  variant?: string;
};

export function WarpFieldCanvas({ variant = "streaks" }: WarpFieldCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const resolved: WarpFieldVariant =
    WARP_FIELD_VARIANTS.find((item) => item === variant) ?? "streaks";

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const sceneDocument = createWarpFieldDocument(resolved);
    const state = readWarpFieldState(sceneDocument);
    const canvas = window.document.createElement("canvas");
    canvas.dataset.denovoCanvas = "true";
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.filter = `hue-rotate(${state.hue}deg) saturate(${state.saturation}) brightness(${state.brightness})`;
    host.replaceChildren(canvas);
    host.dataset.denovoDocument = sceneDocument.id;

    const engine = createWarpFieldRenderer(canvas, () => state);
    let frame = 0;
    const resize = () => {
      const bounds = host.getBoundingClientRect();
      engine.resize(Math.max(1, bounds.width), Math.max(1, bounds.height));
    };
    const tick = () => {
      engine.render();
      frame = window.document.hidden ? 0 : requestAnimationFrame(tick);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      engine.dispose();
      canvas.remove();
    };
  }, [resolved]);

  return (
    <div ref={hostRef} className="denovo-warp-field" data-denovo-warp-field={resolved} />
  );
}
