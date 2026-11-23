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
  type Canvas2DSceneInput,
  type CanvasEditor,
  type CanvasEditorState,
  type CanvasSelector,
  type CanvasSelectorEquality,
  type DenovoCanvas2DCommonConfig,
  type DenovoCanvas2DRuntime
} from "@denovo/canvas/2d";

/**
 * Props for the lightweight 2D-only {@link DenovoCanvas2D} Solid component.
 */
export type DenovoCanvas2DProps = {
  /** 2D scene document to render. Reactive: changing it calls `runtime.update`. */
  scene: Canvas2DSceneInput;
  /** 2D options forwarded to `createCanvas`. Only read on mount. */
  options?: DenovoCanvas2DCommonConfig;
  /** Class binding for the host element. */
  hostClass?: string;
  /** Inline style binding for the host element (as a style object). */
  hostStyle?: JSX.CSSProperties;
  /** Called with the 2D runtime after mount and with `null` before unmount. */
  onRuntimeChange?: (runtime: DenovoCanvas2DRuntime | null) => void;
};

/**
 * Lightweight 2D-only Solid canvas component backed by `@denovo/canvas/2d`.
 * Imports zero Three.js or 3D runtime code.
 */
export const DenovoCanvas2D: Component<DenovoCanvas2DProps> = (props) => {
  let hostElement: HTMLDivElement | undefined;
  let runtime: DenovoCanvas2DRuntime | null = null;

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
  type Canvas2DSceneInput,
  type CanvasEditor,
  type CanvasEditorState,
  type CanvasSelector,
  type CanvasSelectorEquality,
  type DenovoCanvas2DCommonConfig,
  type DenovoCanvas2DRuntime
} from "@denovo/canvas/2d";
