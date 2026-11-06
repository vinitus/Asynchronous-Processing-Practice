# 문제 11. 쇼핑몰 결제 금액 계산 엔진

장바구니·재고·회원 등급·적립금·배송·프로모션·쿠폰을 조회하여 가능한 금액과 결제 가능 여부를 반환하는 `calculateCheckout`을 작성하세요.

## API

CommonJS export: `calculateCheckout(input, api): Promise<result>`.
api에는 아래 이름의 Promise 반환 함수가 있습니다. A는 input을 받고, 나머지는 **직접 선행 결과만** 담은 객체를 받습니다.

| 이름 | 작업 | 직접 선행 결과 | 성공 데이터 |
| --- | --- | --- | --- |
| A | 장바구니 | 없음 | `{ subtotal: number }` |
| B1 | 재고 | A | 객체 |
| B2 | 회원 등급 | A | 객체 |
| B3 | 배송 옵션 | A | 객체 |
| B4 | 프로모션 | A | 객체 |
| C | 적립금 | B2 | `{ amount: number }` |
| D1 | 쿠폰 조회 | B1, B4 | 객체 |
| D2 | 배송비 계산 | B1, B3 | number |
| D3 | 쿠폰 제한 | B4 | 객체 |
| E | 쿠폰 검증 | D1, D3 | `{ discount: number }` |

예를 들어 D1은 `api.D1({ B1: B1의 성공 데이터, B4: B4의 성공 데이터 })`로 호출합니다.

반환 형태:

```js
{
  nodes: { /* A, B1, B2, B3, B4, C, D1, D2, D3, E */ },
  amounts: { subtotal: null, shipping: null, discount: 0, points: 0, total: null },
  canPay: false
}
// 각 nodes 항목:
// { status: 'success', value: API 데이터 }
// { status: 'failure', error: 원래 오류 }
// { status: 'skipped' }
```

## 요구사항

1. 서로 독립적인 요청은 다른 작업의 완료를 기다리지 않고 병렬로 시작합니다.
2. 직접 선행 결과가 모두 성공한 후에만 후속 요청을 시작합니다.
3. 회원 등급 실패 시 적립금 조회를 실행하지 않습니다.
4. 쿠폰 조회 실패는 배송비 계산을 막지 않습니다.
5. 재고 실패 시 이를 필요로 하는 후속 작업을 실행하지 않습니다.
6. 쿠폰 검증 실패 시 쿠폰 없는 견적을 반환합니다.
7. 배송비 계산 실패 시 결제 가능으로 처리하지 않습니다.
8. 요청별 성공·실패·미실행을 구분합니다.
9. 최종 결과에 계산 가능한 금액과 결제 진행 가능 여부를 포함합니다.

## 모호한 금액 정책과 실패 처리에 대한 가정

- API 이름·인수·상태 형태는 실행 가능한 계약을 위해 정했습니다. 모든 API는 동기 예외 없이 Promise를 반환합니다.
- 전체 함수는 개별 API 실패에도 거부하지 않고, 실행 가능한 모든 작업이 끝난 후 결과로 이행합니다. 선행 실패의 모든 후손은 skipped입니다.
- subtotal은 A 성공 데이터의 subtotal 필드, shipping은 D2 성공 데이터입니다. 미확정 값은 null입니다.
- points는 C 성공 시 amount, 그 외 0입니다. discount는 E 성공 시 discount, 그 외 0입니다.
- A·B1·D2 성공이면 canPay=true입니다. 다른 실패는 적립금/쿠폰 없는 견적을 허용합니다.
- total은 canPay일 때 `subtotal + shipping - points - discount`, 그 외 null입니다. 사용 데이터는 반올림이 필요 없는 정수이며 points+discount가 subtotal을 초과하지 않습니다.
- API 성공 객체의 업무 유효성 검사나 재시도는 범위 밖입니다. 각 작업은 한 번만 호출합니다.

## 실행 및 테스트 근거

루트에서 `npm.cmd test -- --runInBand --testPathPatterns="11. Checkout Calculation/index.test.js"`.
수동 Promise 테스트는 각 선행 경계·불필요한 전체 대기 금지(1·2), 모든 노드별 단일 실패와 후손 미실행(3–8), 완전 성공 및 금액 정책(9와 가정)을 검증합니다. 오류 객체도 보존되는지 확인합니다. 시간·네트워크 의존은 없고 스켈레톤은 실패합니다.
