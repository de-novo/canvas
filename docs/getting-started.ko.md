# 시작하기 및 최적화 가이드

[English](./getting-started.md) | **한국어** | [简体中文](./getting-started.zh-CN.md)

이 가이드는 Denovo Canvas에서 앱에 맞는 엔트리포인트를 고르는 법, 불필요한
리렌더 없이 헤드리스 에디터를 프레임워크에 연결하는 법, 그리고 내장 2D/3D
최적화 프리미티브를 활용하는 방법을 정리합니다.
*(규범적 상세 명세는 영문 [문서 인덱스](./README.md)의 정본 문서를 따릅니다.)*

## 1. 엔트리포인트 선택

| 앱 유형 | 권장 임포트 | Three.js 포함 여부 |
| --- | --- | --- |
| 2D Vanilla / TypeScript | `@de-novo/canvas/2d` + `@de-novo/canvas/styles.css` | 미포함 (`0 B`) |
| 2D React / Next.js | `@de-novo/canvas/2d` + `@de-novo/canvas/react/2d` (또는 `@de-novo/react-canvas/2d`) | 미포함 (`0 B`) |
| 2D Vue 3 | `@de-novo/canvas/2d` + `@de-novo/vue-canvas/2d` | 미포함 (`0 B`) |
| 2D Svelte | `@de-novo/canvas/2d` + `@de-novo/svelte-canvas/2d` | 미포함 (`0 B`) |
| 2D Solid | `@de-novo/canvas/2d` + `@de-novo/solid-canvas/2d` | 미포함 (`0 B`) |
| 3D 또는 동적 2D/3D | `@de-novo/canvas` + 선택적 `@de-novo/react-canvas` / `vue` / `svelte` / `solid` | 포함 |

## 2. 핵심 아키텍처 개념

1. **문서 (`0.2.0` JSON)** — 렌더러에 독립적인 직렬화 데이터(`layers`, `nodes`,
   `mode: "2d" | "3d"`, `render`, `assets`, `metadata`). `defineDocument`나
   `parseDocument`로 검증합니다.
2. **헤드리스 에디터 (`createEditor`)** — 트랜잭션, 선택, 호버, 툴, Undo/Redo
   이력을 관리합니다. 변경은 **Named Operations**(`setNodeVisible`,
   `setLayerVisible`, `removeNode`, `removeEdge`, `stackBox` 등) 또는 표준
   커맨드로 적용합니다.
3. **런타임 (`createCanvas` / 프레임워크 뷰)** — Canvas2D, 2D WebGPU, WebGL2,
   3D WebGPU로 문서를 렌더링하고 `connectEditorToCanvas(editor, canvas)`를 통해
   포인터·터치 히트를 에디터와 연결합니다.

## 3. 세분화 셀렉터로 UI 리렌더 차단

캔버스 위에서 마우스를 움직이면 `state.selection.hoveredId`가 빈번하게
바뀝니다. 툴바나 인스펙터가 전체 에디터 상태를 구독하는 대신 필요한 슬라이스만
구독하고, 파생 객체/배열을 반환할 때는 `shallowEqual`을 전달하세요.

```ts
import { shallowEqual, subscribeCanvasSelector } from "@de-novo/canvas/2d";

const stop = subscribeCanvasSelector(
  editor,
  (state) => ({
    canUndo: state.history.canUndo,
    canRedo: state.history.canRedo,
    selectedCount: state.selection.ids.length
  }),
  (slice) => renderToolbar(slice),
  { equals: shallowEqual }
);
```

프레임워크별 바인딩:
- React: `useCanvasSelector(editor, selector, shallowEqual)`
- Vue: `useCanvasSelector(editor, selector, shallowEqual)`
- Svelte: `createCanvasSelectorStore(editor, selector, shallowEqual)`
- Solid: `useCanvasSelector(editor, selector, shallowEqual)`

## 4. 내장 2D 최적화 활용

대부분의 2D 최적화는 기본 활성화되어 있습니다.

- **뷰포트 컬링 및 O(k) 증분 공간 인덱스**: 화면에 보이는 노드만 렌더링·피킹·마키
  조회하며, 소수 노드를 이동·편집할 때 10k 전체 인덱스를 재구축하지 않고 변경된
  노드와 연결된 엣지만 O(k)로 갱신합니다.
- **O(visible) 스마트 스냅 가이드**: 드래그 중
  `runtime.current.computeSnapGuides(targetBounds, { excludeNodeIds, threshold: 6 })`를
  호출하면 화면 밖 노드를 순회하지 않고 보이는 이웃 노드 기준으로만 정렬
  델타(`dx`, `dy`)와 가이드 선분을 계산합니다. 헤드리스 순수 함수
  `computeCanvas2DSnapGuides(bounds, candidates)`도 제공합니다.
- **가상 HTML 오버레이 카드**: `html` 노드는 현재 뷰포트에 진입한 카드만 DOM에
  마운트하며, 실제 데이터가 바뀐 카드에 대해서만 `renderNode`를 다시 호출합니다.
- **rAF 입력 버스트 병합**: 한 프레임 안의 연속 휠·포인터·호버·프리뷰 이벤트를
  단일 프레임 렌더로 병합하면서 누적 이동/줌 델타는 정확히 보존합니다.
- **명시적 2D WebGPU**: 대규모 2D 씬에서 GPU 상주 버텍스·아틀라스 캐시를 쓰고
  싶다면 `renderer: { backend: "webgpu" }`를 지정합니다.

## 5. 내장 3D 및 BIM 최적화

- 3D 씬에 `render: { batch: true }`를 설정하면 최상위 `box`·`sphere` 노드를
  `InstancedMesh`로 자동 배칭하고 BVH 레이캐스트 피킹을 적용합니다.
- `renderer: "auto"`는 WebGPU 지원 환경에서 WebGPU를 우선 선택하고 미지원 시
  WebGL2로 폴백합니다. 엄격한 실패 보장이 필요하면 `"webgpu"` 또는 `"webgl2"`를
  명시하세요.
- 무거운 메시 변환은 `@de-novo/canvas/worker`, 대규모 청크 스트리밍은
  `createSceneChunkLoader`, 멀티 모델 IFC 연합은 `@de-novo/canvas-bim`을
  사용합니다.

## 6. 스타일링과 커스텀 노드

- `@de-novo/canvas/styles.css` 임포트 후 `--dc-*` CSS 커스텀 변수를 덮어쓰면
  빌드 없이 테마를 바꿀 수 있습니다(미지정 시 Tailwind v4 `--color-*` 및 shadcn
  토큰을 자동 사용).
- 사용자 정의 시각 노드(`plugin.<org>.<kind>`)는 `@de-novo/canvas/web`의
  `registerPluginNodeDrawer`로 등록합니다. 자세한 내용은
  [Kind Drawer Seam](./kind-drawer-seam.md)과
  [Public API Contract](./public-api-contract.md)을 참고하세요.

## 다음 문서

- [문서 인덱스](./README.md)
- [Public API Contract](./public-api-contract.md)
- [Named Authoring Operations](./named-authoring-operations.md)
- [기여 가이드 (Contributing)](../CONTRIBUTING.md)
