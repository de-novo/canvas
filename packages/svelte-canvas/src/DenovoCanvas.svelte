<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    createCanvas,
    type CreateCanvasOptions,
    type DynamicCanvasRuntime
  } from "@denovo/canvas-web";
  import type { CanvasSceneInput } from "@denovo/canvas-core";

  /**
   * Scene document to render. Reactive: changing it calls `runtime.update`.
   */
  export let scene: CanvasSceneInput;
  /** Options forwarded to `createCanvas`. Only read on mount. */
  export let options: CreateCanvasOptions | undefined = undefined;
  /** Class binding for the host element. */
  export let hostClass: string | undefined = undefined;
  /** Inline style binding for the host element (as a style object). */
  export let hostStyle: Record<string, string> | undefined = undefined;

  let hostElement: HTMLDivElement;
  let runtime: DynamicCanvasRuntime | null = null;

  onMount(() => {
    runtime = createCanvas(hostElement, scene, options ?? {});
  });

  onDestroy(() => {
    runtime?.destroy();
    runtime = null;
  });

  // Keep the runtime scene in sync when the `scene` prop changes.
  $: if (runtime && scene) {
    runtime.update(scene);
  }

  const styleString = $hostStyle
    ? Object.entries($hostStyle)
        .map(([key, value]) => `${key}: ${value}`)
        .join("; ")
    : undefined;
</script>

<div
  bind:this={hostElement}
  class={hostClass}
  style="min-height: 320px{styleString ? `; ${styleString}` : ''}"
/>
