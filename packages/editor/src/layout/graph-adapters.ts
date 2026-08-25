import type {
  CanvasLayoutAdapter,
  CanvasLayoutEdge,
  CanvasLayoutInput,
  CanvasLayoutNode,
  CanvasLayoutPlacement,
  JsonValue,
  NodeId
} from "@denovo/canvas-core";

export type TimeGraphLayoutOptions = {
  readonly at?: Readonly<Record<string, number>>;
  readonly columnGap?: number;
  readonly laneGap?: number;
  readonly origin?: readonly [number, number];
};

export type RelationGraphLayoutOptions = {
  readonly layerGap?: number;
  readonly laneGap?: number;
  readonly componentGap?: number;
  readonly origin?: readonly [number, number];
};

const DEFAULT_COLUMN_GAP = 96;
const DEFAULT_LANE_GAP = 48;
const DEFAULT_LAYER_GAP = 80;
const DEFAULT_COMPONENT_GAP = 120;

/**
 * Left-to-right time axis. `options.at` is node id → epoch ms (or any
 * comparable number). Nodes without a finite time sit in a single trailing
 * column so "아직" stays to the right of dated work.
 */
export function createTimeGraphLayoutAdapter(
  defaults: TimeGraphLayoutOptions = {}
): CanvasLayoutAdapter {
  return {
    name: "layout.time-graph",
    kind: "layout",
    label: "Time graph",
    apply(input) {
      if (input.nodes.length === 0) {
        return { positions: [] };
      }

      const options = mergeTimeOptions(defaults, readObject(input.options));
      const at = options.at ?? {};
      const columnGap = options.columnGap ?? DEFAULT_COLUMN_GAP;
      const laneGap = options.laneGap ?? DEFAULT_LANE_GAP;
      const origin = options.origin ?? inferOrigin(input.nodes);
      const ordered = sortNodes(input.nodes);
      const timed = ordered.filter((node) => Number.isFinite(at[node.id]));
      const untimed = ordered.filter((node) => !Number.isFinite(at[node.id]));
      const columns = groupByTime(timed, at);
      const positions: CanvasLayoutPlacement[] = [];

      columns.forEach((column, columnIndex) => {
        placeColumn(positions, column, origin[0] + columnIndex * columnGap, origin[1], laneGap);
      });

      if (untimed.length > 0) {
        const x = origin[0] + columns.length * columnGap + (columns.length > 0 ? columnGap * 0.5 : 0);
        placeColumn(positions, untimed, x, origin[1], laneGap);
      }

      return { positions: changedOnly(input.nodes, positions) };
    }
  };
}

/**
 * Relation graph. Connected components stay together; inside a component,
 * BFS layers run left to right from the highest-degree node. Lanes stack
 * down from the origin so titles above the graph stay put. No global
 * center force — components sit in id order along x.
 */
export function createRelationGraphLayoutAdapter(
  defaults: RelationGraphLayoutOptions = {}
): CanvasLayoutAdapter {
  return {
    name: "layout.relation-graph",
    kind: "layout",
    label: "Relation graph",
    apply(input) {
      if (input.nodes.length === 0) {
        return { positions: [] };
      }

      const options = mergeRelationOptions(defaults, readObject(input.options));
      const layerGap = options.layerGap ?? DEFAULT_LAYER_GAP;
      const laneGap = options.laneGap ?? DEFAULT_LANE_GAP;
      const componentGap = options.componentGap ?? DEFAULT_COMPONENT_GAP;
      const origin = options.origin ?? inferOrigin(input.nodes);
      const byId = new Map(input.nodes.map((node) => [node.id, node]));
      const neighbors = adjacency(input.edges, byId);
      const components = connectedComponents(sortNodes(input.nodes), neighbors);
      const positions: CanvasLayoutPlacement[] = [];
      let cursorX = origin[0];

      for (const component of components) {
        const layers = bfsLayers(component, neighbors);
        layers.forEach((layer, layerIndex) => {
          const x = cursorX + layerIndex * layerGap;
          layer.forEach((node, index) => {
            positions.push({
              id: node.id,
              position: [x, origin[1] + index * laneGap]
            });
          });
        });
        cursorX += Math.max(1, layers.length) * layerGap + componentGap;
      }

      return { positions: changedOnly(input.nodes, positions) };
    }
  };
}

