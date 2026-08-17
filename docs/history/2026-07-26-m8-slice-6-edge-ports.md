# M8 Slice 6 — 엣지가 실제로 연결 핸들에 붙는다

**Date:** 2026-07-26
**Status:** ✅ 완료 (브라우저에서 지오메트리 검증)

## Context

Slice 5에서 노드 상하좌우 연결 핸들을 추가했지만, 커넥터 도구가 인식한 면은
엣지 `metadata`에 기록만 되고 렌더러가 읽지 않았다 (`2d.ts`에 `metadata` 참조
0건). 결과적으로 핸들을 잡아 연결해도 엣지는 노드 중심을 이었고, 핸들은 사실상
장식이었다.

조사 과정에서 같은 엣지 지오메트리를 네 곳에서 따로 계산하고 있고 이미 서로
어긋나 있다는 것도 드러나, 포트를 얹기 전에 계산을 하나로 모았다.

## 함께 고친 기존 결함

1. **히트테스트가 포트를 무시** — `hitTestCanvas2DEdgeNode`가 끝점을 자체
   계산해, 포트가 지정된 엣지는 그려지는 위치와 클릭되는 위치가 달랐다.
2. **orthogonal 엣지의 히트테스트 부재** — L자로 그려지지만 히트테스트에는
   해당 분기가 없어 대각선 현으로 판정됐다.
3. **화살표 방향 좌표 혼용** — `sourceArrow`가 `end[0]`와 `start[1]`을 섞어
   썼다 (`2d.ts:2105-2106`).
4. **엣지 바운드가 꺾임/곡선을 제외** — 마퀴·미니맵이 보이는 엣지를 잘라냈다.

## 변경 내용

### 스키마 — 포트는 "면 이름"
`packages/core/src/index.ts`
- `CANVAS_NODE_PORT_SIDES` / `CanvasNodePortSideSchema` / `CanvasNodePortSide`를
  신설해 export. 렌더러·커넥터 도구·스키마가 이 하나를 공유한다.
- `Canvas2DEdgeNodeSchema`의 `sourcePort`/`targetPort` 타입을 노드 id에서 면
  이름 enum으로 변경(Legacy 스키마 동일). 기존 노드-id 해석은 값을 쓰는 코드가
  없었고 존재 검증도 없어 잘못된 id가 조용히 중심으로 degrade됐다.
- `edge.draft` 프리뷰에 `sourcePort` 추가.

### 렌더러 — 지오메트리 단일화
`packages/web/src/2d.ts`
- `resolveCanvas2DEdgeGeometry(node, sceneGraph)` 신설: `{ start, end,
  waypoints, control }`. **렌더·히트테스트·바운드가 모두 이것만 쓴다.**
- `resolveCanvas2DEdgeEndpoint`가 포트 지정 시
  `resolveCanvas2DNodeWorldBounds` + `resolveCanvas2DConnectionHandlePoint`로
  해당 면의 점을 반환(핸들이 그려지는 바로 그 점).
- `resolveCanvas2DOrthogonalWaypoints`: 포트가 있으면 그 면 바깥으로 스텁을 낸
  뒤 꺾는다. 포트가 없으면 기존 단일 벤드 동작 유지 → 기존 씬 렌더 불변.
- 화살표는 경로의 첫/마지막 세그먼트에서 방향을 뽑는다.
- 히트테스트는 waypoint 폴리라인을 세그먼트별로 검사.
- `edge.draft` 프리뷰도 잡은 핸들에서 출발.

### 커넥터 도구
`packages/editor/src/authoring/tools/connector-2d.ts`
- 잡은 면을 `metadata` 대신 `sourcePort`/`targetPort`로 커밋.
- 프리뷰에 `sourcePort` 전달.
- 로컬 `ConnectorHandleSide` 선언 제거, core 상수 공유.

## 검증

- `pnpm typecheck` → **30/30**
- `pnpm build` → 19/19 (Next playground 제외 — `next/font` 구글 폰트 fetch 실패,
  환경 문제)
- `verify:document-schema` → `ok: true`. `scene-schema-validates-edge-ports`
  케이스 신설: 잘못된 면 이름 거부 + 포트 미지정 시 `null` 기본값 확인.
- `verify:public-api`, `verify:editor-core` → `ok: true`
- `verify:browser-rendering-adapters` (Diagram) → 61 colors, 에러 없음

**지오메트리 실측 (Playwright로 실행 중인 캔버스를 히트테스트):**
- node-a(rect `[80,80]` size `[120,60]`)의 아래 면 중점 `[140,140]`에서
  히트테스트 → `edge-2`의 `edge.source`가 잡힘. 중심 부착이었다면 `[140,110]`
  이라 잡히지 않는다. **포트 부착이 실제로 동작함을 확인.**
- 아래 면에서 스텁만큼 내려간 `[140,164]`에서도 `edge-2`가 잡힘.
  **orthogonal 경로가 실제 경로대로 히트테스트됨을 확인** (기존 직선 현
  판정이었다면 놓쳤을 지점).

playground-diagram에 포트 지정 orthogonal 엣지(`edge-2`, 초록)를 추가했고,
검증 편의를 위해 `window.__denovoRuntime`을 노출했다(플레이그라운드 한정).

## 다루지 않음

- 자동 레이아웃(계층형/방향그래프 배치)
- 엣지 호버 상태 / 선택된 엣지 강조 (`selected`는 여전히 미사용)
- 다중 벤드 회피 라우팅 — 이번엔 면 인지 단일 스텁까지
- OS 클립보드
