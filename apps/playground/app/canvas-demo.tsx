"use client";

import type {
  Canvas2DSceneInput,
  Canvas3DSceneInput
} from "@de-novo/canvas-core";
import { CanvasStage3D, CanvasView } from "@de-novo/react-canvas";
import { useQuery } from "@tanstack/react-query";
import { Box, RefreshCw, Square, SquareDashed } from "lucide-react";
import { useMemo } from "react";
import { create } from "zustand";
import { Button } from "@/components/ui/button";
import {
  ToggleGroup,
  ToggleGroupItem
} from "@/components/ui/toggle-group";
import { MaskHost } from "./mask-host";

type DemoMode = "2d" | "3d" | "mask";

type DemoState = {
  mode: DemoMode;
  setMode: (mode: DemoMode) => void;
};

const useDemoStore = create<DemoState>((set) => ({
  mode: "3d",
  setMode: (mode) => set({ mode })
}));

export function CanvasDemo() {
  const mode = useDemoStore((state) => state.mode);
  const setMode = useDemoStore((state) => state.setMode);
  const sceneStats = useQuery({
    queryKey: ["scene-stats", mode],
    queryFn: async () => ({
      mode,
      loadedAt: new Date().toISOString()
    })
  });
  const scene = useMemo(
    () => (mode === "3d" ? createThreeScene() : createTwoScene()),
    [mode]
  );

  return (
    <main className="grid min-h-svh grid-cols-1 bg-background lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="min-h-0 p-3 sm:p-5 lg:min-h-svh">
        {mode === "mask" ? (
          <MaskHost className="h-[58svh] min-h-[22.5rem] w-full overflow-hidden rounded-[var(--dc-radius,var(--radius))] border border-border bg-card lg:h-[calc(100svh-2.5rem)] lg:min-h-[27.5rem]" />
        ) : scene.mode === "3d" ? (
          <CanvasStage3D
            className="h-[58svh] min-h-[22.5rem] w-full overflow-hidden rounded-[var(--dc-radius,var(--radius))] border border-border bg-card lg:h-[calc(100svh-2.5rem)] lg:min-h-[27.5rem]"
            scene={scene}
          />
        ) : (
          <CanvasView
            className="h-[58svh] min-h-[22.5rem] w-full overflow-hidden rounded-[var(--dc-radius,var(--radius))] border border-border bg-card lg:h-[calc(100svh-2.5rem)] lg:min-h-[27.5rem]"
            scene={scene}
          />
        )}
      </section>
      <aside className="flex flex-col gap-8 border-t border-border bg-card p-5 text-card-foreground sm:p-7 lg:min-h-svh lg:border-t-0 lg:border-l">
        <div>
          <p className="m-0 text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
            Denovo Canvas
          </p>
          <h1 className="mt-5 max-w-[11ch] text-4xl leading-[0.95] font-semibold tracking-tight sm:text-5xl">
            Next ready canvas runtime
          </h1>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            This example uses Next.js, React, Zustand, TanStack Query,
            React Three Fiber, shadcn, and the shared scene schema.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Scene mode
            </p>
            <ToggleGroup
              aria-label="Scene mode"
              className="w-full"
              spacing={0}
              value={[mode]}
              variant="outline"
              onValueChange={(values) => {
                const nextMode = values[0];

                if (
                  nextMode === "2d" ||
                  nextMode === "3d" ||
                  nextMode === "mask"
                ) {
                  setMode(nextMode);
                }
              }}
            >
              <ToggleGroupItem
                aria-label="Show 3D scene"
                className="flex-1"
                value="3d"
              >
                <Box data-icon="inline-start" />
                3D
              </ToggleGroupItem>
              <ToggleGroupItem
                aria-label="Show 2D scene"
                className="flex-1"
                value="2d"
              >
                <Square data-icon="inline-start" />
                2D
              </ToggleGroupItem>
              <ToggleGroupItem
                id="demo-mode-mask"
                aria-label="Show region mask host"
                className="flex-1"
                value="mask"
              >
                <SquareDashed data-icon="inline-start" />
                Mask
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Button
            className="w-full"
            disabled={sceneStats.isFetching}
            variant="outline"
            onClick={() => void sceneStats.refetch()}
          >
            <RefreshCw
              className={sceneStats.isFetching ? "animate-spin" : undefined}
              data-icon="inline-start"
            />
            Refresh scene stats
          </Button>
        </div>

        <div className="mt-auto border-t border-border pt-5 text-sm text-muted-foreground">
          <strong className="mb-1.5 block text-base font-medium text-foreground">
            Server state cache
          </strong>
          <span className="font-mono text-xs">
            {sceneStats.data?.loadedAt ?? "Loading"}
          </span>
        </div>
      </aside>
    </main>
  );
}

function createThreeScene(): Canvas3DSceneInput {
  return {
    id: "next-three",
    mode: "3d",
    layers: [{ id: "main", name: "Main" }],
    background: "#0f172a",
    render: {
      loop: "demand",
      dpr: 1.5,
      frustumCulling: true
    },
    camera: {
      position: [5, 3.5, 7],
      target: [0, 0, 0],
      fov: 44
    },
    nodes: [
      {
        id: "primary",
        layerId: "main",
        type: "sphere",
        color: "#38bdf8",
        position: [0, 0.4, 0],
        radius: 0.9
      },
      {
        id: "batch",
        layerId: "main",
        type: "instances",
        geometry: "box",
        color: "#22c55e",
        instances: Array.from({ length: 48 }, (_, index) => {
          const column = index % 8;
          const row = Math.floor(index / 8);

          return {
            position: [column * 0.7 - 2.45, row * 0.52 - 1.45, -1.4],
            rotation: [0.2, column * 0.1, 0],
            scale: [0.26, 0.26, 0.26],
            ...(index % 3 === 0 ? { color: "#a855f7" } : {})
          };
        })
      }
    ]
  };
}

function createTwoScene(): Canvas2DSceneInput {
  return {
    id: "next-two",
    mode: "2d",
    layers: [{ id: "main", name: "Main" }],
    background: "#111827",
    render: {
      loop: "demand",
      dpr: 1.5,
      frustumCulling: true
    },
    nodes: [
      {
        id: "panel",
        layerId: "main",
        type: "rect",
        fill: "#22c55e",
        position: [96, 96],
        size: [260, 180],
        rotation: 0.08
      },
      {
        id: "badge",
        layerId: "main",
        type: "circle",
        fill: "#38bdf8",
        position: [420, 220],
        radius: 76
      },
      {
        id: "shadow",
        layerId: "main",
        type: "rect",
        fill: "#a855f7",
        position: [280, 330],
        size: [180, 72],
        rotation: -0.12
      }
    ]
  };
}
