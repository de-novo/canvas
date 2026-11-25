/**
 * Svelte adapter for Denovo Canvas. Re-exports the {@link DenovoCanvas}
 * component, which mounts a {@link createCanvas} runtime on a host `<div>`,
 * keeps it in sync with the reactive `scene` prop, and destroys it on
 * unmount.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { DenovoCanvas } from "@de-novo/svelte-canvas";
 *   const scene = { id: "demo", mode: "3d", layers: [{ id: "default", name: "Default" }], nodes: [] };
 * </script>
 *
 * <DenovoCanvas {scene} />
 * ```
 */
import {
  subscribeCanvasSelector,
  type CanvasEditor,
  type CanvasSelector,
  type CanvasSelectorEquality
} from "@de-novo/canvas";

export { default as DenovoCanvas } from "./DenovoCanvas.svelte";

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
  type CanvasEditor,
  type CanvasEditorState,
  type CanvasSelector,
  type CanvasSelectorEquality,
  type DenovoCanvasCommonConfig,
  type DenovoCanvasRuntime
} from "@de-novo/canvas";
export type { CanvasSceneInput } from "@de-novo/canvas-core";
