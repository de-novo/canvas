import { setFieldPattern } from "@denovo/canvas";

import { FIELD_NODE_ID } from "./document";

export type FieldPattern = "letters" | "streaks";

export function applyFieldPatternOps(pattern: FieldPattern) {
  return [setFieldPattern({ nodeId: FIELD_NODE_ID, pattern })];
}
