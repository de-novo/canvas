import type { CanvasEditor, CanvasEditorState } from "./editor.js";

export type CanvasSelector<TSelected> = (
  state: CanvasEditorState
) => TSelected;

export type CanvasSelectorEquality<TSelected> = (
  previous: TSelected,
  next: TSelected
) => boolean;

export type SubscribeCanvasSelectorOptions<TSelected> = {
  readonly equals?: CanvasSelectorEquality<TSelected>;
  readonly fireImmediately?: boolean;
};

/**
 * Shallow equality helper for selector outputs (plain objects, arrays, Maps,
 * Sets, and primitives). Pair with `subscribeCanvasSelector` or framework
 * `useCanvasSelector` hooks when deriving multi-field slices.
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (
    typeof a !== "object" ||
    a === null ||
    typeof b !== "object" ||
    b === null
  ) {
    return false;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i += 1) {
      if (!Object.is(a[i], b[i])) {
        return false;
      }
    }

    return true;
  }

  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) {
    return false;
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) {
      return false;
    }

    for (const [key, value] of a) {
      if (!b.has(key) || !Object.is(value, b.get(key))) {
        return false;
      }
    }

    return true;
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) {
      return false;
    }

    for (const value of a) {
      if (!b.has(value)) {
        return false;
      }
    }

    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  const recordA = a as Record<string, unknown>;
  const recordB = b as Record<string, unknown>;

  for (let i = 0; i < keysA.length; i += 1) {
    const key = keysA[i]!;

    if (
      !Object.prototype.hasOwnProperty.call(recordB, key) ||
      !Object.is(recordA[key], recordB[key])
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Framework-agnostic fine-grained subscription for a {@link CanvasEditor}.
 * Evaluates `selector` on editor changes and invokes `listener` only when
 * `equals(previous, next)` returns `false` (defaults to `Object.is`).
 */
export function subscribeCanvasSelector<TSelected>(
  editor: CanvasEditor,
  selector: CanvasSelector<TSelected>,
  listener: (next: TSelected, previous: TSelected) => void,
  options?: SubscribeCanvasSelectorOptions<TSelected>
): () => void {
  const equals: CanvasSelectorEquality<TSelected> =
    options?.equals ?? Object.is;
  let current = selector(editor.getState());

  if (options?.fireImmediately) {
    listener(current, current);
  }

  return editor.subscribe((state) => {
    const next = selector(state);

    if (equals(current, next)) {
      return;
    }

    const previous = current;
    current = next;
    listener(next, previous);
  });
}
