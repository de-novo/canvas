# Denovo Canvas

[English](./README.md) | **한국어** | [简体中文](./README.zh-CN.md)

Denovo Canvas는 빠르고 편집 가능한 2D 및 3D 캔버스 애플리케이션을 만들기 위한
프레임워크 독립형 TypeScript SDK입니다. DOM 인터페이스에서 TanStack Table과
TanStack Virtual이 담당하는 역할처럼, Denovo Canvas는 가벼운 헤드리스 코어와
얇은 프레임워크 어댑터 뒤에서 캔버스 앱 최적화의 핵심 문제를 대신 해결합니다:
뷰포트 컬링, 공간 인덱스 및 증분 갱신, HTML 오버레이 가상화, GPU 드로우콜 배칭,
rAF 프레임 병합(코얼레싱), 세분화 셀렉터 구독, 커맨드/트랜잭션 기반
Undo·Redo, 렌더러 독립 JSON 영속성.

UI 컨트롤, 디자인 시스템, 저장소 위치는 애플리케이션이 자유롭게 선택합니다.
Vanilla JavaScript, React / Next.js, Vue, Svelte, Solid 어디서나 동일한
에디터와 문서 모델을 그대로 사용할 수 있습니다.

> 처음 시작하시나요? [시작하기 및 최적화 가이드](./docs/getting-started.ko.md)
> ([English](./docs/getting-started.md) | [简体中文](./docs/getting-started.zh-CN.md))와
> [문서 인덱스](./docs/README.md)를 확인해 보세요.
> *(규범적 상세 명세는 영문 `docs/` 문서를 정본으로 삼습니다.)*

## 현재 만들 수 있는 것

- **대규모 2D 무한 캔버스, 다이어그램, 보드, 어노테이션 에디터**
  - 내장 2D 노드: `rect`, `circle`, `edge`(직선·곡선·직교 포트 라우팅 및 화살표),
    `text`, `html`(호스트 렌더링 DOM 카드, 줌 스케일 및 화면 밖 컬링 지원),
    `group`, `measurement`, `annotation`, 사용자 정의 `plugin.<org>.<kind>` 드로어.
  - 균일 격자 공간 인덱스(`Canvas2DSpatialIndex`)와 O(k) 증분 편집 갱신,
    렌더링·히트테스트·마키 선택(`getNodesInBounds`) 뷰포트 컬링,
    O(visible) 스마트 스냅 가이드(`computeSnapGuides` / `computeCanvas2DSnapGuides`),
    O(visible) HTML 오버레이 DOM 가상화 및 diff 기반 `renderNode` 갱신,
    O(1) 캐시 미니맵, rAF 입력 버스트 병합, GPU 상주 버텍스·아틀라스 캐시를
    갖춘 선택적 2D WebGPU 렌더러.
  - 퍼사드와 4대 프레임워크 어댑터 모두 Three.js가 전혀 포함되지 않는 경량 2D
    엔트리포인트 제공(`@denovo/canvas/2d`, `@denovo/canvas/react/2d`,
    `@denovo/react-canvas/2d`, `@denovo/vue-canvas/2d`,
    `@denovo/svelte-canvas/2d`, `@denovo/solid-canvas/2d`).
- **고성능 3D 뷰어, 에디터, BIM 워크플로**
  - 내장 3D 노드: `box`, `sphere`, `mesh`(인라인 또는 외부 지오메트리 에셋),
    `instances`, `group`, `measurement`, `annotation`, 공식 `plugin.denovo.field`.
  - 자동 `auto` 백엔드 선택(가능 시 WebGPU 우선, 미지원 시 WebGL2),
    `render.batch: true` 기반 박스·구 인스턴싱 배칭과 BVH 레이캐스트 피킹,
    거리 기반 구 LOD, 단면 평면(section plane), 박스·메시 표면 배치 및 거리 측정,
    Web Worker 지오메트리 변환(`@denovo/canvas/worker`), 청크 스트리밍
    (`createSceneChunkLoader`), 멀티 모델 IFC 연합(`@denovo/canvas-bim`).
- **불필요한 리렌더 없는 세분화 프레임워크 상태 구독**
  - 헤드리스 `subscribeCanvasSelector` + `shallowEqual`,
    React(`useCanvasSelector`, `useSyncExternalStore`),
    Vue(`useCanvasSelector`, `ComputedRef`),
    Svelte(`createCanvasSelectorStore`, `$store`),
    Solid(`useCanvasSelector`, `Accessor`).
