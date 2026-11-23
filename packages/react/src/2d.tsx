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

type Canvas2DViewBaseProps = {
  readonly className?: string;
  readonly options?: DenovoCanvas2DCommonConfig;
  readonly style?: CSSProperties;
  readonly onRuntime?: (runtime: DenovoCanvas2DRuntime | null) => void;
};

export type Canvas2DViewProps = Canvas2DViewBaseProps &
  (
    | { readonly editor?: never; readonly scene: Canvas2DSceneInput }
    | { readonly editor: CanvasEditor; readonly scene?: never }
  );

/**
 * Lightweight 2D-only React canvas view backed by `@denovo/canvas/2d`.
 * Imports zero Three.js, `@react-three/fiber`, or `@react-three/drei` code.
 *
 * Pass either `scene` (stateless/controlled view) or `editor` (auto-connects
 * to the editor on ready and cleans up automatically on unmount).
 */
export function Canvas2DView({
  className,
  editor,
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

    const runtime =
      editor !== undefined
        ? createCanvas(hostRef.current, {
            editor,
            ...(options ?? {})
          })
        : createCanvas(hostRef.current, {
            scene: scene!,
            ...(options ?? {})
          });
    runtimeRef.current = runtime;
    onRuntime?.(runtime);

    return () => {
      runtime.destroy();
      runtimeRef.current = null;
      onRuntime?.(null);
    };
  }, [editor]);

  useEffect(() => {
    if (editor !== undefined || scene === undefined) {
      return;
    }
    runtimeRef.current?.update(scene);
  }, [editor, scene]);

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
