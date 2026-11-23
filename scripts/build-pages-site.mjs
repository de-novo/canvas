// @ts-check
/**
 * Builds the static GitHub Pages open-source demo & benchmark hub into
 * `dist-pages/` using relative `--base ./` paths so it works both at a root
 * custom domain and at `https://<org>.github.io/<repo>/`.
 */

import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = path.join(root, "dist-pages");

rmSync(outRoot, { force: true, recursive: true });
mkdirSync(outRoot, { recursive: true });

function buildViteApp(filterName, subDir, extraArgs = []) {
  const appOut = path.join(outRoot, subDir);
  console.log(`[build:pages] building ${filterName} -> dist-pages/${subDir}`);
  execFileSync(
    "pnpm",
    [
      "--filter",
      filterName,
      "exec",
      "vite",
      "build",
      "--base",
      "./",
      "--outDir",
      appOut,
      "--emptyOutDir",
      ...extraArgs
    ],
    { cwd: root, stdio: "inherit" }
  );
}

// 1. Release Board (2D cards + connectors + save/reset, @denovo/canvas/2d)
buildViteApp("@denovo/canvas-flow-example", "flow");

// 2. Interactive 10k 2D Live Benchmark & Smart Snap (@denovo/canvas/2d, Three.js 0B)
const benchConfigPath = path.join(outRoot, ".bench-vite.config.mjs");
writeFileSync(
  benchConfigPath,
  `import { resolve } from "node:path";
export default {
  root: ${JSON.stringify(path.join(root, "apps/playground-flow"))},
  base: "./",
  build: {
    outDir: ${JSON.stringify(path.join(outRoot, "bench-2d"))},
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(${JSON.stringify(path.join(root, "apps/playground-flow"))}, "bench-2d.html")
    }
  }
};
`
);
console.log("[build:pages] building 10k 2D live benchmark -> dist-pages/bench-2d");
execFileSync(
  "pnpm",
  ["--filter", "@denovo/canvas-flow-example", "exec", "vite", "build", "--config", benchConfigPath],
  { cwd: root, stdio: "inherit" }
);
rmSync(benchConfigPath, { force: true });
renameSync(
  path.join(outRoot, "bench-2d", "bench-2d.html"),
  path.join(outRoot, "bench-2d", "index.html")
);

// 3. Service Map (2D graph layouts, @denovo/canvas/2d)
buildViteApp("@denovo/canvas-network-example", "network");

// 4. 3D Warp Field showcase
buildViteApp("@denovo/canvas-field-example", "field");

