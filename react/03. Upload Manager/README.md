# React 문제 03. 다중 이미지 업로드 UI 관리자

원문: [react-problem.md](../../react-problem.md)의 문제 03. 정답을 포함하지 않는 연습 문제입니다.

## 공개 API와 계약

CommonJS `index.js`에서 다음 API를 내보내세요. React hook과 컴포넌트는 실제 React로 구현합니다.
JSX 사용은 선택입니다. 현재 설정에서는 `React.createElement`를 사용할 수 있습니다.

`useUploadManager(upload)` → `{ files: [], summary, addFiles, cancel }`.
`addFiles([{ id, file }])`는 ID별로 한 번만 등록합니다. `cancel(id)`는 해당 파일을 취소합니다.
files 항목은 `{ id, status, progress, attempts, result, error }`이며 status는 queued/uploading/success/failed/cancelled입니다.
progress는 0–100, attempts는 실제 호출 횟수입니다. summary는 각 status의 개수와 total을 가집니다.
`upload(file, { signal, onProgress })`는 결과 Promise를 반환합니다. signal은 AbortSignal이며 진행률 콜백은 0–100을 받습니다.
`error.retryable === true`인 실패만 최대 2회 즉시 재시도합니다. 이외 실패는 즉시 failed입니다.
취소 즉시 cancelled를 표시하되 실제 Promise가 종료될 때까지 동시 실행 슬롯을 점유합니다. 취소 후 재시도와 진행률 갱신은 금지합니다.
성공은 progress=100, result를 저장합니다. 취소/실패 progress는 마지막 값을 유지합니다.
`UploadList({ upload })`의 파일 입력은 label `Files`를 가지며 선택한 File의 name을 id로 사용합니다.
`UploadList({ upload })`는 hook과 연결한 목록, 파일 추가/취소 조작, 파일별 상태/진행률과 summary를 제공합니다.

## 요구사항

1. 동시에 실행되는 실제 업로드 요청은 최대 3개다.
2. 실행 중인 업로드가 종료되면 대기 중인 다음 파일을 업로드한다.
3. 네트워크 오류로 실패한 파일은 최대 2회 추가 재시도한다.
4. 재시도 횟수를 초과한 파일은 실패 상태로 표시한다.
5. 특정 파일이 실패해도 다른 파일은 계속 업로드한다.
6. 사용자는 대기 중이거나 진행 중인 파일을 개별적으로 취소할 수 있다.
7. 이미 완료된 파일을 중복 업로드하지 않는다.
8. 파일별 진행률과 전체 업로드 현황이 실제 작업 상태와 일치해야 한다.
9. 컴포넌트 언마운트 후 완료되거나 실패한 요청은 화면 상태를 갱신하지 않아야 한다.

## 원문의 모호한 부분에 대한 계약과 가정

- 주입 함수와 입력 참조는 테스트 중 안정적이며 주입 API는 동기 예외 없이 Promise를 반환합니다.
- 오류는 Error 객체이며 실패는 처리되지 않은 Promise 거부로 유출되면 안 됩니다.
- 취소를 지원하지 않는 API도 테스트합니다. 언마운트 시 대기 작업을 시작하거나 늦은 응답을 반영하지 않습니다.
- 사용자 콜백의 예외, 잘못된 입력, 스타일은 평가하지 않습니다. React StrictMode에서도 효과 정리가 안전해야 합니다.
- 구현 방식, 내부 자료구조, 상태 객체 동일성은 평가하지 않습니다.

## 실행

루트에서 `corepack pnpm@10 install --frozen-lockfile` 후:

```sh
npm test -- --runInBand --testPathPatterns="react/03. Upload Manager/index.test.js"
```

스켈레톤은 명시적으로 Not implemented 오류를 던집니다. 구현 전 assertion/미구현 오류는 정상이며 러너/모듈 오류와 구분하세요.

## 테스트 범위

`index.test.js`는 React DOM에서 마운트하고 수동 Promise 및 가상 타이머로 순서, 오류, 정리와 상태 전환을 관찰합니다.
실제 네트워크나 임의 sleep은 사용하지 않습니다. 원문의 번호와 테스트 이름을 함께 읽어 평가 범위를 확인하세요.
화면 컴포넌트에는 의미 있는 접근 가능한 목록/상태/오류 표시를 제공하세요.
