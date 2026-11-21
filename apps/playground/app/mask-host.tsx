"use client";

import {
  connectEditorToCanvas,
  createEditor,
  defineDocument,
  listNodes,
  setNodeVisible,
  shallowEqual
} from "@denovo/canvas/2d";
import { Canvas2DView, useCanvasSelector } from "@denovo/react-canvas/2d";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  applyRegionMask,
  rasterizeRegionMask,
  sampleRegionMask
} from "@/lib/rasterize-region-mask";

const MASK_ORIGIN = [40, 40] as const;
const MASK_WIDTH = 640;
const MASK_HEIGHT = 400;
const IMAGE_COLOR = [30, 41, 59] as const;

function createMaskDocument() {
  return defineDocument({
    id: "playground-region-mask",
    scene: {
      background: "#0f172a",
      id: "playground-region-mask-scene",
      layers: [
        { id: "image", name: "Image" },
        { id: "mask", name: "Mask" }
      ],
      mode: "2d",
      nodes: [
        {
          fill: "#1e293b",
          id: "stand-in",
          layerId: "image",
          metadata: { role: "image" },
          position: [40, 40],
          size: [640, 400],
          type: "rect"
        },
        {
          fill: "#e11d48",
          id: "mask-rect",
          layerId: "mask",
          metadata: { role: "mask" },
          position: [80, 80],
          size: [160, 120],
          type: "rect"
        },
        {
          fill: "#22c55e",
          id: "mask-circle",
          layerId: "mask",
          metadata: { role: "mask" },
          position: [400, 220],
          radius: 56,
          type: "circle"
        }
      ]
    }
  });
}

export function MaskHost({ className }: { className: string }) {
  const editor = useMemo(
    () => createEditor({ document: createMaskDocument() }),
    []
  );
  const documentModel = useCanvasSelector(editor, (state) => state.document);
  const { canUndo, canRedo } = useCanvasSelector(
    editor,
    (state) => ({
      canRedo: state.history.canRedo,
      canUndo: state.history.canUndo
    }),
    shallowEqual
  );
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [hostReady, setHostReady] = useState(false);
  const mask = useMemo(
    () =>
      rasterizeRegionMask(documentModel, {
        height: MASK_HEIGHT,
        origin: MASK_ORIGIN,
        width: MASK_WIDTH
      }),
    [documentModel]
  );
  const listed = listNodes(documentModel);
  const rectHidden =
    listed.find((node) => node.id === "mask-rect")?.visible === false;

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) {
      return;
    }
    const context = preview.getContext("2d");
    if (!context) {
      return;
    }
    const pixels = applyRegionMask(mask, IMAGE_COLOR);
    const image = new ImageData(mask.width, mask.height);
    image.data.set(pixels);
    context.putImageData(image, 0, 0);
  }, [mask]);

  useEffect(() => {
    const result = {
      circleSample: sampleRegionMask(mask, 360, 180),
      iframeCount: document.querySelectorAll("iframe").length,
      listedHasMetadata: listed.some((node) => "metadata" in node),
      listedIds: listed.map((node) => node.id),
      maskPixels: mask.pixelCount,
      outsideSample: sampleRegionMask(mask, 10, 10),
      rectHidden,
      rectSample: sampleRegionMask(mask, 80, 80),
      unsupportedKinds: mask.unsupportedKinds,
      usedHostRasterizer: true
    };
    (
      window as Window & { __playgroundMask?: typeof result }
    ).__playgroundMask = result;
    setHostReady(true);
  }, [listed, mask, rectHidden]);

  const [editError, setEditError] = useState("");
  async function edit(action: () => Promise<unknown>) {
    try {
      await action();
      setEditError("");
    } catch (error) {
      setEditError(String(error));
    }
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-3"
      data-denovo-mask-ready={hostReady ? "true" : "false"}
      data-denovo-mask-pixels={String(mask.pixelCount)}
      data-denovo-rect-sample={String(sampleRegionMask(mask, 80, 80))}
    >
      <Canvas2DView
        className={className}
        scene={documentModel.scene.mode === "2d" ? documentModel.scene : createMaskDocument().scene as Extract<ReturnType<typeof createMaskDocument>["scene"], { mode: "2d" }>}
        onRuntime={(runtime) => {
          if (!runtime) {
            return;
          }
          void runtime.ready.then(() => {
            connectEditorToCanvas(editor, runtime);
          });
        }}
      />
      <div className="relative z-20 flex flex-wrap items-center gap-3">
        <Button
          id="hide-mask-rect"
          data-denovo-hide-rect="true"
          type="button"
          variant="outline"
          onClick={() => void edit(() => editor.apply([
            setNodeVisible({ nodeId: "mask-rect", visible: rectHidden })
          ]))}
        >
          {rectHidden ? "Show rect mask" : "Hide rect mask"}
        </Button>
        <Button type="button" variant="outline" disabled={!canUndo}
          onClick={() => void edit(() => editor.undo())}>Undo</Button>
        <Button type="button" variant="outline" disabled={!canRedo}
          onClick={() => void edit(() => editor.redo())}>Redo</Button>
        {editError && <p role="alert">{editError}</p>}
        <p className="m-0 text-xs text-muted-foreground">
          Host mask pixels {mask.pixelCount}. Canvas ships the region
          document; this playground rasterizes JSON here.
        </p>
      </div>
      <canvas
        ref={previewRef}
        aria-label="Host-rasterized mask preview"
        className="border border-border bg-background"
        height={MASK_HEIGHT}
        width={MASK_WIDTH}
        style={{ height: 120, width: 192 }}
      />
    </div>
  );
}
