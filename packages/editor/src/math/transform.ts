import type { Point2, Vector3 } from "@de-novo/canvas-core";
import type { CanvasNodeByType } from "@de-novo/canvas-core";
import { CanvasEditorError } from "../errors.js";

type Transform2D = Pick<
  CanvasNodeByType<"2d", "group">,
  "position" | "rotation" | "scale"
>;

type Transform3D = Pick<
  CanvasNodeByType<"3d", "group">,
  "position" | "rotation" | "scale"
>;

type Matrix2 = readonly [number, number, number, number];

type Matrix3 = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

export const TRANSFORM_EPSILON = 1e-10;

/**
 * Transforms a 2D point by a 2D transform (position, rotation, scale).
 */
export function transformPoint2(transform: Transform2D, point: Point2): Point2 {
  const [x, y] = point;
  const scaledX = x * transform.scale[0];
  const scaledY = y * transform.scale[1];
  const cosine = Math.cos(transform.rotation);
  const sine = Math.sin(transform.rotation);
  return [
    transform.position[0] + cosine * scaledX - sine * scaledY,
    transform.position[1] + sine * scaledX + cosine * scaledY
  ];
}

/**
 * Composes two 2D transforms into a single transform.
 */
export function compose2DTransforms(
  parent: Transform2D,
  child: Transform2D
): Transform2D {
  const parentMatrix = createRotationScaleMatrix2(
    parent.rotation,
    parent.scale
  );
  const childMatrix = createRotationScaleMatrix2(
    child.rotation,
    child.scale
  );
  const matrix = multiplyMatrix2(parentMatrix, childMatrix);
  const columnX: Point2 = [matrix[0], matrix[2]];
  const columnY: Point2 = [matrix[1], matrix[3]];
  const lengthX = Math.hypot(...columnX);
  const lengthY = Math.hypot(...columnY);
  const dot = columnX[0] * columnY[0] + columnX[1] * columnY[1];

  if (
    lengthX <= TRANSFORM_EPSILON ||
    lengthY <= TRANSFORM_EPSILON ||
    Math.abs(dot) > TRANSFORM_EPSILON * lengthX * lengthY
  ) {
    throw new CanvasEditorError(
      "invalid-command",
      "Ungrouping would require a non-representable 2D shear or degenerate transform."
    );
  }

  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  return {
    position: transformPoint2(parent, child.position),
    rotation: Math.atan2(columnX[1], columnX[0]),
    scale: [lengthX, determinant / lengthX]
  };
}

/**
 * Creates a 2D rotation-scale matrix.
 */
function createRotationScaleMatrix2(
  rotation: number,
  scale: Point2
): Matrix2 {
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  return [
    cosine * scale[0],
    -sine * scale[1],
    sine * scale[0],
    cosine * scale[1]
  ];
}

/**
 * Multiplies two 2x2 matrices.
 */
function multiplyMatrix2(left: Matrix2, right: Matrix2): Matrix2 {
  return [
    left[0] * right[0] + left[1] * right[2],
    left[0] * right[1] + left[1] * right[3],
    left[2] * right[0] + left[3] * right[2],
    left[2] * right[1] + left[3] * right[3]
  ];
}

/**
 * Transforms a 3D point by a 3D transform (position, rotation, scale).
 */
export function transformPoint3(transform: Transform3D, point: Vector3): Vector3 {
  const matrix = createRotationScaleMatrix3(transform.rotation, transform.scale);
  return [
    transform.position[0] +
      matrix[0] * point[0] +
      matrix[1] * point[1] +
      matrix[2] * point[2],
    transform.position[1] +
      matrix[3] * point[0] +
      matrix[4] * point[1] +
      matrix[5] * point[2],
    transform.position[2] +
      matrix[6] * point[0] +
      matrix[7] * point[1] +
      matrix[8] * point[2]
  ];
}

/**
 * Composes two 3D transforms into a single transform.
 */
