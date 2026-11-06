# 문제 09. Microtask Starvation 없이 대량 항목 처리

10만 개 항목을 순서대로 처리하면서 다른 작업에 실행 기회를 제공하는 `processItems`를 작성하세요. `queueMicrotask`로 자기 자신을 무한 등록하는 원문의 예시를 실행하지 마세요.

## API

CommonJS export: `processItems(items, visit, { batchSize, yieldControl }): Promise<void>`.

- `visit(item, index)`는 항목을 처리하는 동기 콜백입니다.
- `yieldControl()`은 외부 실행 기회를 제공하고 다시 진행해도 될 때 이행하는 Promise를 반환합니다. 테스트에서는 이를 주입합니다.

## 요구사항

1. 항목 10만 개 각각을 입력 순서대로 정확히 한 번 처리합니다.
2. 일정 항목 수마다 외부로 실행 기회를 양보합니다.
3. 양보 함수를 주입하여 호출 횟수와 처리 순서를 검증할 수 있어야 합니다.
4. 무한 마이크로태스크 반복을 만들지 않고 유한 입력 처리를 완료합니다.
5. `scheduler.yield()` 및 미지원 환경의 대체 동작은 원문의 선택 확장입니다. 필수 평가에서는 양보 함수를 주입합니다.

## 명시적 가정

- batchSize는 양의 정수입니다. 양보는 정확히 batchSize개 처리 후 남은 항목이 있을 때만 수행합니다. 마지막 항목 뒤와 빈 입력에서는 양보하지 않습니다.
- 양보 Promise가 완료되기 전에는 다음 항목을 처리하지 않습니다. 전체 처리가 끝나면 undefined로 이행합니다.
- visit의 예외, 비동기 visit, 잘못된 입력은 범위 밖입니다. 실제 스케줄러 선택은 강제하지 않습니다. 주입 양보 함수가 외부 태스크 기회를 제공한다는 계약을 사용합니다.

## 실행 및 테스트 근거

루트에서 `npm.cmd test -- --runInBand --testPathPatterns="09. Cooperative Item Processing/index.test.js"`.
대량 입력·순서·유한 종료(1·4), 양보 중 진행 차단(2·3), 빈 입력·배치 경계·나머지(배치 가정)를 검증합니다. 외부 실행 기회는 Node 이벤트 루프 및 수동 Promise로 제어하며 실제 시간 측정은 하지 않습니다. 스켈레톤은 실패합니다.
