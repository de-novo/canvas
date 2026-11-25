import type { Canvas2DNode, Canvas2DRenderNodeContext } from "@de-novo/canvas/2d";

export const FLOW_CARD_STATUSES = [
  "ready",
  "review",
  "progress",
  "blocked",
  "done"
] as const;

export type FlowCardStatus = (typeof FLOW_CARD_STATUSES)[number];

export type FlowCard = {
  readonly owner: string;
  readonly status: FlowCardStatus;
  readonly title: string;
};

export function encodeFlowCard(card: FlowCard): string {
  return JSON.stringify(card);
}

export function readFlowCard(node: Canvas2DNode): FlowCard | null {
  if (node.type !== "html") {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(node.html);
  } catch {
    return null;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as { readonly [key: string]: unknown };
  const status = FLOW_CARD_STATUSES.find((item) => item === record.status);
  if (
    typeof record.title !== "string" ||
    typeof record.owner !== "string" ||
    status === undefined
  ) {
    return null;
  }

  return {
    owner: record.owner,
    status,
    title: record.title
  };
}

export function renderFlowCard(
  node: Canvas2DNode,
  _context: Canvas2DRenderNodeContext
): HTMLElement | string {
  const card = readFlowCard(node);
  if (!card) {
    return node.type === "html" ? node.html : "";
  }

  const root = document.createElement("article");
  root.className = "flow-card";
  root.dataset.flowCard = node.id;
  root.dataset.flowStatus = card.status;
  const status = document.createElement("span");
  status.className = "flow-card-status";
  status.textContent = card.status;

  const title = document.createElement("strong");
  title.className = "flow-card-title";
  title.textContent = card.title;

  const owner = document.createElement("span");
  owner.className = "flow-card-owner";
  owner.textContent = card.owner;

  root.append(status, title, owner);
  return root;
}
