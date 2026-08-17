/**
 * Authoring tools re-export hub.
 *
 * Each tool factory lives in its own module under `./tools/`. This file
 * re-exports them so consumers can keep importing from a single entrypoint.
 */

export { create2DShapeTool } from "./tools/shape-2d.js";
export { create3DPrimitiveTool } from "./tools/primitive-3d.js";
export { create3DSurfacePlacementTool } from "./tools/surface-placement.js";
export { createConnectorTool } from "./tools/connector-2d.js";
export { createDistanceMeasurementTool } from "./tools/distance-measurement.js";
export { createAnnotationTool } from "./tools/annotation.js";

export type {
  Canvas2DShapeToolOptions,
  Canvas3DPrimitiveToolOptions,
  Canvas3DSurfacePlacementToolOptions,
  CanvasConnectorToolOptions,
  CanvasDistanceMeasurementToolOptions,
  CanvasAnnotationToolOptions,
  CanvasAnnotationDraft,
  CanvasAnnotationDraftResult,
  CanvasAnnotationDraftContext,
  CanvasAnnotationDraftProvider
} from "./tool-options.js";
