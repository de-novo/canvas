import type { NodeId } from "@de-novo/canvas-core";

/**
 * Checks if a value is a plain object (not null, not array, not function).
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep equality check using JSON serialization.
 */
export function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Removes duplicate IDs from an array while preserving order.
 */
export function uniqueIds(ids: readonly NodeId[]): NodeId[] {
  return [...new Set(ids)];
}

/**
 * Deep freezes an object and all its nested properties recursively.
 */
export function freezeValue<Value>(value: Value): Value {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      freezeValue(value[i]);
    }
    return Object.freeze(value);
  }

  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      freezeValue(value[key]);
    }
  }

  return Object.freeze(value);
}