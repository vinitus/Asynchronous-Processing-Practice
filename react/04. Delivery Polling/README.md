# React 문제 04. 택배 배송 상태 자동 갱신 화면

원문: [react-problem.md](../../react-problem.md)의 문제 04. 정답을 포함하지 않는 연습 문제입니다.

## 공개 API와 계약

CommonJS `index.js`에서 다음 API를 내보내세요. React hook과 컴포넌트는 실제 React로 구현합니다.
JSX 사용은 선택입니다. 현재 설정에서는 `React.createElement`를 사용할 수 있습니다.

`useDeliveryPolling(fetchStatus)` → `{ status: null, loading: false, error: null, stopped: false, stop }`.
`fetchStatus({ signal }?)`는 배송 상태 문자열의 Promise를 반환합니다. 마운트 시 즉시 조회합니다.
완료 후 2000ms를 기다렸다 다음 요청을 시작합니다. 연속 재시도 가능 실패 n회 뒤 대기는 `2000 * 2 ** n`ms입니다.
`error.retryable === true`는 네트워크/과부하 실패를 의미합니다. 나머지 오류는 자동 조회를 중단합니다.
성공 시 오류를 지우고 실패 횟수를 초기화합니다. 실패 시 이전 status를 유지합니다.
`stop()`은 stopped=true, loading=false로 만들며 타이머와 요청을 정리합니다. 재시작은 범위 밖입니다.
DELIVERED에서는 stopped=true로 끝납니다. `DeliveryStatus({ fetchStatus })`는 상태/로딩/오류 및 중지 버튼을 제공합니다.

## 요구사항

1. 기본 조회 간격은 2초다.
2. 이전 API 요청이 완료되기 전에는 새로운 조회 요청을 중복 실행하지 않는다.
3. 일시적인 네트워크 오류나 서버 과부하 오류에 대해서는 재시도한다.
4. 연속 실패 횟수가 증가하면 다음 조회까지의 대기 시간을 늘린다.
5. 정상 응답을 받으면 기본 조회 간격으로 복귀한다.
6. 배송 상태가 `DELIVERED`가 되면 자동 조회를 중단한다.
7. 로딩·배송 상태·오류 정보를 화면에서 확인할 수 있어야 한다.
8. 사용자가 조회를 중지하거나 컴포넌트를 언마운트하면 예정된 타이머와 진행 중 요청을 정리한다.
9. 중단 이후 늦게 도착한 응답은 화면 상태를 변경하지 않아야 한다.

## 원문의 모호한 부분에 대한 계약과 가정

- 주입 함수와 입력 참조는 테스트 중 안정적이며 주입 API는 동기 예외 없이 Promise를 반환합니다.
- 오류는 Error 객체이며 실패는 처리되지 않은 Promise 거부로 유출되면 안 됩니다.
- 취소를 지원하지 않는 API도 테스트합니다. 언마운트 시 대기 작업을 시작하거나 늦은 응답을 반영하지 않습니다.
- 사용자 콜백의 예외, 잘못된 입력, 스타일은 평가하지 않습니다. React StrictMode에서도 효과 정리가 안전해야 합니다.
- 구현 방식, 내부 자료구조, 상태 객체 동일성은 평가하지 않습니다.

## 실행

루트에서 `corepack pnpm@10 install --frozen-lockfile` 후:

```sh
npm test -- --runInBand --testPathPatterns="react/04. Delivery Polling/index.test.js"
```

스켈레톤은 명시적으로 Not implemented 오류를 던집니다. 구현 전 assertion/미구현 오류는 정상이며 러너/모듈 오류와 구분하세요.

## 테스트 범위

`index.test.js`는 React DOM에서 마운트하고 수동 Promise 및 가상 타이머로 순서, 오류, 정리와 상태 전환을 관찰합니다.
실제 네트워크나 임의 sleep은 사용하지 않습니다. 원문의 번호와 테스트 이름을 함께 읽어 평가 범위를 확인하세요.
화면 컴포넌트에는 의미 있는 접근 가능한 목록/상태/오류 표시를 제공하세요.