- **표준 편집 모델, Named Operations, 영속성**
  - 정본 `0.2.0` JSON 문서(`0.1.0` 결정적 마이그레이션 포함), 검증된 커맨드,
    원자적 트랜잭션, 제한된 Undo/Redo 이력, 내장 툴(`Select`, `Pan/Orbit`,
    `Transform`, `Connector`, `2D Shape`, `3D Primitive`, `3D Surface Placement`,
    `Distance Measurement`, `Annotation`), 호스트 UI와 AI 에이전트가 공유하는
    22개 Named Operations(`alignNodes`, `distributeNodes`, `setLayerVisible`,
    `setNodeVisible`, `removeEdge`, `removeNode`, `stackBox`, `listNodes` 등),
    메모리·파일시스템·IndexedDB 어댑터.

## 빠른 시작

### 1. 경량 2D 에디터 (`@denovo/canvas/2d` — Three.js 0B)

```html
<div id="stage" style="height: 320px"></div>
<button id="hide">사각형 숨기기</button>
<button id="undo">실행 취소</button>
```

```ts
import {
  connectEditorToCanvas,
  createCanvas,
  createEditor,
  defineDocument,
  setNodeVisible
} from "@denovo/canvas/2d";
import "@denovo/canvas/styles.css";

const documentModel = defineDocument({
  id: "drawing",
  scene: {
    id: "page",
    mode: "2d",
    layers: [{ id: "shapes", name: "Shapes" }],
    nodes: [
      {
        id: "rect",
        type: "rect",
        layerId: "shapes",
        position: [40, 40],
        size: [120, 80],
        fill: "#22c55e"
      }
    ]
  }
});

const editor = createEditor({ document: documentModel });
const canvas = createCanvas("#stage", { document: documentModel, editable: true });
await canvas.ready;
const disconnect = connectEditorToCanvas(editor, canvas);

document.querySelector("#hide")!.addEventListener("click", () =>
  editor.apply([setNodeVisible({ nodeId: "rect", visible: false })])
);
document.querySelector("#undo")!.addEventListener("click", () => editor.undo());

// 언마운트 시: disconnect(); canvas.destroy();
```

### 2. React / Next.js 2D 뷰 + 세분화 셀렉터

`@denovo/canvas/react/2d` (또는 `@denovo/react-canvas/2d`)를 사용하면 2D React
앱 번들에 Three.js, React Three Fiber, Drei가 전혀 포함되지 않으며, 툴바
컴포넌트가 포인터 호버 폭주에도 리렌더되지 않습니다.

```tsx
"use client";

import {
  connectEditorToCanvas,
  createEditor,
  defineDocument,
  shallowEqual
} from "@denovo/canvas/2d";
import { Canvas2DView, useCanvasSelector } from "@denovo/canvas/react/2d";
import "@denovo/canvas/styles.css";
import { useMemo } from "react";

export function Board() {
  const editor = useMemo(
    () =>
      createEditor({
        document: defineDocument({
          id: "board",
          scene: {
            id: "scene",
            mode: "2d",
            layers: [{ id: "default", name: "Default" }],
            nodes: [
              {
                id: "card-1",
                type: "rect",
                layerId: "default",
                position: [40, 40],
                size: [160, 88],
                fill: "#38bdf8"
              }
            ]
          }
        })
      }),
    []
  );

  const documentModel = useCanvasSelector(editor, (s) => s.document);
  const { canUndo, canRedo } = useCanvasSelector(
    editor,
    (s) => ({ canRedo: s.history.canRedo, canUndo: s.history.canUndo }),
    shallowEqual
  );

  return (
    <div>
      <Canvas2DView
        scene={documentModel.scene}
        onRuntime={(runtime) => {
          if (runtime) {
            void runtime.ready.then(() => connectEditorToCanvas(editor, runtime));
          }
        }}
      />
      <button disabled={!canUndo} onClick={() => void editor.undo()}>
        Undo
      </button>
      <button disabled={!canRedo} onClick={() => void editor.redo()}>
        Redo
      </button>
    </div>
  );
}
```

### 3. Vue, Svelte, Solid, Vanilla 세분화 셀렉터

