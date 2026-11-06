# React 문제 01. 검색어 변경과 컴포넌트 언마운트 — `useEffect` Race Condition

원문: [react-problem.md](../../react-problem.md)의 문제 01. 정답을 포함하지 않는 연습 문제입니다.

## 공개 API와 계약

CommonJS `index.js`에서 다음 API를 내보내세요. React hook과 컴포넌트는 실제 React로 구현합니다.
JSX 사용은 선택입니다. 현재 설정에서는 `React.createElement`를 사용할 수 있습니다.

`useCarSearch(query, fetchApi)` → `{ cars: [], loading: false, error: null }`.
`fetchApi(url, { signal }?)`는 fetch 호환 Promise이며 응답은 `{ ok, status, json() }`입니다.
`/api/cars?q=${encodeURIComponent(query)}`로 요청합니다. 비정상 HTTP 응답은 `Error`로 노출하며 JSON을 읽지 않습니다.
빈 문자열은 요청하지 않고 최초 상태로 초기화합니다. 새 요청은 기존 cars를 유지하고 오류를 지웁니다.
요청의 완료에는 JSON 파싱도 포함합니다. 취소를 무시하는 API에도 최신성이 유지되어야 합니다.

`CarSearch({ fetchApi })`는 제공된 최소 UI입니다. `Query` 입력, role=status의 Loading/Idle, role=alert의 오류, 이름이 `Cars`인 목록을 제공합니다. 테스트와 기본 UI의 cars 데이터는 문자열 배열입니다.

## 요구사항

1. 화면에는 현재 검색어에 해당하는 최신 결과만 표시한다.
2. 검색어가 변경되거나 컴포넌트가 언마운트되면 이전 작업을 취소하거나 무효화한다.
3. 이전 요청이 뒤늦게 실패해도 최신 검색의 오류 상태를 덮어쓰지 않는다.
4. 로딩 표시와 종료는 최신 검색 요청의 생명주기에 맞춰 동작해야 한다.
5. 검색어를 URL에 포함할 때 URI 인코딩을 적용한다.
6. HTTP 응답의 성공 여부를 확인하고 실패 응답을 오류 상태로 처리한다.
7. 언마운트 후에 완료된 비동기 작업이 컴포넌트의 화면 상태에 영향을 주지 않아야 한다.

## 원문의 모호한 부분에 대한 계약과 가정

- 주입 함수와 입력 참조는 테스트 중 안정적이며 주입 API는 동기 예외 없이 Promise를 반환합니다.
- 오류는 Error 객체이며 실패는 처리되지 않은 Promise 거부로 유출되면 안 됩니다.
- 취소를 지원하지 않는 API도 테스트합니다. 언마운트 시 대기 작업을 시작하거나 늦은 응답을 반영하지 않습니다.
- 사용자 콜백의 예외, 잘못된 입력, 스타일은 평가하지 않습니다. React StrictMode에서도 효과 정리가 안전해야 합니다.
- 구현 방식, 내부 자료구조, 상태 객체 동일성은 평가하지 않습니다.

## 실행

루트에서 `corepack pnpm@10 install --frozen-lockfile` 후:

```sh
npm test -- --runInBand --testPathPatterns="react/01. Effect Race Condition/index.test.js"
```

제공 UI는 마운트되지만 hook은 초기 상태와 빈 동작만 반환합니다. 비동기 로직은 TODO이며 06번 작업 연결부는 Not implemented 오류를 던집니다. 구현 전 요구사항 assertion 실패는 정상이며 러너/모듈 오류와 구분하세요.

## 테스트 범위

`index.test.js`는 React DOM에서 마운트하고 수동 Promise 및 가상 타이머로 순서, 오류, 정리와 상태 전환을 관찰합니다.
실제 네트워크나 임의 sleep은 사용하지 않습니다. 원문의 번호와 테스트 이름을 함께 읽어 평가 범위를 확인하세요.
기본 UI와 hook 연결은 제공됩니다. 입력/버튼 조작과 화면의 목록·로딩·오류·진행률을 관찰하는 UI 테스트 및 hook 계약 테스트를 함께 실행합니다. 비동기 상태 전환·요청·스케줄링·정리는 직접 구현하세요.

`npm run react:browser` 후 http://127.0.0.1:8000 에서 Exercise를 선택해 미구현 UI도 볼 수 있습니다. 구현 후 Mock requests에서 JSON 응답을 편집하고 Resolve/Reject를 원하는 순서로 눌러 역순 응답과 실패를 재현하세요. 실제 서버는 필요하지 않습니다.