/** World radius that paints as a clamped screen size at the given zoom. */
export function canvasScreenPointRadius(
  worldRadius: number,
  zoom: number,
  range: { readonly min: number; readonly max: number } = { min: 4, max: 14 }
): number {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const safeMin = Number.isFinite(range.min) ? Math.max(0, range.min) : 4;
  const safeMax = Number.isFinite(range.max) ? Math.max(safeMin, range.max) : 14;
  const screen = (Number.isFinite(worldRadius) && worldRadius > 0 ? worldRadius : safeMin) * safeZoom;
  return Math.min(safeMax, Math.max(safeMin, screen)) / safeZoom;
}

function placeColumn(
  positions: CanvasLayoutPlacement[],
  nodes: readonly CanvasLayoutNode[],
  x: number,
  originY: number,
  laneGap: number
): void {
  nodes.forEach((node, index) => {
    positions.push({ id: node.id, position: [x, originY + index * laneGap] });
  });
}

function groupByTime(
  nodes: readonly CanvasLayoutNode[],
  at: Readonly<Record<string, number>>
): CanvasLayoutNode[][] {
  const times = [...new Set(nodes.map((node) => at[node.id]!))].sort((left, right) => left - right);
  return times.map((time) => nodes.filter((node) => at[node.id] === time));
}

function adjacency(
  edges: readonly CanvasLayoutEdge[],
  known: ReadonlyMap<NodeId, CanvasLayoutNode>
): Map<NodeId, NodeId[]> {
  const neighbors = new Map<NodeId, Set<NodeId>>();

  for (const node of known.values()) {
    neighbors.set(node.id, new Set());
  }

  for (const edge of edges) {
    if (!known.has(edge.sourceId) || !known.has(edge.targetId)) {
      continue;
    }
    if (edge.sourceId === edge.targetId) {
      continue;
    }
    neighbors.get(edge.sourceId)?.add(edge.targetId);
    neighbors.get(edge.targetId)?.add(edge.sourceId);
  }

  return new Map(
    [...neighbors.entries()].map(([id, set]) => [
      id,
      [...set].sort((left, right) => left.localeCompare(right))
    ])
  );
}

function connectedComponents(
  nodes: readonly CanvasLayoutNode[],
  neighbors: ReadonlyMap<NodeId, readonly NodeId[]>
): CanvasLayoutNode[][] {
  const remaining = new Map(nodes.map((node) => [node.id, node]));
  const components: CanvasLayoutNode[][] = [];

  for (const start of nodes) {
    if (!remaining.has(start.id)) {
      continue;
    }

    const stack = [start.id];
    const component: CanvasLayoutNode[] = [];

    while (stack.length > 0) {
      const id = stack.pop()!;
      const node = remaining.get(id);
      if (!node) {
        continue;
      }
      remaining.delete(id);
      component.push(node);
      for (const next of neighbors.get(id) ?? []) {
        if (remaining.has(next)) {
          stack.push(next);
        }
      }
    }

    component.sort((left, right) => left.id.localeCompare(right.id));
    components.push(component);
  }

  return components;
}

function bfsLayers(
  component: readonly CanvasLayoutNode[],
  neighbors: ReadonlyMap<NodeId, readonly NodeId[]>
): CanvasLayoutNode[][] {
  const byId = new Map(component.map((node) => [node.id, node]));
  const root = pickRoot(component, neighbors);
  const seen = new Set<NodeId>([root.id]);
  const layers: CanvasLayoutNode[][] = [[root]];

  while (true) {
    const frontier: CanvasLayoutNode[] = [];
    for (const node of layers[layers.length - 1]!) {
      for (const nextId of neighbors.get(node.id) ?? []) {
        if (seen.has(nextId) || !byId.has(nextId)) {
          continue;
        }
        seen.add(nextId);
        frontier.push(byId.get(nextId)!);
      }
    }
    if (frontier.length === 0) {
      break;
    }
    frontier.sort((left, right) => left.id.localeCompare(right.id));
    layers.push(frontier);
  }

  return layers;
}

