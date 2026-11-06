# 문제 04. Event Loop 출력 순서 예측

아래 코드의 출력 순서와 각 출력의 실행 종류를 예측하는 `predictEventLoopOrder()`를 작성하세요.

```js
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => console.log('C'));
queueMicrotask(() => console.log('D'));
(async () => {
  console.log('E');
  await null;
  console.log('F');
})();
console.log('G');
```

## API 및 요구사항

CommonJS로 `predictEventLoopOrder`를 내보냅니다. 인수 없이 호출하면 출력 순서대로 `{ label, kind }` 객체의 배열을 반환합니다.

- 각 출력 A–G를 정확히 한 번 포함합니다.
- `kind`는 `'sync'`, `'microtask'`, `'timer'` 중 하나입니다.
- `setTimeout(..., 0)`은 즉시 실행으로 취급하지 않습니다.
- `await null` 이후의 실행 순서도 반영합니다.

반환 객체 형태와 종류 문자열은 분류 결과를 관찰하기 위한 명시적 가정입니다. 함수는 동기 배열 또는 그 배열로 이행하는 Promise를 반환해도 됩니다. 전역 콘솔을 변경하는 동작은 필요하지 않습니다.

## 실행 및 테스트 근거

루트에서 `npm.cmd test -- --runInBand --testPathPatterns="04. Event Loop Order/index.test.js"`.
테스트는 원문 코드의 출력을 수집하여 예측과 비교합니다. Node의 실행 문맥 관찰 기능으로 실행 종류를 수집하며, 출력별 정답 분류를 소스에 적지 않습니다. 원문의 타이머 완료를 직접 기다리고 경과 시간은 평가하지 않습니다. 비교 실패 시에도 기대 출력 순서와 분류를 나열하지 않습니다. 결과 예시나 정답 구현은 제공하지 않습니다. 스켈레톤 상태에서는 실패합니다.
