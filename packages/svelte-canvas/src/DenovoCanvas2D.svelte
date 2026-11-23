<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    createCanvas,
    type Canvas2DSceneInput,
    type DenovoCanvas2DCommonConfig,
    type DenovoCanvas2DRuntime
  } from "@denovo/canvas/2d";

  /**
   * 2D scene document to render. Reactive: changing it calls `runtime.update`.
   */
  export let scene: Canvas2DSceneInput;
  /** 2D options forwarded to `createCanvas`. Only read on mount. */
  export let options: DenovoCanvas2DCommonConfig | undefined = undefined;
  /** Class binding for the host element. */
  export let hostClass: string | undefined = undefined;
  /** Inline style binding for the host element (as a style object). */
  export let hostStyle: Record<string, string> | undefined = undefined;

  let hostElement: HTMLDivElement;
  let runtime: DenovoCanvas2DRuntime | null = null;

  onMount(() => {
    runtime = createCanvas(hostElement, {
      scene,
      ...(options ?? {})
    });
  });

  onDestroy(() => {
    runtime?.destroy();
    runtime = null;
  });

  // Keep the 2D runtime scene in sync when the `scene` prop changes.
  $: if (runtime && scene) {
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
