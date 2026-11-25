import {
  type Accessor,
  type Component,
  type JSX,
  createEffect,
  createSignal,
  on,
  onCleanup,
  onMount
} from "solid-js";
import {
  createCanvas,
  shallowEqual,
  subscribeCanvasSelector,
  type CanvasEditor,
  type CanvasEditorState,
  type CanvasSelector,
  type CanvasSelectorEquality,
  type DenovoCanvasCommonConfig,
  type DenovoCanvasRuntime
} from "@de-novo/canvas";
import type { CanvasSceneInput } from "@de-novo/canvas-core";

type DenovoCanvasBaseProps = {
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
 * Props for the {@link DenovoCanvas} Solid component.
 */
export type DenovoCanvasProps = DenovoCanvasBaseProps &
  (
    | { editor?: never; scene: CanvasSceneInput }
    | { editor: CanvasEditor; scene?: never }
  );

/**
 * Solid adapter for Denovo Canvas. Mounts a {@link createCanvas} runtime on a
 * host `<div>`, keeps it in sync with the reactive `scene` prop, and destroys
 * it on cleanup. Mirrors the `DenovoCanvas` components from the Vue and React
 * adapters so the same document/runtime model works across frameworks.
 *
 * @example
 * ```tsx
 * import { DenovoCanvas } from "@de-novo/solid-canvas";
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

    runtime =
      props.editor !== undefined
        ? createCanvas(hostElement, {
            editor: props.editor,
            ...(props.options ?? {})
          })
        : createCanvas(hostElement, {
            scene: props.scene!,
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
        if (props.editor !== undefined || next === undefined) {
          return;
        }
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

/**
 * Subscribes a Solid computation to a derived slice of a {@link CanvasEditor}.
 * Emits updates only when `equals(previous, next)` returns `false` (defaults
 * to `Object.is`; pass `shallowEqual` for derived objects or arrays) and
 * unsubscribes automatically on owner cleanup.
 */
export function useCanvasSelector<TSelected>(
  editor: CanvasEditor,
  selector: CanvasSelector<TSelected>,
  equals?: CanvasSelectorEquality<TSelected>
): Accessor<TSelected> {
  const [selected, setSelected] = createSignal<TSelected>(
    selector(editor.getState()),
    { equals: false }
  );
  const unsubscribe = subscribeCanvasSelector(
    editor,
    selector,
    (next) => {
      setSelected(() => next);
    },
    equals === undefined ? undefined : { equals }
  );

  onCleanup(unsubscribe);
  return selected;
}

export {
  createCanvas,
  shallowEqual,
  subscribeCanvasSelector,
  type CanvasEditor,
  type CanvasEditorState,
  type CanvasSelector,
  type CanvasSelectorEquality,
  type DenovoCanvasCommonConfig,
  type DenovoCanvasRuntime
} from "@de-novo/canvas";
export type { CanvasSceneInput } from "@de-novo/canvas-core";
