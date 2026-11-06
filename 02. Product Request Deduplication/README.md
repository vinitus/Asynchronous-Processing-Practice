# 문제 02. 상품 정보 중복 요청 병합

상품 화면의 여러 영역이 같은 상품을 동시에 조회합니다. 진행 중인 동일 상품 요청을 공유하는 `createRequestDeduplicator`를 작성하세요.

## API

CommonJS export: `createRequestDeduplicator(fetchProduct)`.
반환 객체의 `request(productId)`는 상품 데이터로 이행하거나 API 오류로 거부되는 Promise를 반환합니다. 주입 함수 `fetchProduct(productId)`는 Promise를 반환합니다.

## 요구사항

1. 동일 ID의 요청이 진행 중이면 API 요청을 추가하지 않습니다.
2. 기다리는 모든 호출자는 같은 성공 데이터를 받습니다.
3. 서로 다른 ID는 독립적으로 요청할 수 있습니다.
4. 공유 요청 실패는 모든 대기 호출자에게 전달됩니다.
5. 실패 완료 후 동일 ID를 다시 요청할 수 있습니다.
6. 완료된 성공 결과도 영구 캐싱하지 않습니다.

## 명시적 가정

- ID는 비어 있지 않은 문자열입니다. 입력 검증은 범위 밖입니다.
- 완료 이후의 다음 호출은 새 API 요청입니다. 오류는 원래 오류 객체로 전달합니다.
- API는 동기 예외 없이 Promise를 반환합니다. 반환 Promise 자체의 동일성은 요구하지 않습니다.

## 실행 및 테스트 근거

루트에서 `npm.cmd test -- --runInBand --testPathPatterns="02. Product Request Deduplication/index.test.js"` (`npm test`도 가능).
기존 Jest를 사용합니다. 스켈레톤 상태에서는 실패합니다.
테스트는 제어 가능한 Promise로 동일 ID 공유(1·2), ID별 독립성(3), 실패 전파와 재요청(4·5), 성공 후 재요청(6)을 검증합니다. 시간·네트워크에 의존하지 않습니다.
