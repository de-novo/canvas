/**
 * 2D affine transforms, in the same `[a, b, c, d, e, f]` order the Canvas API
 * uses. Pure maths with no scene or renderer state.
 */

export type Canvas2DMatrix = readonly [
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number
];

export type Canvas2DNodeRenderTransform = {
  readonly position: readonly [number, number];
  readonly rotation: number;
  readonly scale: readonly [number, number];
};

export const CANVAS_2D_IDENTITY_MATRIX: Canvas2DMatrix = [1, 0, 0, 1, 0, 0];

export function createCanvas2DTransformMatrix(
  transform: Canvas2DNodeRenderTransform
): Canvas2DMatrix {
  const cosine = Math.cos(transform.rotation);
  const sine = Math.sin(transform.rotation);
  return [
    cosine * transform.scale[0],
    sine * transform.scale[0],
    -sine * transform.scale[1],
    cosine * transform.scale[1],
    transform.position[0],
    transform.position[1]
  ];
}

export function multiplyCanvas2DMatrices(
  left: Canvas2DMatrix,
  right: Canvas2DMatrix
): Canvas2DMatrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5]
  ];
}

export function transformCanvas2DPoint(
  matrix: Canvas2DMatrix,
  point: readonly [number, number]
): readonly [number, number] {
  return [
    matrix[0] * point[0] + matrix[2] * point[1] + matrix[4],
    matrix[1] * point[0] + matrix[3] * point[1] + matrix[5]
  ];
}

export function applyCanvas2DMatrix(
  context: CanvasRenderingContext2D,
  matrix: Canvas2DMatrix
) {
  context.transform(
    matrix[0],
    matrix[1],
    matrix[2],
    matrix[3],
    matrix[4],
    matrix[5]
  );
}

export function invertCanvas2DMatrix(
  matrix: Canvas2DMatrix,
  errorMessage: string
): Canvas2DMatrix {
  const inverse = tryInvertCanvas2DMatrix(matrix);

  if (!inverse) {
    throw new Error(errorMessage);
  }

  return inverse;
}

export function tryInvertCanvas2DMatrix(
  matrix: Canvas2DMatrix
): Canvas2DMatrix | null {
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];

  if (Math.abs(determinant) <= Number.EPSILON) {
    return null;
  }

  return [
    matrix[3] / determinant,
    -matrix[1] / determinant,
    -matrix[2] / determinant,
    matrix[0] / determinant,
    (matrix[2] * matrix[5] - matrix[3] * matrix[4]) / determinant,
    (matrix[1] * matrix[4] - matrix[0] * matrix[5]) / determinant
  ];
}

/** Wraps a rotation delta into (-π, π] so repeated drags do not accumulate. */
export function normalizeAngleDelta(angle: number): number {
  if (!Number.isFinite(angle)) {
    throw new TypeError("Canvas2D rotation delta must be finite.");
  }

  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
