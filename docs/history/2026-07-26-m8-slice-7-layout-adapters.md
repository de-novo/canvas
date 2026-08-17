# M8 Slice 7 — 레이아웃 어댑터 + 엣지 선택 시각화

**Date:** 2026-07-26
**Status:** ✅ 완료 (실행 중인 캔버스에서 좌표 검증)

## Context

요구는 "정렬 기능"이 아니라 **확장 가능한 정렬 구조**였다: 정렬/배분과 자동
레이아웃을 모두 지원하되, 사용자가 직접 다른 배치를 구현해 꽂을 수 있어야 한다.
따라서 이 슬라이스의 산출물은 어댑터 경계이고, 내장 정렬은 그 위의 첫 구현체다.

함께 Slice 5~6에서 미뤄둔 엣지 선택/호버 시각화를 넣었다. 무엇이 선택됐는지
보이지 않으면 정렬을 쓸 수 없어 사실상 전제 조건이었다.

## 설계를 좌우한 제약

`packages/editor`는 `packages/web`에 의존하지 않는다(editor → core + effect).
그런데 정렬은 노드 **바운드**가 필요하고 바운드 계산은 렌더러에 있다. 그래서:

- **어댑터는 순수 함수**다. 측정된 노드를 받아 좌표만 반환한다.
- 렌더러 지오메트리는 **주입**된다 (`resolveNodeBounds`).
- 커맨드 생성·트랜잭션 묶기·실행취소는 editor가 맡는다.

덕분에 어댑터 작성자는 배치 계산만 신경 쓰면 되고, 의존 방향도 깨지지 않는다.

## 변경 내용

### core — 어댑터 계약
`CanvasLayoutAdapter` (`name` / `kind: "arrange" | "layout"` / `apply`),
`CanvasLayoutInput`(nodes·edges·**measured**), `CanvasLayoutResult`(positions),
`CanvasRectBounds`. `CanvasToolContext`에 `resolveNodeBounds?` 능력 추가.

`measured: false`는 렌더러 지오메트리가 없어 바운드가 점으로 축약됐다는 뜻이다.
모서리·중심 기준 어댑터는 이때 **아무것도 움직이지 않는다** — 조용히 틀린 정렬을
하는 것보다 낫다.

### editor — 레지스트리와 실행
- `registerLayoutAdapter` / `getLayoutAdapters` (등록 시 unregister 반환,
  `registerTool`과 동일한 형태). 이름 중복·잘못된 kind·`apply` 누락을 거부한다.
- `applyLayout(name, options)` — 대상 노드를 모아 바운드를 채우고, 어댑터를
  호출하고, 결과를 **`transaction` 하나로** 커밋한다 → 실행취소 1회로 전부 복원.
- **위치가 없는 노드는 제외**한다. `edge`/`measurement`/`annotation`은
  `position`이 없어 정렬 대상이 아니다.
- 내장 어댑터: `createAlignAdapter`(6방향), `createDistributeAdapter`(가로/세로),
  `createGridLayoutAdapter`. 정렬은 `position`이 아니라 **바운드 기준 델타**로
  움직인다 — 원의 `position`은 중심이라 좌표를 직접 쓰면 타입마다 어긋난다.
- `applyLayout`에 `resolveNodeBounds` 옵션 추가. 툴 입력으로 들어온 능력은 툴이
  한 번 실행된 뒤에만 존재하므로, 직접 호출 시 주입할 수 있어야 한다.

### web — 지오메트리 노출과 선택 시각화
- `runtime.resolveNodeBounds(ids)` (기존 `resolveCanvas2DNodeWorldBounds` 재사용).
- 입력 브리지가 이 능력을 툴/에디터로 전달.
- `hoveredId` 상태 + `setHoveredNode`. `connectEditorToRuntime`이 선택과 함께 전달.
- `renderCanvas2DEdgeNode`의 `selected`가 드디어 실제로 그려진다: 선택은 accent
  색 + 굵기 +2, 호버는 굵기 +1만 (호버가 선택처럼 보이지 않게).

## 검증

- `pnpm typecheck` → **30/30**
- `pnpm build` → 19/19 (Next playground 제외 — `next/font` 구글 폰트 fetch 실패,
  환경 문제)
- `verify-editor-core.mjs`에 `layout-adapter-registry-and-single-undo` 추가:
  등록/중복거부/해제, 정렬 후 좌표, **실행취소 1회 복원**, 위치 없는 노드 보존,
  바운드 없을 때 degrade.
- `verify-document-schema` / `verify-public-api` → `ok: true`
- Diagram 브라우저 스모크 → 61 colors, 에러 없음

**실행 중인 캔버스 실측** (Playwright):
- 정렬 전 top `80 / 160 / 0` → `align.top` 후 **전부 `0`**
- `editor.undo()` 한 번으로 `80 / 160 / 0` 복원

**검증이 실제로 결함을 잡는지 확인**: `transaction` 묶기를 개별 dispatch로
잠시 되돌리자 "one undo must revert every node" 단언이 실패했다.

## 이 과정에서 잡은 런타임 버그

`selectionIds`/`hoveredId`를 사용 지점보다 아래에 선언해
`Cannot access 'selectionIds' before initialization`으로 **2D 런타임이 초기화에
실패**했다. typecheck는 통과했고 브라우저 프로브가 잡았다. 선언을 첫 `render()`
앞으로 옮겨 해결.

## 후속 — 미검증 부분 메우기

슬라이스 직후 점검에서 `distribute`·`grid`·`align` 나머지 5방향과 엣지 선택
렌더링이 **코드만 있고 한 번도 실행되지 않은 상태**임을 확인해 메웠다.

**`built-in-layout-adapter-geometry`** (`verify-editor-core.mjs`): 어댑터는 순수
함수이므로 좌표를 직접 단언한다. 노드 크기를 가로·세로 모두 다르게 두어,
바운드가 아닌 `position` 기준으로 계산하면 즉시 드러나게 했다.
- align 4방향의 정확한 좌표 (center-y는 높이가 달라 노드마다 다른 델타)
- distribute가 양 끝을 고정하고 **간격을 균등하게** 만드는지 (`|gap₀-gap₁| < 1e-9`)
- grid의 셀 배치
- 가드: unmeasured / 노드 1개 / distribute 2개는 모두 빈 결과

*결함 감지 확인*: `center-y`를 `position` 기준으로 되돌리자 세 노드가 `y=45`로
뭉개지며 단언 실패(정상값 `35/25/30`).

**엣지 강조** (`verify-browser-rendering-adapters.mjs`, Diagram 한정): 실제
픽셀을 읽는다. 캔버스 배경이 불투명이라 알파가 아니라 **배경색 제외**로
"그려짐"을 판정한다.

| 상태 | 두께 | 색 |
|---|---|---|
| idle | 5px | 자기 stroke (빨강) |
| 선택 | 8px | accent (`56,189,248`) |
| 호버 | 6px | 자기 stroke 유지 |

*결함 감지 확인*: 선택 시 accent 적용을 제거하자 "selected edge must change
colour"로 실패.

## 다루지 않음

- **계층형/방향그래프 자동 레이아웃(dagre 류)** — 어댑터 경계는 섰고 `layout`
  kind가 grid로 증명됐다. 사이클 처리·레이어 할당·교차 최소화는 그 자체로 한
  슬라이스 분량이라 분리했다. 이제 `apply` 하나만 구현해 꽂을 수 있다.
- 스마트 가이드(끌 때 뜨는 정렬선), OS 클립보드, 다중 벤드 회피 라우팅
