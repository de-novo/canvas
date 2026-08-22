import {
  type Component,
  type JSX,
  createEffect,
  on,
  onCleanup,
  onMount
} from "solid-js";
import {
  createCanvas,
  type DenovoCanvasCommonConfig,
  type DenovoCanvasRuntime
} from "@denovo/canvas";
import type { CanvasSceneInput } from "@denovo/canvas-core";

/**
 * Props for the {@link DenovoCanvas} Solid component.
 */
export type DenovoCanvasProps = {
  /** Scene document to render. Reactive: changing it calls `runtime.update`. */
  scene: CanvasSceneInput;
  /** Options forwarded to `createCanvas`. Only read on mount. */
  options?: DenovoCanvasCommonConfig;
  /** Class binding for the host element. */
  hostClass?: string;
  /** Inline style binding for the host element (as a style object). */
  hostStyle?: JSX.CSSProperties;
  /** Called with the runtime after mount and with `null` before unmount. */
  onRuntimeChange?: (runtime: DenovoCanvasRuntime | null) => void;
};

/**
 * Solid adapter for Denovo Canvas. Mounts a {@link createCanvas} runtime on a
 * host `<div>`, keeps it in sync with the reactive `scene` prop, and destroys
 * it on cleanup. Mirrors the `DenovoCanvas` components from the Vue and React
 * adapters so the same document/runtime model works across frameworks.
 *
 * @example
 * ```tsx
 * import { DenovoCanvas } from "@denovo/solid-canvas";
 *
 * function App() {
 *   return <DenovoCanvas scene={scene} />;
 * }
 * ```
 */
export const DenovoCanvas: Component<DenovoCanvasProps> = (props) => {
  let hostElement: HTMLDivElement | undefined;
  let runtime: DenovoCanvasRuntime | null = null;

  onMount(() => {
    if (!hostElement) {
      return;
    }

    runtime = createCanvas(hostElement, {
      scene: props.scene,
      ...(props.options ?? {})
    });
    props.onRuntimeChange?.(runtime);
  });

  onCleanup(() => {
    runtime?.destroy();
    runtime = null;
    props.onRuntimeChange?.(null);
  });

  // Keep the runtime scene in sync. `defer` so we don't update before mount.
  createEffect(
    on(
      () => props.scene,
      (next) => {
        runtime?.update(next);
      },
      { defer: true }
    )
  );

  return (
    <div
      ref={(el) => {
        hostElement = el;
      }}
      class={props.hostClass}
      style={{
        "min-height": "320px",
        ...(props.hostStyle ?? {})
      }}
    />
  );
};

export {
  createCanvas,
  type DenovoCanvasCommonConfig,
  type DenovoCanvasRuntime
} from "@denovo/canvas";
export type { CanvasSceneInput } from "@denovo/canvas-core";
