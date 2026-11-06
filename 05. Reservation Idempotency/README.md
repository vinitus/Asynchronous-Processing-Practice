# 문제 05. 예약 생성의 중복 실행 방지와 멱등성

예약 버튼 중복 클릭과 응답 유실 후 재시도로 같은 예약이 중복 생성되지 않도록 `createReservationAttemptManager`를 작성하세요. 다단계 결제는 범위 밖입니다.

## API

CommonJS export: `createReservationAttemptManager({ createReservation, createKey })`.
반환 객체는 `newAttempt(payload)`를 제공합니다. 반환된 시도 객체는 다음을 제공합니다.

- `key`: 이 논리적 시도의 idempotency key 문자열.
- `submit()`: `createReservation(payload, { idempotencyKey: key })`의 결과로 이행하거나 오류로 거부되는 Promise.
- `isPending()`: 현재 실제 요청 진행 여부.

`createKey()`는 호출마다 새로운 문자열을 반환하는 주입 함수입니다. `createReservation`은 Promise를 반환합니다.

## 요구사항

1. 같은 시도가 진행 중이면 중복 `submit()`으로 API 요청 수가 늘지 않습니다.
2. 성공·실패 후 진행 중 상태가 해제됩니다.
3. 하나의 논리적 시도에는 같은 key를 사용합니다.
4. 응답 유실·타임아웃 등 결과 불명 상태에서 재전송해도 key가 유지됩니다.
5. 새 시도는 새 key를 갖습니다.
6. key를 인식하는 서버 Mock에서 재전송해도 예약은 중복 생성되지 않아야 합니다.
7. 다른 브라우저나 서버 전체에 대한 중복 방지는 클라이언트만의 보장이 아닙니다. 서버의 멱등성 계약을 전제로 합니다.

## 명시적 가정

- 서로 다른 시도 객체는 독립적으로 전송할 수 있습니다. 시도 생성은 API 요청을 시작하지 않습니다.
- 중복 호출자 모두 해당 전송의 성공 데이터 또는 원래 오류를 받습니다. Promise 동일성은 요구하지 않습니다.
- `submit()` 직후 `isPending()`은 true이며 완료 후 false입니다. 성공 후 명시적으로 다시 submit해도 같은 key로 새 전송합니다.
- API와 key 생성기의 입력 검증, 동기 예외, key 충돌은 범위 밖입니다.

## 실행 및 테스트 근거

루트에서 `npm.cmd test -- --runInBand --testPathPatterns="05. Reservation Idempotency/index.test.js"`.
수동 Promise 테스트는 요구사항 1–5와 중복 호출자 계약을 검증합니다. 서버 Mock 테스트는 서버 기록 후 응답 유실, 같은 key 재전송, 새 시도 생성(4–7)을 검증합니다. 실제 시간·네트워크를 사용하지 않습니다. 스켈레톤 상태에서는 실패합니다.
