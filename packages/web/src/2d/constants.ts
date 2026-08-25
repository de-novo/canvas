/**
 * Drawing and hit-testing constants for the 2D renderer.
 *
 * Rendering and hit-testing must agree on these: a label drawn with one font
 * and hit-tested with another would be clickable somewhere it is not visible.
 * Keeping them in one module makes that coupling explicit.
 */

/** Length of a transform gizmo's axis arms, in screen pixels. */
export const CANVAS_2D_HANDLE_LENGTH = 64;

export const CANVAS_2D_MEASUREMENT_FONT = "12px sans-serif";
export const CANVAS_2D_ANNOTATION_FONT = "14px sans-serif";
export const CANVAS_2D_MEASUREMENT_LABEL_OFFSET = 6;
export const CANVAS_2D_ANNOTATION_TEXT_OFFSET = [10, -8] as const;

/** Half-width of the clickable band along a measurement segment. */
export const CANVAS_2D_SEGMENT_HIT_TOLERANCE = 6;

/** Drawn radius of an endpoint anchor, and the larger radius it is grabbed by. */
export const CANVAS_2D_ANCHOR_RADIUS = 4;
export const CANVAS_2D_ANCHOR_HIT_RADIUS = 8;

/** Connection ports: drawn smaller than they are clickable, as with anchors. */
export const CANVAS_2D_CONNECTION_HANDLE_RADIUS = 5;
export const CANVAS_2D_CONNECTION_HANDLE_HIT_RADIUS = 9;

/** Inset between the minimap canvas edge and its content. */
export const CANVAS_2D_MINIMAP_PADDING = 8;

/** World size of the placeholder drawn for a 2D plugin kind without a drawer. */
export const CANVAS_2D_PLUGIN_MARKER_SIZE = 48;
