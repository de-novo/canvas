# 검증 보고를 실제 실행에 묶기

**Date:** 2026-07-28
**Status:** ✅ 완료

## Context

슬라이스 6·7에서 런타임 버그를 각각 뒤늦게 발견했다. 검증 스크립트가 14,000줄
있는데도 놓친 이유를 조사하다 **보고 방식 자체의 결함**을 찾았다.

## 발견한 것

1. **`ok: true`가 하드코딩이었다.** `verify-editor-core`, `verify-public-api`,
   `verify-document-schema` 모두 스크립트가 끝까지 도달하면 무조건 `true`를
   출력했다. 지금까지의 "ok: true"는 "모든 검증 통과"가 아니라 **"예외 없이 완주"**를
   뜻했다.
2. **검증 이름 목록이 실행과 무관했다.** `verify-editor-core`는 68개,
   `verify-public-api`는 41개 이름을 손으로 나열했다. **검증 코드를 지워도 이름은
   남아 통과한 것처럼 보였다.**
3. **첫 실패에서 프로세스가 죽어** 뒤의 검증 결과를 알 수 없었다.

## 변경

### `scripts/lib/checks.mjs` (신규)
`createCheckRunner()` — `check(name, fn)` + `report(extra?)`.
- `ok`는 실패 배열이 비었을 때만 true (하드코딩 불가)
- `checks`는 **실제 실행된 이름만** 수집
- 실패해도 나머지를 계속 실행하고 마지막에 모아 보고
- 실패 시 `process.exitCode = 1`
- 동기 `fn`은 동기적으로 처리해 기존 호출부의 순서를 보존
- 중복 이름은 throw (검증이 조용히 가려지는 것 방지)

### `verify-document-schema.mjs`
이미 `check()` 관용구를 쓰고 있어 헬퍼로 교체만. **36개 이름 그대로 유지**
(회귀 없음 기준선).

### `verify-editor-core.mjs`, `verify-public-api.mjs`
이 둘은 성격이 다르다 — 446개 top-level 문장이 **editor 인스턴스 하나를 계속
변형하며 순차 실행**된다. 독립 블록으로 쪼개면 상태 의존성 때문에 뒤 검증이
깨진다. 그래서 재구조화 대신 **거짓 보고만 제거**했다:
- 손으로 나열한 이름 배열(68개/41개) 삭제
- `ok`를 실행 기반으로 전환
- 완주 사실만 `*-suite` 하나로 정직하게 보고

## 검증 — 도구가 거짓말하지 않는지 직접 확인

검증 도구를 고치는 작업이므로 도구 자체를 검증했다.

**헬퍼 셀프테스트**: 실패 격리(실패 후에도 계속 실행), 실패 2건 모두 보고,
동기·비동기 양쪽 포착, 통과 시 `failures` 키 없음, 중복 이름 throw, 종료 코드.

**실제 스크립트에서**:
- 서로 다른 검증 2개를 동시에 깨뜨림 → **둘 다 보고**되고 나머지 34개는 계속
  실행 (`ok: false`, exit 1)
- **검증 하나를 통째로 삭제** → 보고 수가 36 → 35로 줄고 **이름이 사라짐**.
  이전 방식이었다면 이름이 남아 통과처럼 보였을 지점이다.
- 정상 시 exit 0, 실패 시 exit 1

## 이 작업이 바꾸지 않은 것

검증 **내용**은 그대로다. 커버리지를 늘린 게 아니라 이미 있던 검증이 정직하게
보고하도록 고쳤다. vitest 등 러너는 도입하지 않았다 — 실행 시간이 0.9초로
충분히 빠르고, 문제는 속도가 아니라 보고 방식이었다.

## 2차 — 나머지 스크립트 전환, 그리고 드러난 실제 버그

`hit-testing`(하드코딩 8개 삭제), `server`, `browser-rendering`의 `ok` 하드코딩을
제거했다. `browser-rendering-adapters`는 이미 `failed` 플래그로 정확히 보고하고
있어 손대지 않았다.

**`verify-browser-rendering`이 오랫동안 돌지 않고 있었다.** 전환 후 처음 끝까지
실행해 보니 세 겹의 문제가 순서대로 나왔다.

### 1. Vite URL 감지 실패 (검증이 시작조차 못 함)
`Local:\s+(http://...)` 정규식이 ANSI 색상 코드 때문에 매칭되지 않아 30초 후
타임아웃. `verify-browser-rendering-adapters`는 이미 `stripAnsi`로 해결해 둔
문제였다. 같은 방식을 적용.

### 2. 도구 커서가 지워지는 회귀 (Slice 5)
`cursor: default`를 기대했는데 `auto`. 원인은 호출 순서였다:
1. `canvas/src/index.ts:546` — 도구 커서 설정
2. `:547` — `setNavigationInputEnabled(false)`
3. `2d.ts` — **스페이스바 팬용으로 넣은 `cursor = ""`가 도구 커서까지 삭제**

스페이스바가 실제로 활성일 때만 되돌리도록 좁히고, 시작 시 커서를 기억해
(`cursorBeforeSpacePan`) 해제 시 **복원**하도록 고쳤다. 이전에는 스페이스바를
떼면 도구 커서가 사라졌다.

### 3. 드래그 팬이 전혀 동작하지 않았다 (Slice 3)
`ReferenceError: Cannot access 'activeAnimation' before initialization` —
`handleNavigationPointerDown`이 참조하는 `activeAnimation`의 선언이 아래에 있어
**포인터 다운마다 예외로 죽고 있었다.** 즉 2D 캔버스에서 마우스 드래그 팬이
동작하지 않는 상태였다.

Slice 7에서 잡은 `selectionIds`와 **완전히 같은 종류**의 버그다(선언이 사용보다
뒤). typecheck는 둘 다 통과시킨다. 선언을 앞으로 옮겨 해결했고, 브라우저에서
`(0,0) → (48,32)`로 팬이 복구된 것을 확인했다.

## 남은 것

- **`verify-browser-rendering`에 아직 실패가 하나 남아 있다.** 3D 어소링에서
  커밋 후 프리뷰 픽셀이 정리되지 않는다(`transient grid or draft preview was not
  cleaned after commit`). 이번 세션에서 만진 영역(검증 보고, 2D 커서/애니메이션)
  밖이지만, 그동안 `activeAnimation` 예외 때문에 **여기까지 도달하지 못해
  가려져 있었을 가능성이 높다**. 별도 조사 필요.
- `verify-editor-core`(3,300줄)를 상태 독립 블록으로 재구성하면 실패 격리의
  이점을 온전히 받는다. 위험이 커서 이번엔 하지 않았다.
- `verify-performance`는 보고 구조가 달라(리포트 파일 생성) 미전환.

## 교훈

같은 종류의 버그(선언 순서)가 두 번 나왔고 둘 다 typecheck를 통과했다. 2D
런타임의 `createCanvas2D`가 1,000줄 넘는 클로저라 선언과 사용이 멀어진 것이
근본 원인이다. 상태 선언을 한곳에 모으거나 클로저를 쪼개는 것이 재발 방지책이다.
