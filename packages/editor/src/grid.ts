import {
  CanvasGridSchema,
  CanvasGridSnapRequestSchema,
  CanvasGridSnapResultSchema,
  CanvasWorkPlaneSchema,
  type Canvas2DGrid,
  type Canvas3DGrid,
  type CanvasGridSnapRequest,
  type CanvasGridSnapRequestFor,
  type CanvasGridSnapResult,
  type CanvasGridSnapResultFor,
  type CanvasWorkPlane,
  type Point2,
  type Vector3
} from "@denovo/canvas-core";
import { CanvasEditorError } from "./errors.js";
import { TRANSFORM_EPSILON, vectorLength3 } from "./math/transform.js";

export function snapPointToGrid(
  request: CanvasGridSnapRequestFor<"2d">
): CanvasGridSnapResultFor<"2d">;
export function snapPointToGrid(
  request: CanvasGridSnapRequestFor<"3d">
): CanvasGridSnapResultFor<"3d">;
export function snapPointToGrid(
  requestInput: CanvasGridSnapRequest
): CanvasGridSnapResult {
  let request: CanvasGridSnapRequest;

  try {
    request = CanvasGridSnapRequestSchema.parse(requestInput);
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "Grid snap request validation failed.",
      { cause }
    );
  }

  if (request.mode === "2d") {
    const position: Point2 = [
      request.grid.origin[0] +
        Math.round(
          (request.position[0] - request.grid.origin[0]) /
            request.grid.spacing[0]
        ) *
          request.grid.spacing[0],
      request.grid.origin[1] +
        Math.round(
          (request.position[1] - request.grid.origin[1]) /
            request.grid.spacing[1]
        ) *
          request.grid.spacing[1]
    ];
    return CanvasGridSnapResultSchema.parse({
      kind: "grid",
      mode: "2d",
      position
    });
  }

  const delta: Vector3 = [
    request.position[0] - request.grid.origin[0],
    request.position[1] - request.grid.origin[1],
    request.position[2] - request.grid.origin[2]
  ];
  const axisULength = vectorLength3(request.grid.axisU);
  const axisVLength = vectorLength3(request.grid.axisV);

  if (axisULength <= TRANSFORM_EPSILON || axisVLength <= TRANSFORM_EPSILON) {
    throw new CanvasEditorError(
      "invalid-command",
      "3D grid axes must have a stable non-zero length."
    );
  }

  const axisU: Vector3 = [
    request.grid.axisU[0] / axisULength,
    request.grid.axisU[1] / axisULength,
    request.grid.axisU[2] / axisULength
  ];
  const axisV: Vector3 = [
    request.grid.axisV[0] / axisVLength,
    request.grid.axisV[1] / axisVLength,
    request.grid.axisV[2] / axisVLength
  ];
  const uu = dotVector3(axisU, axisU);
  const uv = dotVector3(axisU, axisV);
  const vv = dotVector3(axisV, axisV);
  const determinant = uu * vv - uv * uv;

  if (!Number.isFinite(determinant) || determinant <= TRANSFORM_EPSILON) {
    throw new CanvasEditorError(
      "invalid-command",
      "3D grid axes do not define a stable snap basis."
    );
  }

  const deltaU = dotVector3(delta, axisU);
  const deltaV = dotVector3(delta, axisV);
  const coordinateU = (deltaU * vv - deltaV * uv) / determinant;
  const coordinateV = (deltaV * uu - deltaU * uv) / determinant;
  const snappedU =
    Math.round(coordinateU / request.grid.spacing[0]) *
    request.grid.spacing[0];
  const snappedV =
    Math.round(coordinateV / request.grid.spacing[1]) *
    request.grid.spacing[1];
  const position: Vector3 = [
    request.grid.origin[0] + axisU[0] * snappedU + axisV[0] * snappedV,
    request.grid.origin[1] + axisU[1] * snappedU + axisV[1] * snappedV,
    request.grid.origin[2] + axisU[2] * snappedU + axisV[2] * snappedV
  ];
  return CanvasGridSnapResultSchema.parse({
    kind: "grid",
    mode: "3d",
    position
  });
}

export function validateGridWorkPlaneCompatibility(
  gridInput: Canvas3DGrid,
  workPlaneInput: CanvasWorkPlane
): void {
  const grid = parse3DGrid(gridInput);
  const workPlane = parseWorkPlane(workPlaneInput);
  const normalLength = vectorLength3(workPlane.normal);
  const originDistance =
    dotVector3(workPlane.normal, grid.origin) + workPlane.constant;
  const axisUTangent = dotVector3(workPlane.normal, grid.axisU);
  const axisVTangent = dotVector3(workPlane.normal, grid.axisV);
  const tolerance = 1e-8 * normalLength;

  if (
    Math.abs(originDistance) > tolerance * Math.max(1, vectorLength3(grid.origin)) ||
    Math.abs(axisUTangent) > tolerance * vectorLength3(grid.axisU) ||
    Math.abs(axisVTangent) > tolerance * vectorLength3(grid.axisV)
  ) {
    throw new CanvasEditorError(
      "invalid-command",
      "The 3D grid must lie on the authoring work plane."
    );
  }
}

export function dotVector3(left: Vector3, right: Vector3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

export function parse2DGrid(gridInput: Canvas2DGrid): Canvas2DGrid {
  try {
    const grid = CanvasGridSchema.parse(gridInput);

    if (grid.mode !== "2d") {
      throw new CanvasEditorError("mode-mismatch", "Expected a 2D grid.");
    }

    return grid;
  } catch (cause) {
    if (cause instanceof CanvasEditorError) {
      throw cause;
    }

    throw new CanvasEditorError("invalid-command", "2D grid validation failed.", {
      cause
    });
  }
}

export function parse3DGrid(gridInput: Canvas3DGrid): Canvas3DGrid {
  try {
    const grid = CanvasGridSchema.parse(gridInput);

    if (grid.mode !== "3d") {
      throw new CanvasEditorError("mode-mismatch", "Expected a 3D grid.");
    }

    return grid;
  } catch (cause) {
    if (cause instanceof CanvasEditorError) {
      throw cause;
    }

    throw new CanvasEditorError("invalid-command", "3D grid validation failed.", {
      cause
    });
  }
}

export function parseWorkPlane(workPlaneInput: CanvasWorkPlane): CanvasWorkPlane {
  try {
    return CanvasWorkPlaneSchema.parse(workPlaneInput);
  } catch (cause) {
    throw new CanvasEditorError(
      "invalid-command",
      "Work-plane validation failed.",
      { cause }
    );
  }
}