```ts
// Vanilla / 프레임워크 무관
import { shallowEqual, subscribeCanvasSelector } from "@denovo/canvas/2d";
const stop = subscribeCanvasSelector(
  editor,
  (s) => ({ canUndo: s.history.canUndo, canRedo: s.history.canRedo }),
  (next) => console.log(next),
  { equals: shallowEqual }
);

// Vue 3 (@denovo/vue-canvas 또는 Three.js 미포함 @denovo/vue-canvas/2d)
import { useCanvasSelector } from "@denovo/vue-canvas/2d";
const undoDepth = useCanvasSelector(editor, (s) => s.history.undoDepth);

// Svelte (@denovo/svelte-canvas 또는 Three.js 미포함 @denovo/svelte-canvas/2d)
import { createCanvasSelectorStore } from "@denovo/svelte-canvas/2d";
const selectedId = createCanvasSelectorStore(editor, (s) => s.selection.primaryId);

// Solid (@denovo/solid-canvas 또는 Three.js 미포함 @denovo/solid-canvas/2d)
import { useCanvasSelector } from "@denovo/solid-canvas/2d";
const undoDepthSignal = useCanvasSelector(editor, (s) => s.history.undoDepth);
```

### 4. 동적 2D + 3D 씬 (`@denovo/canvas`)

```ts
import { createCanvas } from "@denovo/canvas";
import "@denovo/canvas/styles.css";

const canvas = createCanvas("#stage", {
  scene: {
    id: "scene-3d",
    mode: "3d",
    layers: [{ id: "default", name: "Default" }],
    render: { batch: true },
    nodes: [
      { id: "box-1", type: "box", layerId: "default", position: [0, 0, 0], color: "#22c55e" },
      { id: "box-2", type: "box", layerId: "default", position: [2, 0, 0], color: "#22c55e" }
    ]
  }
});
```

### 동작 예제 및 라이브 데모 허브

- [10k 2D 라이브 벤치마크 & 스마트 스냅 (`@denovo/canvas/2d`, Three.js 0B)](./apps/playground-flow/src/bench-2d.ts)
- [Release Board (2D 카드·커넥터·저장/초기화, `@denovo/canvas/2d`)](./apps/playground-flow/src/main.ts)
- [Service Map (2D 그래프 레이아웃, `@denovo/canvas/2d`)](./apps/playground-network/src/main.ts)
- [Next.js 마스크 에디터 (React `Canvas2DView` + `useCanvasSelector` + shadcn/Tailwind v4)](./apps/playground/app/mask-host.tsx)
- [Vanilla 2D/3D 저작 워크벤치](./apps/vanilla/src/main.ts)
- [3D Warp Field 쇼케이스](./apps/playground-field/src/main.ts)

정적 GitHub Pages 데모 허브는 `pnpm build:pages`와 `pnpm verify:pages`로 로컬에서 바로 빌드·검증할 수 있습니다.

## 실측 성능 및 번들 절감

저장소 결정적 검증 스크립트(`pnpm verify:2d-performance`, `pnpm verify:performance`,
`pnpm verify:selectors`, `pnpm verify:public-api`)로 실측된 결과입니다.

| 대상 / 워크로드 | 적용된 최적화 | 실측 결과 |
| --- | --- | --- |
| 2D `10k-2d-rects` (Canvas2D + 미니맵) | 공간 인덱스 + 뷰포트 컬링 + O(1) 미니맵 캐시 | `drawCalls` 10,001 → **28**, 팬 p50 3.70 ms → **0.00 ms**, 200회 히트테스트 118.5 ms → **0.5 ms** |
| 2D `10k-2d-rects` 단일 노드 이동 / 스마트 스냅 | O(k) 증분 공간 인덱스 + O(visible) 스냅 | 단일 이동 재색인 **1개** (`kind=incremental`), 스냅 탐색 **28 / 10,001개** (**0.50 ms**) |
| 2D `10k-2d-webgpu` (명시적 2D WebGPU) | GPU 상주 버텍스·아틀라스·바인드그룹 캐시 + 공간 컬링 | 팬 p50 6.90 ms → **0.00 ms**, p95 14.40 ms → **0.10–0.20 ms**, 삼각형 20,002 → **210** |
| 2D `1k-2d-overlays` (HTML 카드) | O(visible) DOM 가상화 + diff 기반 `rebuildObjects` | 팬 p50 0.80 ms → **0.10 ms**, 카드 1개 수정 시 `renderNode` **1회** 호출 (1,001회 아님) |
| 2D 고속 휠 입력 버스트 (20회 / 틱) | rAF 프레임 병합(코얼레싱) | 20회 이벤트 → **Canvas2D 렌더 1회** (누적 이동량 100% 보존) |
| React / Vue / Headless 셀렉터 | `useCanvasSelector` / `subscribeCanvasSelector` + `shallowEqual` | 100회 호버 갱신 동안 무관 컴포넌트 리렌더 **0회** |
| 3D `1k-boxes` / `10k-boxes` / `1k-spheres` | `render.batch: true` 인스턴싱 + BVH 피킹 (Metal WebGL2) | `drawCalls=1`, `geometries=1`, **8.30 ms p50** (16 ms GPU 게이트 통과) |
| 2D 전용 프로덕션 번들 (`playground-flow`, `playground-network`) | `@denovo/canvas/2d` (Three.js / WebGPU 미포함) | **1.87 MB → 352–361 kB** (**-80.6% ~ -81.2%**, Three.js 0 B) |