export function compose3DTransforms(
  parent: Transform3D,
  child: Transform3D
): Transform3D {
  const matrix = multiplyMatrix3(
    createRotationScaleMatrix3(parent.rotation, parent.scale),
    createRotationScaleMatrix3(child.rotation, child.scale)
  );
  const columnX: Vector3 = [matrix[0], matrix[3], matrix[6]];
  const columnY: Vector3 = [matrix[1], matrix[4], matrix[7]];
  const columnZ: Vector3 = [matrix[2], matrix[5], matrix[8]];
  const lengthX = vectorLength3(columnX);
  const lengthY = vectorLength3(columnY);
  const lengthZ = vectorLength3(columnZ);

  if (
    lengthX <= TRANSFORM_EPSILON ||
    lengthY <= TRANSFORM_EPSILON ||
    lengthZ <= TRANSFORM_EPSILON ||
    !vectorsAreOrthogonal(columnX, columnY, lengthX, lengthY) ||
    !vectorsAreOrthogonal(columnX, columnZ, lengthX, lengthZ) ||
    !vectorsAreOrthogonal(columnY, columnZ, lengthY, lengthZ)
  ) {
    throw new CanvasEditorError(
      "invalid-command",
      "Ungrouping would require a non-representable 3D shear or degenerate transform."
    );
  }

  const determinant = determinantMatrix3(matrix);
  const scale: Vector3 = [lengthX, lengthY, determinant / (lengthX * lengthY)];
  const rotationMatrix: Matrix3 = [
    matrix[0] / scale[0],
    matrix[1] / scale[1],
    matrix[2] / scale[2],
    matrix[3] / scale[0],
    matrix[4] / scale[1],
    matrix[5] / scale[2],
    matrix[6] / scale[0],
    matrix[7] / scale[1],
    matrix[8] / scale[2]
  ];

  return {
    position: transformPoint3(parent, child.position),
    rotation: eulerXYZFromRotationMatrix(rotationMatrix),
    scale
  };
}

/**
 * Creates a 3D rotation-scale matrix from Euler angles and scale.
 */
function createRotationScaleMatrix3(
  rotation: Vector3,
  scale: Vector3
): Matrix3 {
  const [x, y, z] = rotation;
  const cosineX = Math.cos(x);
  const sineX = Math.sin(x);
  const cosineY = Math.cos(y);
  const sineY = Math.sin(y);
  const cosineZ = Math.cos(z);
  const sineZ = Math.sin(z);
  return [
    cosineY * cosineZ * scale[0],
    -cosineY * sineZ * scale[1],
    sineY * scale[2],
    (cosineX * sineZ + sineX * cosineZ * sineY) * scale[0],
    (cosineX * cosineZ - sineX * sineZ * sineY) * scale[1],
    -sineX * cosineY * scale[2],
    (sineX * sineZ - cosineX * cosineZ * sineY) * scale[0],
    (sineX * cosineZ + cosineX * sineZ * sineY) * scale[1],
    cosineX * cosineY * scale[2]
  ];
}

/**
 * Multiplies two 3x3 matrices.
 */
function multiplyMatrix3(left: Matrix3, right: Matrix3): Matrix3 {
  return [
    left[0] * right[0] + left[1] * right[3] + left[2] * right[6],
    left[0] * right[1] + left[1] * right[4] + left[2] * right[7],
    left[0] * right[2] + left[1] * right[5] + left[2] * right[8],
    left[3] * right[0] + left[4] * right[3] + left[5] * right[6],
    left[3] * right[1] + left[4] * right[4] + left[5] * right[7],
    left[3] * right[2] + left[4] * right[5] + left[5] * right[8],
    left[6] * right[0] + left[7] * right[3] + left[8] * right[6],
    left[6] * right[1] + left[7] * right[4] + left[8] * right[7],
    left[6] * right[2] + left[7] * right[5] + left[8] * right[8]
  ];
}

/**
 * Calculates the length (magnitude) of a 3D vector.
 */
export function vectorLength3(vector: Vector3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

/**
 * Checks if two 3D vectors are orthogonal (perpendicular).
 */
function vectorsAreOrthogonal(
  left: Vector3,
  right: Vector3,
  leftLength: number,
  rightLength: number
): boolean {
  const dot =
    left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
  return Math.abs(dot) <= TRANSFORM_EPSILON * leftLength * rightLength;
}

/**
 * Calculates the determinant of a 3x3 matrix.
 */
function determinantMatrix3(matrix: Matrix3): number {
  return (
    matrix[0] * (matrix[4] * matrix[8] - matrix[5] * matrix[7]) -
    matrix[1] * (matrix[3] * matrix[8] - matrix[5] * matrix[6]) +
    matrix[2] * (matrix[3] * matrix[7] - matrix[4] * matrix[6])
  );
}

/**
 * Extracts Euler XYZ angles from a rotation matrix.
 */
function eulerXYZFromRotationMatrix(matrix: Matrix3): Vector3 {
  const y = Math.asin(Math.max(-1, Math.min(1, matrix[2])));

  if (Math.abs(matrix[2]) < 0.9999999) {
    return [
      Math.atan2(-matrix[5], matrix[8]),
      y,
      Math.atan2(-matrix[1], matrix[0])
    ];
  }

  return [Math.atan2(matrix[7], matrix[4]), y, 0];
}