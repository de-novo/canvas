/** 1k-boxes target from docs/m4-performance-thresholds.md. */
export const FRAME_BUDGET_MS = 16;
export const FRAME_BUDGET_WORKLOAD = "1k-boxes";

const SOFTWARE_RENDERER =
  /swiftshader|llvmpipe|softpipe|microsoft basic render|apple software renderer|gdi generic/i;

/**
 * @param {unknown} renderer
 * @returns {"gpu" | "software" | "unknown"}
 */
export function classifyGlRenderer(renderer) {
  if (typeof renderer !== "string" || renderer.length === 0) {
    return "unknown";
  }
  if (SOFTWARE_RENDERER.test(renderer)) {
    return "software";
  }
  return "gpu";
}

/**
 * @param {{
 *   kind: "gpu" | "software" | "unknown",
 *   p50: number,
 *   targetMs?: number,
 *   workload: string
 * }} input
 * @returns {{
 *   gated: boolean,
 *   passed: boolean,
 *   reason: string
 * }}
 */
export function evaluateFrameBudget(input) {
  const targetMs = input.targetMs ?? FRAME_BUDGET_MS;
  if (input.workload !== FRAME_BUDGET_WORKLOAD) {
    return { gated: false, passed: true, reason: "not-target-workload" };
  }
  if (input.kind !== "gpu") {
    return { gated: false, passed: true, reason: `environment-${input.kind}` };
  }
  if (!(input.p50 <= targetMs)) {
    return { gated: true, passed: false, reason: "over-budget" };
  }
  return { gated: true, passed: true, reason: "gpu-within-budget" };
}
