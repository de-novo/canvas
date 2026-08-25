import type { Canvas2DNode, Canvas2DRenderNodeContext } from "@denovo/canvas";

export const NETWORK_SERVICE_ROLES = [
  "edge",
  "api",
  "auth",
  "data",
  "worker",
  "external"
] as const;

export type NetworkServiceRole = (typeof NETWORK_SERVICE_ROLES)[number];

export type NetworkService = {
  readonly owner: string;
  readonly role: NetworkServiceRole;
  readonly title: string;
};

export function encodeNetworkService(service: NetworkService): string {
  return JSON.stringify(service);
}

export function readNetworkService(node: Canvas2DNode): NetworkService | null {
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
  const role = NETWORK_SERVICE_ROLES.find((item) => item === record.role);
  if (
    typeof record.title !== "string" ||
    typeof record.owner !== "string" ||
    role === undefined
  ) {
    return null;
  }

  return {
    owner: record.owner,
    role,
    title: record.title
  };
}

export function renderNetworkService(
  node: Canvas2DNode,
  _context: Canvas2DRenderNodeContext
): HTMLElement | string {
  const service = readNetworkService(node);
  if (!service) {
    return node.type === "html" ? node.html : "";
  }

  const root = document.createElement("article");
  root.className = "network-card";
  root.dataset.networkCard = node.id;
  root.dataset.networkRole = service.role;

  const role = document.createElement("span");
  role.className = "network-card-role";
  role.textContent = service.role;

  const title = document.createElement("strong");
  title.className = "network-card-title";
  title.textContent = service.title;

  const owner = document.createElement("span");
  owner.className = "network-card-owner";
  owner.textContent = service.owner;

  root.append(role, title, owner);
  return root;
}
