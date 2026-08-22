/**
 * Svelte adapter for Denovo Canvas. Re-exports the {@link DenovoCanvas}
 * component, which mounts a {@link createCanvas} runtime on a host `<div>`,
 * keeps it in sync with the reactive `scene` prop, and destroys it on
 * unmount.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { DenovoCanvas } from "@denovo/svelte-canvas";
 *   const scene = { id: "demo", mode: "3d", layers: [{ id: "default", name: "Default" }], nodes: [] };
 * </script>
 *
 * <DenovoCanvas {scene} />
 * ```
 */
export { default as DenovoCanvas } from "./DenovoCanvas.svelte";

export {
  createCanvas,
  type DenovoCanvasCommonConfig,
  type DenovoCanvasRuntime
} from "@denovo/canvas";
export type { CanvasSceneInput } from "@denovo/canvas-core";
