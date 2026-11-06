# 문제 10. 대용량 계산의 Web Worker 분리

10만 건의 데이터 계산을 Worker에서 수행하고 메인 영역에서 생성·통신·종료를 관리하는 `createWorkerProcessor`와 Worker 진입 모듈을 작성하세요. 함수에 async만 붙여 메인 영역에서 계산하는 것은 요구사항을 충족하지 않습니다.

## API와 메시지 계약

CommonJS export (`index.js`): `createWorkerProcessor({ createWorker })`.
반환 객체는 `process(data, { signal } = {}): Promise<number>` 및 `dispose(): void`를 제공합니다.

- `createWorker()`는 Web Worker와 같은 `postMessage`, `terminate`, `addEventListener`, `removeEventListener`, `onmessage`, `onerror` 인터페이스를 갖는 Worker를 반환합니다. 리스너 등록 방식은 자유입니다.
- 요청 메시지: `{ data }`. data는 숫자 배열입니다.
- 성공 메시지: `{ type: 'success', result: number }`.
- 계산 실패 메시지: `{ type: 'error', message: string }`. 호출자는 해당 message의 Error를 받습니다.
- Worker의 error 이벤트는 `event.error`의 Error로 호출자에게 전달합니다.
- `worker.js`는 브라우저 Worker 진입 스크립트이며 전역 `self`에서 메시지를 받아 응답합니다. CommonJS export는 필요하지 않습니다.

## 요구사항

1. 메인 영역에서 Worker를 생성하고 데이터를 전달합니다.
2. 실제 계산은 Worker 내부에서 실행합니다.
3. 성공 메시지로 계산 결과를 반환합니다.
4. Worker 계산 오류와 실행 오류를 호출자에게 전달합니다.
5. 취소·종료 시 Worker 리소스를 정리합니다.
6. 취소 이후의 메시지는 결과로 반영하지 않습니다.
7. 큰 데이터의 전달 비용을 고려해야 합니다. 입력 전달은 작업당 한 번이며 임의의 추가 메시지를 요구하지 않습니다.
8. ArrayBuffer Transferable은 원문의 선택 확장으로 필수 평가에 포함하지 않습니다.

## 원문의 모호함에 대한 가정

- 원문에 계산식이 없어 계산은 **숫자들의 제곱합**으로 정합니다. 빈 배열 결과는 0입니다. 테스트 데이터는 안전한 정수 범위입니다. 특정 계산 알고리즘은 요구하지 않습니다.
- 프로세서 한 개당 process 한 번만 호출합니다. 동시 작업·재사용 정책은 범위 밖입니다.
- 성공·실패·취소·dispose 시 생성된 Worker를 terminate합니다. 리스너 관리 방식은 자유이며 시작 전 취소에는 Worker를 생성하지 않습니다.
- 취소는 `name === 'AbortError'`, 진행 중 dispose는 `name === 'DisposedError'`로 거부하며, 응답을 기다리지 않고 종료합니다. 늦은 메시지·오류는 무시합니다.
- 입력 오류, createWorker 자체의 동기 예외, 반복 dispose는 범위 밖입니다.

## 실행 및 테스트 근거

루트에서 `npm.cmd test -- --runInBand --testPathPatterns="10. Worker Data Processor/index.test.js"`.
제어 가능한 Worker Mock은 생성·단일 데이터 전달·응답·두 오류 경로·정리·취소 후 늦은 메시지(1·3–7 및 가정)를 검증합니다. 별도 Node Worker의 Web Worker 호환 테스트 어댑터로 실제 worker.js를 실행하여 빈 입력과 10만 건 계산을 확인합니다(2 및 계산 가정). 테스트 어댑터는 메시지 전달만 담당하며 계산은 하지 않습니다.
스켈레톤에는 Worker 계산 구현도 없으므로 테스트가 실패합니다.
