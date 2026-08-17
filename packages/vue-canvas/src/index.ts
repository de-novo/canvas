import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
  type PropType
} from "vue";
import {
  createCanvas,
  type CreateCanvasOptions,
  type DynamicCanvasRuntime
} from "@denovo/canvas-web";
import type { CanvasSceneInput } from "@denovo/canvas-core";

/**
 * Vue 3 adapter for Denovo Canvas. Mounts a {@link createCanvas} runtime on a
 * host `<div>`, keeps it in sync with a reactive `scene` prop, and destroys it
 * on unmount. Mirrors the `CanvasView` pattern from `@denovo/react-canvas` so
 * the same document/runtime model works across frameworks.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { DenovoCanvas } from "@denovo/vue-canvas";
 * const scene = { id: "demo", mode: "3d", layers: [{ id: "default", name: "Default" }], nodes: [] };
 * </script>
 * <template>
 *   <DenovoCanvas :scene="scene" @runtime-change="(r) => (runtime = r)" />
 * </template>
 * ```
 */
export const DenovoCanvas = defineComponent({
  name: "DenovoCanvas",
  props: {
    /** Scene document to render. Reactive: changing it calls `runtime.update`. */
    scene: {
      type: Object as PropType<CanvasSceneInput>,
      required: true
    },
    /** Options forwarded to `createCanvas`. Only read on mount. */
    options: {
      type: Object as PropType<CreateCanvasOptions>,
      default: () => ({}) as CreateCanvasOptions
    },
    /** Class binding for the host element. */
    hostClass: {
      type: [String, Object, Array] as PropType<
        string | Record<string, boolean> | Array<string | Record<string, boolean>>
      >,
      default: undefined
    },
    /** Inline style binding for the host element. */
    hostStyle: {
      type: [Object, String] as PropType<
        Record<string, string> | string
      >,
      default: undefined
    }
  },
  emits: {
    /**
     * Emitted with the runtime after mount and with `null` before unmount.
     * Use this to reach the imperative runtime from a parent.
     */
    runtimeChange: (runtime: DynamicCanvasRuntime | null) =>
      runtime === null || typeof runtime === "object"
  },
  setup(props, { emit, expose }) {
    const hostElement = shallowRef<HTMLDivElement | null>(null);
    const runtime = shallowRef<DynamicCanvasRuntime | null>(null);

    onMounted(() => {
      if (!hostElement.value) {
        return;
      }

      const created = createCanvas(hostElement.value, props.scene, props.options);
      runtime.value = created;
      emit("runtimeChange", created);
    });

    onBeforeUnmount(() => {
      runtime.value?.destroy();
      runtime.value = null;
      emit("runtimeChange", null);
    });

    watch(
      () => props.scene,
      (next) => {
        runtime.value?.update(next);
      }
    );

    expose({
      /** Returns the current runtime, or `null` before mount / after unmount. */
      getRuntime: () => runtime.value
    });

    return () =>
      h("div", {
        ref: hostElement,
        class: props.hostClass,
        style:
          typeof props.hostStyle === "string"
            ? { minHeight: "320px", ...(parseInlineStyle(props.hostStyle)) }
            : { minHeight: "320px", ...(props.hostStyle ?? {}) }
      });
  }
});

function parseInlineStyle(value: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const declaration of value.split(";")) {
    const index = declaration.indexOf(":");

    if (index === -1) {
      continue;
    }

    const key = declaration.slice(0, index).trim();
    const cssValue = declaration.slice(index + 1).trim();

    if (key) {
      result[key] = cssValue;
    }
  }

  return result;
}

export type DenovoCanvasInstance = InstanceType<typeof DenovoCanvas>;

export {
  createCanvas,
  type CreateCanvasOptions,
  type DynamicCanvasRuntime
} from "@denovo/canvas-web";
export type { CanvasSceneInput } from "@denovo/canvas-core";
