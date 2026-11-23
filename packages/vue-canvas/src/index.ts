import {
  computed,
  defineComponent,
  getCurrentScope,
  h,
  onBeforeUnmount,
  onMounted,
  onScopeDispose,
  shallowRef,
  watch,
  type ComputedRef,
  type PropType
} from "vue";
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
} from "@denovo/canvas";
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
      default: undefined
    },
    /** Optional editor to auto-connect on ready and disconnect on unmount. */
    editor: {
      type: Object as PropType<CanvasEditor>,
      default: undefined
    },
    /** Options forwarded to `createCanvas`. Only read on mount. */
    options: {
      type: Object as PropType<DenovoCanvasCommonConfig>,
      default: () => ({}) as DenovoCanvasCommonConfig
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
    runtimeChange: (runtime: DenovoCanvasRuntime | null) =>
      runtime === null || typeof runtime === "object"
  },
  setup(props, { emit, expose }) {
    const hostElement = shallowRef<HTMLDivElement | null>(null);
    const runtime = shallowRef<DenovoCanvasRuntime | null>(null);

    onMounted(() => {
      if (!hostElement.value) {
        return;
      }

      const created =
        props.editor !== undefined
          ? createCanvas(hostElement.value, {
              editor: props.editor,
              ...(props.options ?? {})
            })
          : createCanvas(hostElement.value, {
              ...(props.scene === undefined ? {} : { scene: props.scene }),
              ...(props.options ?? {})
            });
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
        if (props.editor !== undefined || next === undefined) {
          return;
        }
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

/**
 * Subscribes a Vue component or effect scope to a derived slice of a
 * {@link CanvasEditor}. Updates only when `equals(previous, next)` returns
 * `false` (defaults to `Object.is`; pass `shallowEqual` for derived objects
 * or arrays) and disposes automatically with the active Vue effect scope.
 */
export function useCanvasSelector<TSelected>(
  editor: CanvasEditor,
  selector: CanvasSelector<TSelected>,
  equals?: CanvasSelectorEquality<TSelected>
): ComputedRef<TSelected> {
  const selected = shallowRef<TSelected>(selector(editor.getState()));
  const unsubscribe = subscribeCanvasSelector(
    editor,
    selector,
    (next) => {
      selected.value = next;
    },
    equals === undefined ? undefined : { equals }
  );

  if (getCurrentScope()) {
    onScopeDispose(unsubscribe);
  }

  return computed(() => selected.value);
}

export type DenovoCanvasInstance = InstanceType<typeof DenovoCanvas>;

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
} from "@denovo/canvas";
export type { CanvasSceneInput } from "@denovo/canvas-core";