// 5. Root multilingual open-source landing hub (EN / KO / ZH-CN)
writeFileSync(path.join(outRoot, ".nojekyll"), "");
writeFileSync(
  path.join(outRoot, "index.html"),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Denovo Canvas — Open-Source 2D/3D Canvas Optimization SDK</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100dvh;
        background: radial-gradient(circle at top, #172554 0%, #0b1220 55%);
        color: #e2e8f0;
      }
      .wrap {
        max-width: 1040px;
        margin: 0 auto;
        padding: 32px 20px 64px;
      }
      nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 36px;
      }
      .brand { font-weight: 700; font-size: 16px; letter-spacing: -0.02em; }
      .langs { display: flex; gap: 6px; }
      .langs button {
        background: rgba(15, 23, 42, 0.7);
        color: #cbd5e1;
        border: 1px solid #334155;
        border-radius: 999px;
        padding: 4px 12px;
        font-size: 12px;
        cursor: pointer;
      }
      .langs button.active {
        background: #0284c7;
        border-color: #38bdf8;
        color: #ffffff;
      }
      h1 {
        font-size: clamp(28px, 5vw, 44px);
        line-height: 1.12;
        margin: 0 0 14px;
        letter-spacing: -0.03em;
      }
      .lead {
        max-width: 740px;
        color: #94a3b8;
        font-size: 16px;
        line-height: 1.65;
        margin: 0 0 28px;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        gap: 12px;
        margin-bottom: 32px;
      }
      .metric {
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid #1e293b;
        border-radius: 10px;
        padding: 14px;
      }
      .metric .val {
        font-size: 22px;
        font-weight: 700;
        color: #38bdf8;
      }
      .metric .lbl {
        font-size: 12px;
        color: #94a3b8;
        margin-top: 4px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        gap: 16px;
      }
      .card {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 12px;
        background: rgba(15, 23, 42, 0.88);
        border: 1px solid #1e293b;
        border-radius: 12px;
        padding: 20px;
        text-decoration: none;
        color: inherit;
        transition: border-color 120ms ease, transform 120ms ease;
      }
      .card:hover {
        border-color: #38bdf8;
        transform: translateY(-2px);
      }
      .card h2 { margin: 0 0 6px; font-size: 17px; }
      .card p { margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.55; }
      .tag {
        display: inline-block;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 999px;
        background: #0f172a;
        border: 1px solid #334155;
        color: #7dd3fc;
        margin-bottom: 8px;
      }
      .cta { font-size: 13px; font-weight: 600; color: #38bdf8; }
      footer {
        margin-top: 40px;
        font-size: 13px;
        color: #64748b;
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
      }
      footer a { color: #94a3b8; text-decoration: none; }
      footer a:hover { color: #f8fafc; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <nav>
        <div class="brand">Denovo Canvas</div>
        <div class="langs" role="group" aria-label="Language">
          <button type="button" data-lang="en" class="active">English</button>
          <button type="button" data-lang="ko">한국어</button>
          <button type="button" data-lang="zh">简体中文</button>
        </div>
      </nav>
      <h1 id="hero-title"></h1>
      <p class="lead" id="hero-lead"></p>
      <section class="metrics">
        <div class="metric"><div class="val">10,001 → 28</div><div class="lbl" id="m1"></div></div>
        <div class="metric"><div class="val">-81% JS</div><div class="lbl" id="m2"></div></div>
        <div class="metric"><div class="val">0 rerenders</div><div class="lbl" id="m3"></div></div>
        <div class="metric"><div class="val">0.40 ms</div><div class="lbl" id="m4"></div></div>
      </section>
      <section class="grid">
        <a class="card" href="./bench-2d/">
          <div>
            <span class="tag">@denovo/canvas/2d · Three.js 0B</span>
            <h2 id="c1-t"></h2>
            <p id="c1-p"></p>
          </div>
          <span class="cta" id="c1-cta"></span>
        </a>
        <a class="card" href="./flow/">
          <div>
            <span class="tag">@denovo/canvas/2d · 361 kB</span>
            <h2 id="c2-t"></h2>
            <p id="c2-p"></p>
          </div>
          <span class="cta" id="c2-cta"></span>
        </a>
        <a class="card" href="./network/">
          <div>
            <span class="tag">@denovo/canvas/2d · 352 kB</span>
            <h2 id="c3-t"></h2>
            <p id="c3-p"></p>
          </div>
          <span class="cta" id="c3-cta"></span>
        </a>
        <a class="card" href="./field/">
          <div>
            <span class="tag">@denovo/canvas · 3D WebGPU/WebGL2</span>
            <h2 id="c4-t"></h2>
            <p id="c4-p"></p>
          </div>
          <span class="cta" id="c4-cta"></span>
        </a>
      </section>
      <footer>
        <a href="https://github.com/de-novo/canvas">GitHub</a>
        <a href="https://github.com/de-novo/canvas/blob/main/README.md">README (EN)</a>
        <a href="https://github.com/de-novo/canvas/blob/main/README.ko.md">README (한국어)</a>
        <a href="https://github.com/de-novo/canvas/blob/main/README.zh-CN.md">README (简体中文)</a>
        <span>Apache-2.0 License</span>
      </footer>
    </div>
    <script>
      const copy = {
        en: {
          title: "Framework-agnostic 2D & 3D canvas optimization SDK",
          lead: "TanStack-style headless core and thin React, Vue, Svelte, and Solid adapters: viewport culling, O(k) incremental spatial indexing, O(visible) smart snap guides, HTML overlay virtualization, rAF coalescing, and Three.js-free 2D bundles.",
          m1: "2D Canvas2D drawCalls on 10k nodes",
          m2: "2D bundle reduction via @denovo/canvas/2d",
          m3: "Unrelated UI re-renders across 100 hover events",
          m4: "O(visible) smart snap across 10,001 nodes",
          c1t: "10k 2D Live Benchmark & Snap",
          c1p: "Test 10,000 nodes with live drawCall telemetry, O(k) incremental moves, O(visible) smart snap guides, and alignNodes/distributeNodes.",
          c2t: "Release Board (2D Flow)",
          c2p: "Editable HTML cards, orthogonal connectors, touch drag, undo/redo, and save/reset running on Three.js-free @denovo/canvas/2d.",
          c3t: "Service Map (2D Graph)",
          c3p: "Multi-layout 2D topology viewer and editor with viewport culling and zoom-scaled HTML cards.",
          c4t: "3D Warp Field",
          c4p: "Official plugin.denovo.field 3D showcase with WebGPU/WebGL2 auto backend resolution.",
          cta: "Open demo →"
        },
        ko: {
          title: "프레임워크 독립형 2D · 3D 캔버스 최적화 SDK",
          lead: "TanStack 스타일의 헤드리스 코어와 React, Vue, Svelte, Solid 얇은 어댑터: 뷰포트 컬링, O(k) 증분 공간 인덱스, O(visible) 스마트 스냅 가이드, HTML 오버레이 가상화, rAF 병합, Three.js 0B 2D 번들.",
          m1: "10k 2D 노드 기준 Canvas2D 드로우콜",
          m2: "@denovo/canvas/2d 경량 엔트리 번들 절감",
          m3: "100회 호버 이벤트 동안 무관 UI 리렌더",
          m4: "10,001개 노드 중 O(visible) 스마트 스냅",
          c1t: "10k 2D 라이브 벤치마크 & 스냅",
          c1p: "10,000개 노드 실시간 드로우콜, O(k) 증분 이동, O(visible) 스마트 스냅 가이드, alignNodes/distributeNodes를 바로 체험하세요.",
          c2t: "Release Board (2D 플로우)",
          c2p: "Three.js 없는 @denovo/canvas/2d 기반 HTML 카드, 직교 커넥터, 터치 드래그, Undo/Redo, 저장/초기화 데모.",
          c3t: "Service Map (2D 그래프)",
          c3p: "뷰포트 컬링과 줌 스케일 HTML 카드를 갖춘 멀티 레이아웃 2D 토폴로지 뷰어.",
          c4t: "3D Warp Field",
          c4p: "WebGPU/WebGL2 자동 백엔드 선택을 사용하는 공식 plugin.denovo.field 3D 쇼케이스.",
          cta: "데모 열기 →"
        },
        zh: {
          title: "框架无关的 2D 与 3D 画布性能优化 SDK",
          lead: "TanStack 风格的无头核心与 React、Vue、Svelte、Solid 薄适配层：视口裁剪、O(k) 增量空间索引、O(visible) 智能吸附辅助线、HTML 覆盖层虚拟化、rAF 帧合并与零 Three.js 2D 打包。",
          m1: "10k 节点下的 2D Canvas2D 绘制调用",
          m2: "使用 @denovo/canvas/2d 缩减 2D 包体积",
          m3: "100 次悬停事件下无关 UI 重渲染次数",
          m4: "10,001 个节点中 O(visible) 智能吸附耗时",
          c1t: "10k 2D 实时基准测试与智能吸附",
          c1p: "实时体验 10,000 节点裁剪绘制调用、O(k) 增量移动、O(visible) 智能吸附辅助线与 alignNodes/distributeNodes。",
          c2t: "Release Board（2D 流程看板）",
          c2p: "基于零 Three.js 的 @denovo/canvas/2d：可编辑 HTML 卡片、正交连线、触控拖拽、撤销重做与保存重置。",
          c3t: "Service Map（2D 服务拓扑）",
          c3p: "支持多布局切换、视口裁剪与缩放 HTML 卡片的 2D 拓扑视图。",
          c4t: "3D Warp Field",
          c4p: "支持 WebGPU/WebGL2 自动后端选择的官方 plugin.denovo.field 3D 示例。",
          cta: "打开示例 →"
        }
      };
      function applyLang(lang) {
        const d = copy[lang] || copy.en;
        document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
        document.getElementById("hero-title").textContent = d.title;
        document.getElementById("hero-lead").textContent = d.lead;
        document.getElementById("m1").textContent = d.m1;
        document.getElementById("m2").textContent = d.m2;
        document.getElementById("m3").textContent = d.m3;
        document.getElementById("m4").textContent = d.m4;
        document.getElementById("c1-t").textContent = d.c1t;
        document.getElementById("c1-p").textContent = d.c1p;
        document.getElementById("c2-t").textContent = d.c2t;
        document.getElementById("c2-p").textContent = d.c2p;
        document.getElementById("c3-t").textContent = d.c3t;
        document.getElementById("c3-p").textContent = d.c3p;
        document.getElementById("c4-t").textContent = d.c4t;
        document.getElementById("c4-p").textContent = d.c4p;
        for (const id of ["c1-cta", "c2-cta", "c3-cta", "c4-cta"]) {
          document.getElementById(id).textContent = d.cta;
        }
        document.querySelectorAll(".langs button").forEach((btn) => {
          btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
        });
      }
      document.querySelectorAll(".langs button").forEach((btn) => {
        btn.addEventListener("click", () => applyLang(btn.getAttribute("data-lang")));
      });
      applyLang("en");
    </script>
  </body>
</html>
`
);

console.log("[build:pages] built dist-pages/ successfully");
