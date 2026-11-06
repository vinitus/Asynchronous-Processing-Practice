# 문제 08. 최대 N개를 병렬 실행하는 범용 요청 스케줄러

다수 차량의 상태를 조회할 때 실행 중 요청 수를 제한하는 `mapWithConcurrency`를 작성하세요. 특정 API에 종속되지 않는 유틸리티입니다.

## API

CommonJS export: `mapWithConcurrency(items, limit, mapper): Promise<Array>`.
`mapper(item, index)`는 해당 항목의 결과로 이행하거나 오류로 거부되는 Promise를 반환합니다.

## 요구사항

1. 실행 중인 mapper 수는 언제나 limit 이하입니다.
2. 결과 배열은 완료 순서와 관계없이 입력 순서와 일치합니다.
3. 빈 배열은 mapper 없이 빈 배열을 반환합니다.
4. `limit < 1`은 유효하지 않은 입력입니다.
5. 작업 실패는 호출자에게 전달합니다.
6. 실패를 확인한 후 새 작업을 시작하지 않습니다.
7. 이미 시작한 작업의 자동 취소를 가정하지 않습니다.

## 명시적 가정

- items는 배열, limit는 정수입니다. 1 미만이면 반환 Promise가 `RangeError`로 거부됩니다. 다른 잘못된 타입은 범위 밖입니다.
- mapper는 각 항목에 한 번 호출되고 입력 인덱스를 받습니다. 구체적 시작 순서와 슬롯 채우기 방식은 요구하지 않습니다.
- 하나가 실패하면 미완료 다른 작업을 기다리지 않고 전체 Promise를 원래 오류로 거부합니다. 이미 시작한 작업의 늦은 성공·실패는 추가 작업을 시작하지 않으며 처리되지 않은 거부를 만들지 않습니다.
- 동기 mapper 예외는 범위 밖입니다.

## 실행 및 테스트 근거

루트에서 `npm.cmd test -- --runInBand --testPathPatterns="08. Concurrency Limited Map/index.test.js"`.
수동 Promise로 동시 실행 상한·역순 완료·각 항목 1회·입력 인덱스(1·2와 API 가정), 빈 입력·잘못된 limit(3·4), 실패 및 늦은 결과(5–7)를 검증합니다. 특정 병렬화 전략은 요구하지 않습니다. 스켈레톤은 실패합니다.
