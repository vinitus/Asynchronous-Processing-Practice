# 문제 01. 검색 결과 최신성 보장 — JS Search Controller

자동차 검색에 사용할 프레임워크 독립적인 JavaScript 검색 컨트롤러를 작성하세요. 사용자가 `현대`를 검색한 직후 `현대 아반떼`를 검색하면, 두 요청의 완료 순서에 관계없이 최신 검색의 상태만 보여야 합니다. React나 DOM은 사용하지 않습니다.

## 공개 API

CommonJS로 `createSearchController`를 내보내세요.

```js
const { createSearchController } = require('./index');
const controller = createSearchController(searchApi);
// controller.search(query): void
// controller.getState(): { results: Array, loading: boolean, error: Error | null }
// controller.subscribe(listener): () => void
// controller.dispose(): void
```

- `searchApi(query, options?)`는 검색 결과 배열로 이행하거나 `Error`로 거부되는 Promise를 반환하는 주입 함수입니다. 취소를 지원한다면 선택적 두 번째 인수 `{ signal }`을 전달할 수 있습니다. 취소 신호 사용은 필수가 아닙니다.
- `search(query)`는 문자열 검색어를 전달합니다. 검색 결과는 `getState()`와 구독 콜백으로 관찰합니다. 반환값은 사용하지 않습니다.
- `getState()`는 현재 상태를 반환합니다. 최초 상태는 `{ results: [], loading: false, error: null }`입니다.
- `subscribe(listener)`는 상태 변경 시 현재 상태를 인수로 받는 콜백을 등록하고, 그 구독을 해제하는 함수를 반환합니다.
- `dispose()`는 컨트롤러를 종료합니다.

## 요구사항

1. 비어 있지 않은 검색어마다 검색 API를 비동기로 실행하고 해당 검색어를 전달합니다.
2. 가장 최근에 전달된 검색어의 결과만 반영합니다. 동일한 문자열을 다시 전달해도 별도의 최신 검색입니다.
3. 오래된 요청의 성공과 실패는 현재 결과, 로딩, 오류를 변경하거나 상태 변경 알림을 발생시키지 않습니다. 최신 요청이 진행 중인 경우에도 같습니다.
4. 유효한 검색 직후 `getState().loading`은 `true`입니다. 최신 요청 성공 시 결과를 저장하고, 실패 시 오류를 저장합니다. 어느 경우든 완료 후 로딩은 `false`입니다.
5. 빈 검색어는 결과와 오류를 초기화합니다. 앞서 시작한 요청이 이후 완료되어도 초기화한 상태를 바꾸지 않습니다.
6. 상태가 변경되면 등록된 콜백에 현재 상태를 알립니다. 구독 해제한 콜백에는 이후 알리지 않습니다.
7. 종료 후 완료되는 비동기 결과는 상태에 반영하지 않으며 알림도 발생시키지 않습니다.
8. API가 취소를 무시하더라도 위 최신성 보장이 유지되어야 합니다. API 실패가 처리되지 않은 Promise 거부로 유출되어서는 안 됩니다.

## 원문의 모호한 부분에 대한 계약과 가정

다음은 실행 가능한 인터페이스를 정의하기 위한 가정입니다. 별도 재시도, 캐시, 입력 지연 등은 요구하지 않습니다.

- 검색어는 문자열이고 빈 검색어는 정확히 `''`입니다. 공백 정리와 잘못된 타입 처리는 평가하지 않습니다.
- 결과는 배열이며 API가 반환한 내용 그대로 노출합니다. 오류는 전달받은 `Error` 객체를 노출합니다.
- 새 검색 시작 시 기존 결과는 유지하고 오류는 `null`로 지웁니다. 최신 실패 시 기존 결과는 유지합니다.
- 빈 검색은 API를 호출하지 않고 `{ results: [], loading: false, error: null }`로 전환합니다.
- 종료는 현재 상태를 보존합니다. 종료 이후의 새 메서드 호출 동작, 반복 종료 동작은 평가하지 않습니다.
- 구독 시 최초 상태를 즉시 알릴지는 자유입니다. 변경 알림은 해당 변경을 처리하는 이벤트 루프 차례가 끝날 때까지 전달되어야 합니다. 콜백이 던지는 오류나 콜백 내부 재진입은 범위 밖입니다.
- 테스트 소비자는 상태 객체와 결과 배열을 수정하지 않습니다. 객체 동일성, 내부 자료구조, 취소 방식, Promise 조합 방식은 평가하지 않습니다.
- 주입 API는 Promise를 반환합니다. 동기적으로 예외를 던지는 API는 범위 밖입니다.

## 실행

프로젝트 루트에서 기존 의존성을 설치한 후 실행하세요.

```sh
pnpm install
pnpm exec jest --runInBand --testPathPatterns="01. JS Search Controller/index.test.js"
```

또는 `npm test -- --runInBand --testPathPatterns="01. JS Search Controller/index.test.js"`로 실행할 수 있습니다.
Windows PowerShell 실행 정책으로 스크립트 실행이 차단되면 `npm.cmd test -- --runInBand --testPathPatterns="01. JS Search Controller/index.test.js"`를 사용하세요.
제공된 `index.js`는 미구현 스켈레톤이므로 구현 전에는 테스트가 실패하는 것이 정상입니다.

## 테스트 범위

테스트는 직접 이행·거부 시점을 제어하는 Promise를 사용합니다. 실제 네트워크, 임의 지연, 시간 측정에 의존하지 않습니다. Node의 다음 이벤트 루프 차례까지 기다려 Promise 처리와 알림을 관찰합니다.

| 테스트 그룹 | 근거 |
| --- | --- |
| 최초 상태, 검색어 전달, 즉시 로딩, 최신 성공·실패 | 요구사항 1·4 및 상태 계약 |
| 역순 완료, 최신 처리 전후의 오래된 성공·실패, 같은 검색어 반복 | 요구사항 2·3·8 |
| 빈 검색과 진행 중 요청 무효화 | 요구사항 5 및 빈 검색 계약 |
| 기존 결과 유지와 오류 해제 | 명시한 상태 전환 가정 |
| 여러 구독과 구독 해제 | 요구사항 6 및 구독 계약 |
| 종료 후 성공·실패 무시 | 요구사항 7 및 종료 계약 |
