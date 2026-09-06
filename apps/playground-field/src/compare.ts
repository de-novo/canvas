import fieldDrawerSource from "../../../packages/three/src/kinds/field.ts?raw";
import threeuiHostSource from "../../playground-threeui/src/vendor/threeui/warp-field/WarpFieldBackground.tsx?raw";
import threeuiEngineSource from "../../playground-threeui/src/vendor/threeui/warp-field/warpFieldRenderer.ts?raw";

import applyPatternSource from "./apply-pattern.ts?raw";
import documentSource from "./document.ts?raw";

export type CompareFileRole = "document" | "engine" | "host" | "live";

export type CompareFile = {
  body: string;
  lineCount: number;
  path: string;
  role: CompareFileRole;
};

type ComparePaneSpec = {
  files: readonly CompareFile[];
  live?: boolean;
  note: string;
  title: string;
};

function file(
  path: string,
  body: string,
  role: CompareFileRole
): CompareFile {
  return {
    body,
    lineCount: body.split("\n").length,
    path,
    role
  };
}

function lineCount(files: readonly CompareFile[]): number {
  return files.reduce((sum, item) => sum + item.lineCount, 0);
}

export const THREEUI_FILES: readonly CompareFile[] = [
  file(
    "apps/playground-threeui/src/vendor/threeui/warp-field/WarpFieldBackground.tsx",
    threeuiHostSource,
    "host"
  ),
  file(
    "apps/playground-threeui/src/vendor/threeui/warp-field/warpFieldRenderer.ts",
    threeuiEngineSource,
    "engine"
  )
];

export const DENOVO_FILES: readonly CompareFile[] = [
  file("apps/playground-field/src/document.ts", documentSource, "document"),
  file(
    "apps/playground-field/src/apply-pattern.ts",
    applyPatternSource,
    "host"
  ),
  file("packages/three/src/kinds/field.ts", fieldDrawerSource, "engine")
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  return node;
}

function renderFiles(
  parent: HTMLElement,
  files: readonly CompareFile[]
): void {
  for (const item of files) {
    const section = el("section", "compare-file");
    const heading = el("h4");
    const path = el("code");
    path.textContent = item.path;
    const meta = el("span");
    meta.textContent = `${item.role} · ${item.lineCount} lines`;
    heading.append(path, meta);
    const pre = el("pre");
    pre.textContent = item.body;
    section.append(heading, pre);
    parent.append(section);
  }
}

function renderPane(root: HTMLElement, spec: ComparePaneSpec): HTMLElement | null {
  root.replaceChildren();

  const header = el("header");
  const title = el("h3");
  title.textContent = spec.title;
  const summary = el("p");
  summary.textContent = `${spec.files.length} files · ${lineCount(spec.files)} lines · ${spec.note}`;
  header.append(title, summary);

  const files = el("div", "compare-files");
  let liveBody: HTMLElement | null = null;

  if (spec.live) {
    const section = el("section", "compare-file");
    const heading = el("h4");
    const path = el("code");
    path.textContent = "live node · id / type / props";
    const meta = el("span");
    meta.dataset.fieldCompareLiveCount = "";
    meta.textContent = "live · 0 lines";
    heading.append(path, meta);
    const pre = el("pre");
    pre.dataset.fieldCompareLive = "";
    pre.textContent = "";
    section.append(heading, pre);
    files.append(section);
    liveBody = pre;
  }

  renderFiles(files, spec.files);
  root.append(header, files);
  return liveBody;
}

export function mountCompareBoard(root: HTMLElement): {
  updateLiveNode: (body: string) => void;
} {
  const hostPane = root.querySelector("[data-field-compare-host]");
  const denovoPane = root.querySelector("[data-field-compare-denovo]");
  if (!(hostPane instanceof HTMLElement) || !(denovoPane instanceof HTMLElement)) {
    throw new Error("Compare panes were not found.");
  }

  renderPane(hostPane, {
    files: THREEUI_FILES,
    note: "text only · not executed",
    title: "ThreeUI"
  });
  const live = renderPane(denovoPane, {
    files: DENOVO_FILES,
    live: true,
    note: "this catalog · drawer is ours",
    title: "Denovo"
  });

  return {
    updateLiveNode(body: string) {
      if (!live) {
        return;
      }
      live.textContent = body;
      const count = denovoPane.querySelector("[data-field-compare-live-count]");
      if (count) {
        count.textContent = `live · ${body.split("\n").length} lines`;
      }
    }
  };
}
