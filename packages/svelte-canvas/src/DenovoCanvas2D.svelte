<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    createCanvas,
    type Canvas2DSceneInput,
    type CanvasEditor,
    type DenovoCanvas2DCommonConfig,
    type DenovoCanvas2DRuntime
  } from "@de-novo/canvas/2d";

  /**
   * 2D scene document to render. Reactive: changing it calls `runtime.update`.
   */
  export let scene: Canvas2DSceneInput | undefined = undefined;
  /** Optional 2D editor to auto-connect on ready and disconnect on unmount. */
  export let editor: CanvasEditor | undefined = undefined;
  /** 2D options forwarded to `createCanvas`. Only read on mount. */
  export let options: DenovoCanvas2DCommonConfig | undefined = undefined;
  /** Class binding for the host element. */
  export let hostClass: string | undefined = undefined;
  /** Inline style binding for the host element (as a style object). */
  export let hostStyle: Record<string, string> | undefined = undefined;

  let hostElement: HTMLDivElement;
  let runtime: DenovoCanvas2DRuntime | null = null;

  onMount(() => {
    runtime =
      editor !== undefined
        ? createCanvas(hostElement, {
            editor,
            ...(options ?? {})
          })
        : createCanvas(hostElement, {
            ...(scene === undefined ? {} : { scene }),
            ...(options ?? {})
          });
  });

  onDestroy(() => {
    runtime?.destroy();
    runtime = null;
  });

  // Keep the 2D runtime scene in sync when the `scene` prop changes.
  $: if (runtime && editor === undefined && scene) {
    runtime.update(scene);
  }

  $: styleString = hostStyle
    ? Object.entries(hostStyle)
        .map(([key, value]) => `${key}: ${value}`)
        .join("; ")
    : undefined;
</script>

<div
  bind:this={hostElement}
  class={hostClass}
  style="min-height: 320px{styleString ? `; ${styleString}` : ''}"
/>
