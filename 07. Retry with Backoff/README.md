# 문제 07. Retry Storm을 방지하는 범용 재시도 함수

일시적 API 오류를 재시도하되 동일 시각에 요청이 몰리지 않도록 지연을 적용하는 `retry`를 작성하세요. 특정 API나 화면에 종속되지 않아야 합니다.

## API

CommonJS export: `retry(operation, options): Promise`.

```js
// options: { maxAttempts, baseDelayMs, signal, random, sleep, shouldRetry }
// operation({ attempt, signal }) -> Promise<value>
// shouldRetry(error) -> boolean
// random() -> number in [0, 1)
// sleep(delayMs, signal) -> Promise<void>
```

## 요구사항

1. 최초 시도를 포함한 횟수가 `maxAttempts`를 초과하지 않습니다.
2. `shouldRetry`가 허용한 오류만 재시도합니다.
3. Exponential Backoff와 Jitter를 사용합니다.
4. `random`과 `sleep`을 주입하여 지연을 결정적으로 검증할 수 있어야 합니다.
5. 취소 신호로 진행 작업과 재시도 대기를 종료할 수 있어야 합니다.
6. 재시도 불가능 오류는 추가 호출 없이 전달합니다.
7. 부작용 요청의 중복 방지는 별도 서버 멱등성 계약이 필요합니다. 이 함수는 이를 보장하지 않습니다.
8. `Retry-After` 지원은 원문의 선택 확장으로, 필수 API 및 평가에 포함하지 않습니다.

## 모호함을 해소하는 가정

- 지연 공식은 full jitter로 고정합니다. 실패한 시도 번호가 `k` (최초=1)일 때 다음 시도 전 지연은 `baseDelayMs * 2 ** (k - 1) * random()`입니다. 반올림하지 않습니다.
- 테스트는 모든 옵션을 주입합니다. `maxAttempts`는 양의 정수, `baseDelayMs`는 0 이상입니다. 기본값·잘못된 입력 검증은 범위 밖입니다.
- 시도 번호는 1부터이며 주입 함수는 Promise를 반환합니다. 성공 결과와 최종 API 오류는 그대로 전달합니다.
- 호출 전 취소되었거나 실행·대기 중 취소되면 `name === 'AbortError'`로 거부합니다. 추가 시도를 하지 않으며 늦은 완료는 무시합니다.
- 같은 signal을 operation과 sleep에 전달합니다. 실제 외부 작업의 중단은 해당 함수가 signal을 지원해야 합니다. 지원하지 않는 작업도 retry의 호출자는 취소로 종료되어야 합니다.
- 성공·재시도 불가·횟수 소진 후에는 sleep하지 않습니다.

## 실행 및 테스트 근거

루트에서 `npm.cmd test -- --runInBand --testPathPatterns="07. Retry with Backoff/index.test.js"`.
테스트는 주입 난수와 수동 대기로 지연 공식(3·4와 가정), 횟수·성공·오류(1·2·6), 각 단계 취소 및 늦은 결과(5)를 검증합니다. 실시간 지연은 없습니다. 스켈레톤은 실패합니다.