function pickRoot(
  component: readonly CanvasLayoutNode[],
  neighbors: ReadonlyMap<NodeId, readonly NodeId[]>
): CanvasLayoutNode {
  return [...component].sort((left, right) => {
    const degree = (neighbors.get(right.id)?.length ?? 0) - (neighbors.get(left.id)?.length ?? 0);
    return degree !== 0 ? degree : left.id.localeCompare(right.id);
  })[0]!;
}

function sortNodes(nodes: readonly CanvasLayoutNode[]): CanvasLayoutNode[] {
  return [...nodes].sort((left, right) => left.id.localeCompare(right.id));
}

function inferOrigin(nodes: readonly CanvasLayoutNode[]): readonly [number, number] {
  return [
    Math.min(...nodes.map((node) => node.position[0])),
    Math.min(...nodes.map((node) => node.position[1]))
  ];
}

function changedOnly(
  nodes: readonly CanvasLayoutNode[],
  positions: readonly CanvasLayoutPlacement[]
): CanvasLayoutPlacement[] {
  const current = new Map(nodes.map((node) => [node.id, node.position]));
  return positions.filter((placement) => {
    const previous = current.get(placement.id);
    return (
      previous === undefined ||
      previous[0] !== placement.position[0] ||
      previous[1] !== placement.position[1]
    );
  });
}

function mergeTimeOptions(
  defaults: TimeGraphLayoutOptions,
  raw: { readonly [key: string]: JsonValue } | undefined
): TimeGraphLayoutOptions {
  const at = { ...defaults.at, ...readNumberRecord(raw?.at) };
  const columnGap = readFiniteNumber(raw?.columnGap) ?? defaults.columnGap;
  const laneGap = readFiniteNumber(raw?.laneGap) ?? defaults.laneGap;
  const origin = readPoint(raw?.origin) ?? defaults.origin;

  return {
    ...(Object.keys(at).length > 0 ? { at } : {}),
    ...(columnGap === undefined ? {} : { columnGap }),
    ...(laneGap === undefined ? {} : { laneGap }),
    ...(origin === undefined ? {} : { origin })
  };
}

function mergeRelationOptions(
  defaults: RelationGraphLayoutOptions,
  raw: { readonly [key: string]: JsonValue } | undefined
): RelationGraphLayoutOptions {
  const layerGap = readFiniteNumber(raw?.layerGap) ?? defaults.layerGap;
  const laneGap = readFiniteNumber(raw?.laneGap) ?? defaults.laneGap;
  const componentGap = readFiniteNumber(raw?.componentGap) ?? defaults.componentGap;
  const origin = readPoint(raw?.origin) ?? defaults.origin;

  return {
    ...(layerGap === undefined ? {} : { layerGap }),
    ...(laneGap === undefined ? {} : { laneGap }),
    ...(componentGap === undefined ? {} : { componentGap }),
    ...(origin === undefined ? {} : { origin })
  };
}

function readObject(
  value: JsonValue | undefined
): { readonly [key: string]: JsonValue } | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value;
}

function readFiniteNumber(value: JsonValue | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readPoint(value: JsonValue | undefined): readonly [number, number] | undefined {
  if (!Array.isArray(value) || value.length < 2) {
    return undefined;
  }
  const x = value[0];
  const y = value[1];
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
    return undefined;
  }
  return [x, y];
}

function readNumberRecord(value: JsonValue | undefined): Readonly<Record<string, number>> {
  const record = readObject(value);
  if (!record) {
    return {};
  }

  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      out[key] = entry;
    }
  }
  return out;
}
