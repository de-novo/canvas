/**
 * Lightweight 2D-only Svelte adapter backed by `@de-novo/canvas/2d`.
 * Imports zero Three.js or 3D runtime code.
 */
import {
  subscribeCanvasSelector,
  type CanvasEditor,
  type CanvasSelector,
  type CanvasSelectorEquality
} from "@de-novo/canvas/2d";

export { default as DenovoCanvas2D } from "./DenovoCanvas2D.svelte";

/** Standard Svelte readable store contract for `$store` auto-subscription. */
export type CanvasReadableStore<TSelected> = {
  readonly subscribe: (run: (value: TSelected) => void) => () => void;
};

/**
 * Creates a Svelte readable store subscribed to a derived slice of a
 * {@link CanvasEditor}. Notifies subscribers only when
 * `equals(previous, next)` returns `false` (defaults to `Object.is`; pass
 * `shallowEqual` for derived objects or arrays).
 */
export function createCanvasSelectorStore<TSelected>(
  editor: CanvasEditor,
  selector: CanvasSelector<TSelected>,
  equals?: CanvasSelectorEquality<TSelected>
): CanvasReadableStore<TSelected> {
  return {
    subscribe(run) {
      return subscribeCanvasSelector(
        editor,
        selector,
        (next) => {
          run(next);
        },
        equals === undefined
          ? { fireImmediately: true }
          : { equals, fireImmediately: true }
      );
    }
  };
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
} from "@de-novo/canvas/2d";
