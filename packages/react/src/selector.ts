"use client";

import type {
  CanvasEditor,
  CanvasEditorState,
  CanvasSelector,
  CanvasSelectorEquality
} from "@de-novo/canvas/2d";
import { useCallback, useRef, useSyncExternalStore } from "react";

/**
 * Subscribes a React component to a derived slice of a {@link CanvasEditor}
 * using `useSyncExternalStore`. Re-renders only when `equals(previous, next)`
 * returns `false` (defaults to `Object.is`; pass `shallowEqual` for derived
 * objects or arrays).
 */
export function useCanvasSelector<TSelected>(
  editor: CanvasEditor,
  selector: CanvasSelector<TSelected>,
  equals: CanvasSelectorEquality<TSelected> = Object.is
): TSelected {
  const selectorRef = useRef(selector);
  const equalsRef = useRef(equals);
  selectorRef.current = selector;
  equalsRef.current = equals;

  const cacheRef = useRef<{
    editor: CanvasEditor;
    hasValue: boolean;
    selected: TSelected;
    selector: CanvasSelector<TSelected> | null;
    state: CanvasEditorState | null;
  }>({
    editor,
    hasValue: false,
    selected: undefined as TSelected,
    selector: null,
    state: null
  });

  const getSnapshot = useCallback((): TSelected => {
    const state = editor.getState();
    const cache = cacheRef.current;
    const currentSelector = selectorRef.current;

    if (
      cache.hasValue &&
      cache.editor === editor &&
      cache.state === state &&
      cache.selector === currentSelector
    ) {
      return cache.selected;
    }

    const next = currentSelector(state);

    if (
      cache.hasValue &&
      cache.editor === editor &&
      equalsRef.current(cache.selected, next)
    ) {
      cache.state = state;
      cache.selector = currentSelector;
      return cache.selected;
    }

    cache.editor = editor;
    cache.hasValue = true;
    cache.selected = next;
    cache.selector = currentSelector;
    cache.state = state;
    return next;
  }, [editor]);

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      editor.subscribe((state) => {
        const cache = cacheRef.current;
        const currentSelector = selectorRef.current;
        const next = currentSelector(state);

        if (
          cache.hasValue &&
          cache.editor === editor &&
          equalsRef.current(cache.selected, next)
        ) {
          cache.state = state;
          cache.selector = currentSelector;
          return;
        }

        cache.editor = editor;
        cache.hasValue = true;
        cache.selected = next;
        cache.selector = currentSelector;
        cache.state = state;
        onStoreChange();
      }),
    [editor]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
