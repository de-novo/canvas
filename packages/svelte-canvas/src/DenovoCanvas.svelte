<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    createCanvas,
    type CanvasEditor,
    type DenovoCanvasCommonConfig,
    type DenovoCanvasRuntime
  } from "@de-novo/canvas";
  import type { CanvasSceneInput } from "@de-novo/canvas-core";

  /**
   * Scene document to render. Reactive: changing it calls `runtime.update`.
   */
  export let scene: CanvasSceneInput | undefined = undefined;
  /** Optional editor to auto-connect on ready and disconnect on unmount. */
  export let editor: CanvasEditor | undefined = undefined;
  /** Options forwarded to `createCanvas`. Only read on mount. */
  export let options: DenovoCanvasCommonConfig | undefined = undefined;
  /** Class binding for the host element. */
  export let hostClass: string | undefined = undefined;
  /** Inline style binding for the host element (as a style object). */
  export let hostStyle: Record<string, string> | undefined = undefined;

  let hostElement: HTMLDivElement;
  let runtime: DenovoCanvasRuntime | null = null;

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

  // Keep the runtime scene in sync when the `scene` prop changes.
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
