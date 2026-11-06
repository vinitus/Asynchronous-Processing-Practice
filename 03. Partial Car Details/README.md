# 문제 03. 일부 API가 실패해도 정보를 유지하는 차량 상세 조회

차량·보험료·할인을 독립 API에서 조회합니다. 일부 실패가 다른 성공 데이터를 지우지 않도록 `loadCarDetails`를 작성하세요.

## API

CommonJS export: `loadCarDetails(carId, { car, insurance, discount })`.
각 주입 함수는 `(carId)`를 받아 데이터로 이행하거나 오류로 거부되는 Promise를 반환합니다.
반환 Promise는 모든 API가 완료되면 다음 객체로 이행합니다.

```js
{ car: null, insurance: null, discount: null, canReserve: false, errors: [] }
```

## 요구사항

1. 독립적인 세 조회를 다른 조회의 완료를 기다리지 않고 시작합니다.
2. 차량 실패는 `errors`의 `'car'`로 식별됩니다.
3. 보험료 실패 시 차량 데이터를 유지하되 예약은 불가능합니다.
4. 할인 실패 시 차량·보험료를 유지하고 할인 오류를 기록합니다.
5. 성공 데이터는 해당 필드에, 실패는 해당 필드의 `null`과 `errors` 이름으로 구별됩니다.
6. 하나가 실패해도 시작된 다른 API들의 결과를 포함합니다.

## 명시적 가정

- 차량과 보험료가 모두 성공하면 예약 가능하며 할인은 선택 정보입니다.
- `errors`에는 실패한 이름만 한 번씩 포함하며 순서는 자유입니다.
- API는 동기 예외 없이 Promise를 반환하며 성공 데이터는 `null`이 아닙니다. 입력 검증은 범위 밖입니다.
- 개별 API 거부로 전체 함수가 거부되지 않습니다.

## 실행 및 테스트 근거

루트에서 `npm.cmd test -- --runInBand --testPathPatterns="03. Partial Car Details/index.test.js"`.
Jest와 수동 완료 Promise로 전체 8가지 성공/실패 조합(요구사항 2–6, 예약 가정), 선행 실패 후 다른 결과 보존 및 동시 시작(1·6)을 검증합니다. 스켈레톤은 실패합니다.
