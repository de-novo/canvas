/**
 * Text measurement and measurement-label formatting, shared by rendering and
 * hit-testing so a label's drawn box and its clickable box always agree.
 *
 * `measureCanvas2DText` and `wrapCanvas2DText` read from the passed context but
 * never draw, and restore any font they set.
 */
import type { Canvas2DNode } from "@de-novo/canvas-core";

import { transformCanvas2DPoint, type Canvas2DMatrix } from "./matrix";

type Canvas2DMeasurementNode = Extract<Canvas2DNode, { type: "measurement" }>;

export function resolveCanvas2DMeasurementLabel(
  node: Canvas2DMeasurementNode,
  parentWorldTransform: Canvas2DMatrix
): string {
  const worldStart = transformCanvas2DPoint(parentWorldTransform, node.start);
  const worldEnd = transformCanvas2DPoint(parentWorldTransform, node.end);
  const distanceInMeters = Math.hypot(
    worldEnd[0] - worldStart[0],
    worldEnd[1] - worldStart[1]
  );
  const value = distanceInMeters / node.unit.metersPerUnit;
  return `${formatCanvas2DMeasurementValue(value, node.precision)} ${node.unit.symbol}`;
}
export function formatCanvas2DMeasurementValue(
  value: number,
  precision: number
): string {
  if (precision <= 100) {
    return value.toFixed(precision);
  }

  return `${value.toFixed(100)}${"0".repeat(precision - 100)}`;
}
export function measureCanvas2DText(
  context: CanvasRenderingContext2D,
  font: string,
  text: string
): number {
  context.save();
  context.font = font;
  const width = context.measureText(text).width;
  context.restore();
  return width;
}
export function wrapCanvas2DText(
  context: CanvasRenderingContext2D,
  font: string,
  text: string,
  width: number | null
): string[] {
  if (width === null) {
    return text.split("\n");
  }

  const result: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(" ");
    let current = "";
    for (const word of words) {
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      if (measureCanvas2DText(context, font, candidate) > width && current.length > 0) {
        result.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current.length > 0) {
      result.push(current);
    }
  }
  return result;
}
