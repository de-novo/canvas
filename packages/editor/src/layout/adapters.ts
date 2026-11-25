import type {
  CanvasLayoutAdapter,
  CanvasLayoutInput,
  CanvasLayoutPlacement,
  CanvasLayoutResult,
  CanvasRectBounds
} from "@de-novo/canvas-core";

export type CanvasAlignAxis =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom";

export type CanvasDistributeAxis = "horizontal" | "vertical";

/**
 * Aligns nodes to a shared edge or centre of the selection's overall bounds.
 *
 * Alignment moves a node by the delta between its own bounds and the target
 * line, not by setting `position` directly — a node's `position` is not
 * necessarily its top-left corner (a circle's is its centre), so working in
 * bounds space keeps every node type correct.
 */
export function createAlignAdapter(axis: CanvasAlignAxis): CanvasLayoutAdapter {
  return {
    name: `align.${axis}`,
    kind: "arrange",
    label: `Align ${axis.replace("-", " ")}`,
    apply(input) {
      // Aligning by edge or centre is meaningless without real sizes.
      if (input.nodes.length < 2 || !input.measured) {
        return { positions: [] };
      }

      const extent = unionBounds(input.nodes.map((node) => node.bounds));
      const positions: CanvasLayoutPlacement[] = [];

      for (const node of input.nodes) {
        const delta = resolveAlignDelta(axis, node.bounds, extent);

        if (delta[0] === 0 && delta[1] === 0) {
          continue;
        }

        positions.push({
          id: node.id,
          position: [node.position[0] + delta[0], node.position[1] + delta[1]]
        });
      }

      return { positions };
    }
  };
}

/**
 * Spreads nodes so the gaps between them are equal, keeping the two outermost
 * nodes fixed. Distributing fewer than three nodes is a no-op: with two there
 * is only one gap, so there is nothing to equalise.
 */
export function createDistributeAdapter(
  axis: CanvasDistributeAxis
): CanvasLayoutAdapter {
  return {
    name: `distribute.${axis}`,
    kind: "arrange",
    label: `Distribute ${axis}`,
    apply(input) {
      if (input.nodes.length < 3 || !input.measured) {
        return { positions: [] };
      }

      const horizontal = axis === "horizontal";
      const ordered = [...input.nodes].sort((left, right) =>
        horizontal
          ? left.bounds.minX - right.bounds.minX
          : left.bounds.minY - right.bounds.minY
      );

      const first = ordered[0]!;
      const last = ordered[ordered.length - 1]!;
      const span = horizontal
        ? last.bounds.maxX - first.bounds.minX
        : last.bounds.maxY - first.bounds.minY;
      const totalSize = ordered.reduce(
        (sum, node) => sum + boundsSize(node.bounds, horizontal),
        0
      );
      const gap = (span - totalSize) / (ordered.length - 1);

      const positions: CanvasLayoutPlacement[] = [];
      let cursor = horizontal ? first.bounds.minX : first.bounds.minY;

      for (const node of ordered) {
        const current = horizontal ? node.bounds.minX : node.bounds.minY;
        const delta = cursor - current;

        if (node !== first && node !== last && delta !== 0) {
          positions.push({
            id: node.id,
            position: horizontal
              ? [node.position[0] + delta, node.position[1]]
              : [node.position[0], node.position[1] + delta]
          });
        }

        cursor += boundsSize(node.bounds, horizontal) + gap;
      }

      return { positions };
    }
  };
}

export type CanvasGridLayoutOptions = {
  readonly columns?: number;
  readonly gap?: number;
  readonly origin?: readonly [number, number];
};

/**
 * Places every node on a fixed grid. Exists mainly to prove the `layout` kind
 * end to end — a hierarchical/graph engine plugs in the same way.
 */
export function createGridLayoutAdapter(
  options: CanvasGridLayoutOptions = {}
): CanvasLayoutAdapter {
  const gap = options.gap ?? 40;

  return {
    name: "layout.grid",
    kind: "layout",
    label: "Grid layout",
    apply(input) {
      if (input.nodes.length === 0) {
        return { positions: [] };
      }

      const columns =
        options.columns ?? Math.max(1, Math.ceil(Math.sqrt(input.nodes.length)));
      const origin = options.origin ?? [
        Math.min(...input.nodes.map((node) => node.bounds.minX)),
        Math.min(...input.nodes.map((node) => node.bounds.minY))
      ];

      // Uniform cells keep columns lined up regardless of node size.
      const cellWidth =
        Math.max(...input.nodes.map((node) => boundsSize(node.bounds, true))) + gap;
      const cellHeight =
        Math.max(...input.nodes.map((node) => boundsSize(node.bounds, false))) + gap;

      const positions: CanvasLayoutPlacement[] = [];

      input.nodes.forEach((node, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const targetX = origin[0] + column * cellWidth;
        const targetY = origin[1] + row * cellHeight;
        const deltaX = targetX - node.bounds.minX;
        const deltaY = targetY - node.bounds.minY;

        if (deltaX === 0 && deltaY === 0) {
          return;
        }

        positions.push({
          id: node.id,
          position: [node.position[0] + deltaX, node.position[1] + deltaY]
        });
      });

      return { positions };
    }
  };
}

/** Every built-in adapter, for consumers that want the standard set at once. */
export function createBuiltInLayoutAdapters(): readonly CanvasLayoutAdapter[] {
  return [
    createAlignAdapter("left"),
    createAlignAdapter("center-x"),
    createAlignAdapter("right"),
    createAlignAdapter("top"),
    createAlignAdapter("center-y"),
    createAlignAdapter("bottom"),
    createDistributeAdapter("horizontal"),
    createDistributeAdapter("vertical"),
    createGridLayoutAdapter()
  ];
}

function resolveAlignDelta(
  axis: CanvasAlignAxis,
  bounds: CanvasRectBounds,
  extent: CanvasRectBounds
): readonly [number, number] {
  switch (axis) {
    case "left":
      return [extent.minX - bounds.minX, 0];
    case "right":
      return [extent.maxX - bounds.maxX, 0];
    case "center-x":
      return [
        (extent.minX + extent.maxX) / 2 - (bounds.minX + bounds.maxX) / 2,
        0
      ];
    case "top":
      return [0, extent.minY - bounds.minY];
    case "bottom":
      return [0, extent.maxY - bounds.maxY];
    case "center-y":
      return [
        0,
        (extent.minY + extent.maxY) / 2 - (bounds.minY + bounds.maxY) / 2
      ];
  }
}

function unionBounds(
  all: readonly CanvasRectBounds[]
): CanvasRectBounds {
  return all.reduce((accumulated, bounds) => ({
    minX: Math.min(accumulated.minX, bounds.minX),
    minY: Math.min(accumulated.minY, bounds.minY),
    maxX: Math.max(accumulated.maxX, bounds.maxX),
    maxY: Math.max(accumulated.maxY, bounds.maxY)
  }));
}

function boundsSize(bounds: CanvasRectBounds, horizontal: boolean): number {
  return horizontal ? bounds.maxX - bounds.minX : bounds.maxY - bounds.minY;
}

export type { CanvasLayoutAdapter, CanvasLayoutInput, CanvasLayoutResult };
