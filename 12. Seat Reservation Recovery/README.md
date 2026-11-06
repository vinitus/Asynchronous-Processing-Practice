# 문제 12. 공연 좌석 예약 및 결제의 다단계 실패 복구

공연 조회부터 좌석 선점, 주문, 결제, 예약 확정까지의 의존성과 실패 복구를 관리하는 `createReservationManager`를 작성하세요. 중복 클릭과 idempotency key 관리는 문제 05의 범위입니다.

## API

CommonJS export: `createReservationManager(api)`.
반환 객체: `run(input): Promise<result>`, `cancel(): void`.
한 manager에서 run은 한 번만 호출합니다. api의 각 함수는 Promise를 반환합니다.

| api 이름 / 실패 단계 이름 | 작업 | 인수 | 성공 데이터 |
| --- | --- | --- | --- |
| show | 공연 조회 | input | 공연 객체 |
| seat | 좌석 상태 | `{ show }` | `{ available: boolean }` |
| eligibility | 예매 자격 | `{ show }` | `{ eligible: boolean }` |
| pricing | 가격 정책 | `{ show }` | 가격 정책 객체 |
| hold | 좌석 선점 | `{ seat, eligibility }` | 선점 객체 |
| amount | 금액 계산 | `{ eligibility, pricing }` | 금액 객체 |
| order | 주문 생성 | `{ hold, amount }` | 주문 객체 |
| payment | 결제 승인 | `{ order }` | 결제 객체 |
| confirm | 예약 확정 | `{ hold, payment }` | 확정 객체 |
| release | 선점 해제 | `{ hold }` | 해제 결과 (값은 사용하지 않음) |

객체 필드에는 해당 API의 성공 데이터를 전달합니다. 결제 승인 성공만 confirm으로 이어지고, 승인 실패는 release로 이어집니다.

```js
// run의 결과
{
  success: false,
  payment: 'not_started', // 'not_started' | 'failed' | 'paid'
  hold: 'none',          // 'none' | 'held' | 'released' | 'confirmed' | 'release_failed'
  failedStage: null,     // 위 표의 단계 이름 | 'cancelled' | null
  recovery: 'not_needed',// 'not_needed' | 'released' | 'failed'
  cancelled: false
}
```

## 요구사항

1. 선행 결과가 충족되기 전에 후속 요청을 실행하지 않습니다.
2. 공연 조회 후 좌석·자격·가격 정책 조회는 병렬입니다. 선점과 금액 계산도 각 선행 결과가 준비되면 다른 가지를 기다리지 않습니다.
3. 자격이 없는 사용자는 선점할 수 없습니다.
4. 선점 실패 시 주문을 생성하지 않습니다.
5. 주문 생성 실패 시 선점한 좌석을 해제합니다.
6. 결제 승인 실패 시 선점한 좌석을 해제합니다.
7. 해제 실패는 별도 복구 실패 상태로 기록합니다.
8. 결제 성공 후 확정 실패는 결제 실패와 구별합니다.
9. 중간 취소는 현재 단계에 맞는 필요한 작업만 수행합니다.
10. 예약 성공 여부, 결제 상태, 선점 상태, 실패 단계와 복구 결과를 반환합니다.

## 원문의 모호함을 해소한 가정

- 단일 API 실패로 전체 Promise를 거부하지 않고 위 결과를 반환합니다. 입력 검증·동기 API 예외·동시 복수 실패 우선순위는 범위 밖입니다.
- available=false는 seat 단계 실패, eligible=false는 eligibility 단계 실패입니다. 자격 실패 시 amount도 실행하지 않습니다.
- 선점 후 pricing 또는 amount 실패도 좌석을 해제합니다. 실패를 알기 전에 시작된 선점이 나중에 성공하면 그 좌석도 해제합니다. 부작용 없는 이미 시작한 조회는 완료될 수 있습니다.
- 실패/취소 판정 뒤에는 새 주문·결제·확정을 시작하지 않습니다. 실패로 더 이상 필요한 작업이 없다면 미실행 작업을 호출하지 않습니다.
- 취소가 **결제 시작 전** 요청되면 cancelled=true, failedStage='cancelled'입니다. 시작한 선점·주문 요청은 완료를 확인한 후 필요하면 해제합니다. 선점 전이면 해제를 호출하지 않습니다. 아직 시작하지 않은 후속 요청은 하지 않습니다.
- 결제가 이미 시작된 후의 cancel은 수락하지 않습니다(cancelled=false). 승인 결과를 확인하고 성공이면 확정, 실패면 해제합니다. 결제 성공 후에는 자동 해제·환불하지 않습니다. 환불 API는 원문에 없으므로 범위 밖입니다.
- 확정 실패 시 payment='paid', hold='held', failedStage='confirm', recovery='not_needed'입니다. 운영 후속 처리는 범위 밖입니다.
- release 실패 시 원래 실패 단계(또는 cancelled)를 유지하고 hold='release_failed', recovery='failed'로 표시합니다.
- 성공 시 success=true, payment='paid', hold='confirmed', failedStage=null입니다. 선점/결제가 시작되지 않았다면 각각 none/not_started입니다.
- 시작한 API는 테스트에서 반드시 완료시킵니다. 종료를 위해 이 API들의 완료를 기다려도 됩니다. 각 요청 및 복구는 한 번만 실행합니다.

## 실행 및 테스트 근거

루트에서 `npm.cmd test -- --runInBand --testPathPatterns="12. Seat Reservation Recovery/index.test.js"`.
테스트는 수동 Promise로 의존성·독립 가지 진행·성공 인수 전달(1·2·10), 각 API의 실패·자격/좌석 불가(3–8), 선점 전/중/후·주문 중·결제 중 취소와 늦은 결과(9 및 취소 가정)를 검증합니다. 원래 실패와 해제 실패를 함께 관찰합니다. 실제 네트워크나 임의 시간 지연은 없습니다. 스켈레톤은 실패합니다.
