"use client";

import {
  createCanvas,
  shallowEqual,
  type Canvas2DSceneInput,
  type CanvasEditor,
  type CanvasEditorState,
  type CanvasSelector,
  type CanvasSelectorEquality,
  type DenovoCanvas2DCommonConfig,
  type DenovoCanvas2DRuntime
} from "@denovo/canvas/2d";
import { useEffect, useRef, type CSSProperties } from "react";

import { useCanvasSelector } from "./selector";

export type Canvas2DViewProps = {
  readonly className?: string;
  readonly options?: DenovoCanvas2DCommonConfig;
  readonly scene: Canvas2DSceneInput;
  readonly style?: CSSProperties;
  readonly onRuntime?: (runtime: DenovoCanvas2DRuntime | null) => void;
};

/**
 * Lightweight 2D-only React canvas view backed by `@denovo/canvas/2d`.
 * Imports zero Three.js, `@react-three/fiber`, or `@react-three/drei` code.
 */
export function Canvas2DView({
  className,
  options,
  scene,
  style,
  onRuntime
}: Canvas2DViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<DenovoCanvas2DRuntime | null>(null);

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const runtime = createCanvas(hostRef.current, {
      scene,
      ...(options ?? {})
    });
    runtimeRef.current = runtime;
    onRuntime?.(runtime);

    return () => {
      runtime.destroy();
      runtimeRef.current = null;
      onRuntime?.(null);
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.update(scene);
  }, [scene]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        minHeight: 320,
        ...style
      }}
    />
  );
}

export { shallowEqual, useCanvasSelector };
export type {
  Canvas2DSceneInput,
  CanvasEditor,
  CanvasEditorState,
  CanvasSelector,
  CanvasSelectorEquality,
  DenovoCanvas2DCommonConfig,
  DenovoCanvas2DRuntime
};
