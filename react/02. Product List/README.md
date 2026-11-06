# React 문제 02. 관리자 상품 목록의 필터·페이지 상태 일관성

원문: [react-problem.md](../../react-problem.md)의 문제 02. 정답을 포함하지 않는 연습 문제입니다.

## 공개 API와 계약

CommonJS `index.js`에서 다음 API를 내보내세요. React hook과 컴포넌트는 실제 React로 구현합니다.
JSX 사용은 선택입니다. 현재 설정에서는 `React.createElement`를 사용할 수 있습니다.

`useProductList(fetchProducts)` → `{ items: [], total: 0, loading: false, error: null, conditions, setFilters, setPage, refresh }`.
최초 conditions는 `{ category: '', status: '', sort: 'name', page: 1 }`입니다.
`setFilters(partial)`은 category/status/sort를 병합하고 page를 1로 변경합니다. `setPage(page)`는 양의 정수를 받습니다.
`fetchProducts(conditions, { signal }?)`는 `{ items, total }` Promise를 반환합니다.
최초 마운트에서도 조회합니다. `refresh()`는 조건을 유지한 새 요청이며 같은 조건의 이전 요청도 무효화합니다.
새 요청과 실패 시 기존 items/total을 유지하고 새 요청은 error를 지웁니다.
`ProductList({ fetchProducts })`도 내보내세요. 목록과 total, loading, 오류 및 필터/페이지/새로고침 조작을 화면에 제공합니다.

## 제공 UI

`Category`(All/clothing/electronics), `Sale status`(All/sale/hidden), `Sort`(name/price) select와 `Next page`, `Refresh` 버튼을 제공합니다. `Page`, `Total` 표시, `Product items` 목록, role=status의 Loading/Idle 및 role=alert의 오류를 사용합니다. 테스트의 items는 문자열 배열입니다.

## 요구사항

1. 현재 필터 및 페이지 조건에 해당하는 응답만 화면에 반영한다.
2. 상품 목록과 총 상품 수는 반드시 동일한 API 응답에서 가져온다.
3. 필터나 정렬 기준이 변경되면 페이지 번호를 1로 초기화한다.
4. 이전 요청의 실패가 현재 목록의 오류 상태에 영향을 주지 않아야 한다.
5. 요청 중에는 현재 조회 조건에 대한 로딩 상태를 표시한다.
6. 현재 조건을 유지한 채 새로고침하면 새로운 API 요청을 수행한다.
7. 컴포넌트 언마운트 시 진행 중인 작업의 결과가 화면에 반영되지 않아야 한다.

## 원문의 모호한 부분에 대한 계약과 가정

- 주입 함수와 입력 참조는 테스트 중 안정적이며 주입 API는 동기 예외 없이 Promise를 반환합니다.
- 오류는 Error 객체이며 실패는 처리되지 않은 Promise 거부로 유출되면 안 됩니다.
- 취소를 지원하지 않는 API도 테스트합니다. 언마운트 시 대기 작업을 시작하거나 늦은 응답을 반영하지 않습니다.
- 사용자 콜백의 예외, 잘못된 입력, 스타일은 평가하지 않습니다. React StrictMode에서도 효과 정리가 안전해야 합니다.
- 구현 방식, 내부 자료구조, 상태 객체 동일성은 평가하지 않습니다.

## 실행

루트에서 `corepack pnpm@10 install --frozen-lockfile` 후:

```sh
npm test -- --runInBand --testPathPatterns="react/02. Product List/index.test.js"
```

제공 UI는 마운트되지만 hook은 초기 상태와 빈 동작만 반환합니다. 비동기 로직은 TODO이며 06번 작업 연결부는 Not implemented 오류를 던집니다. 구현 전 요구사항 assertion 실패는 정상이며 러너/모듈 오류와 구분하세요.

## 테스트 범위

`index.test.js`는 React DOM에서 마운트하고 수동 Promise 및 가상 타이머로 순서, 오류, 정리와 상태 전환을 관찰합니다.
실제 네트워크나 임의 sleep은 사용하지 않습니다. 원문의 번호와 테스트 이름을 함께 읽어 평가 범위를 확인하세요.
기본 UI와 hook 연결은 제공됩니다. 입력/버튼 조작과 화면의 목록·로딩·오류·진행률을 관찰하는 UI 테스트 및 hook 계약 테스트를 함께 실행합니다. 비동기 상태 전환·요청·스케줄링·정리는 직접 구현하세요.

`npm run react:browser` 후 http://127.0.0.1:8000 에서 Exercise를 선택해 미구현 UI도 볼 수 있습니다. 구현 후 Mock requests에서 JSON 응답을 편집하고 Resolve/Reject를 원하는 순서로 눌러 역순 응답과 실패를 재현하세요. 실제 서버는 필요하지 않습니다.