*(3D 하드웨어 GPU 시간은 macOS Apple Silicon ANGLE Metal 기준이며, 2D Canvas2D 컬링·증분 동기화·스마트 스냅·HTML diff·rAF 병합·셀렉터 격리 및 전체 브라우저 쇼케이스 스위트는 GitHub Actions `ubuntu-latest` CI에서도 매 커밋 자동 검증됩니다.)*

## 패키지 및 서브패스 구성

| 패키지 / 서브패스 | 역할 |
| --- | --- |
| `@denovo/canvas` | 통합 2D/3D 퍼사드 (`createCanvas`, `createEditor`, 툴, Named Operations, 셀렉터, `./styles.css`, `./worker`, `./indexed-db`, `./react-query`, `./web`, `./react`, `./react/2d`). |
| `@denovo/canvas/2d` | `three`, `three/webgpu`, `three-mesh-bvh`가 전혀 없는 경량 2D 전용 퍼사드. |
| `@denovo/canvas-core` | 프레임워크 독립 `0.2.0` 문서/씬/커맨드/저장소/플러그인 스키마 및 검증. |
| `@denovo/canvas-editor` | 커맨드 디스패처, 트랜잭션, Undo/Redo, 툴, Named Operations, `subscribeCanvasSelector` / `shallowEqual`. |
| `@denovo/canvas-web` | 브라우저 2D(Canvas2D + 2D WebGPU) 및 3D(WebGL2 + WebGPU) 런타임, 공간 인덱스, 스마트 스냅, 오버레이 가상화 (`./2d`, `./3d`, `./indexed-db`). |
| `@denovo/canvas-three` | Three.js 최적화 프리미티브(온디맨드 렌더, 인스턴싱, BVH 레이캐스팅, 공식 필드 드로어). |
| `@denovo/react-canvas` | React 어댑터 (`CanvasView`, `CanvasStage3D`, `useCanvasSelector`) + Three.js/R3F/Drei 미포함 `./2d` (`Canvas2DView`, `useCanvasSelector`). |
| `@denovo/vue-canvas` | Vue 3 어댑터 (`DenovoCanvas`, `useCanvasSelector`) + Three.js 미포함 `./2d` (`DenovoCanvas2D`, `useCanvasSelector`). |
| `@denovo/svelte-canvas` | Svelte 어댑터 (`DenovoCanvas`, `createCanvasSelectorStore`) + Three.js 미포함 `./2d` (`DenovoCanvas2D`, `createCanvasSelectorStore`). |
| `@denovo/solid-canvas` | Solid 어댑터 (`DenovoCanvas`, `useCanvasSelector`) + Three.js 미포함 `./2d` (`DenovoCanvas2D`, `useCanvasSelector`). |
| `@denovo/canvas-server` | 서버 측 씬 저장소 어댑터 및 낙관적 충돌 검사 영속성. |
| `@denovo/canvas-worker` | Web Worker 태스크 큐 및 메인 스레드 외부 지오메트리 변환. |
| `@denovo/canvas-bim` | 선택적 BIM 계약 및 `./web-ifc` 멀티 모델 IFC 파서 어댑터. |

## 개발 및 검증

```sh
pnpm install
pnpm build
pnpm typecheck

# 결정적 검증 스위트
pnpm verify:docs
pnpm verify:public-api
pnpm verify:pack-smoke
pnpm verify:document-schema
pnpm verify:editor-core
pnpm verify:hit-testing
pnpm verify:selectors
pnpm verify:2d-performance
pnpm verify:flow-showcase
pnpm verify:network-showcase
pnpm verify:diagram-rendering
pnpm verify:region-mask
```

## 라이선스 및 거버넌스

Denovo Canvas는 [Apache License 2.0](./LICENSE) 라이선스로 배포됩니다.
저작권 및 서드파티 고지는 [NOTICE](./NOTICE)를 참고하세요.

- [변경 이력 (Changelog)](./CHANGELOG.md)
- [기여 가이드 (Contributing)](./CONTRIBUTING.md)
- [행동 강령 (Code of Conduct)](./CODE_OF_CONDUCT.md)
- [보안 정책 (Security Policy)](./SECURITY.md)
- [문서 전체 인덱스](./docs/README.md)
