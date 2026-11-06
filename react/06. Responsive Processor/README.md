# React 문제 06. 로딩 상태는 `true`인데 스피너가 보이지 않는 화면

원문: [react-problem.md](../../react-problem.md)의 문제 06. 정답을 포함하지 않는 연습 문제입니다.

## 공개 API와 계약

CommonJS `index.js`에서 다음 API를 내보내세요. React hook과 컴포넌트는 실제 React로 구현합니다.
JSX 사용은 선택입니다. 현재 설정에서는 `React.createElement`를 사용할 수 있습니다.

`LargeDataProcessor({ createTask, input })` 컴포넌트를 내보내세요.
Start 버튼(접근 가능한 이름 `Start`), label이 `Notes`인 편집 입력, 작업 중 role=status의 `Processing`,
성공 시 role=status의 결과 문자열, 실패 시 role=alert의 오류 메시지를 표시합니다.
Start 클릭 뒤 로딩 UI를 커밋하고 브라우저의 paint 기회를 준 다음 `createTask(input)`을 호출합니다.
createTask는 `{ promise, cancel }`을 반환합니다. promise는 표시할 문자열로 이행합니다.
작업 중 Start는 비활성화하며 Notes는 계속 편집할 수 있어야 합니다. 언마운트 시 cancel()을 호출합니다.
`createProcessingTask(input)`도 내보내세요. input은 숫자 배열이고 결과는 합계의 문자열입니다.
이 연결부는 Worker 또는 타이머로 분할한 계산을 사용하여 긴 동기 루프와 microtask만으로 이어지는 루프를 피합니다.
cancel은 후속 실행 자원을 정리합니다. 취소 Promise의 이행/거부 방식은 자유입니다.
JSDOM은 실제 paint/CPU 응답성을 증명할 수 없으므로 아래 브라우저 검증도 필수입니다.

## 제공 UI

`Start`, `Notes`, role=status 및 오류 표시의 마크업은 제공됩니다. Start 동작과 작업 상태는 TODO입니다. Notes 편집은 UI 예제일 뿐 CPU 작업의 응답성 해법은 아닙니다.

## 요구사항

1. 작업 중 로딩 UI가 실제로 사용자에게 표시될 수 있도록 동작을 변경한다.
2. 작업이 진행되는 동안 긴 동기 계산이 메인 스레드를 계속 독점하지 않도록 한다.
3. 완료와 실패를 구분하여 결과 또는 오류를 표시하고 로딩 상태를 종료한다.
4. 사용자가 작업 중 화면을 떠난 경우 불필요한 실행 자원과 상태 반영을 정리한다.
5. 작업 중 사용자 입력에 대한 화면의 반응성을 유지한다.
6. 브라우저 환경에서 로딩 화면 및 사용자 반응성을 확인할 수 있어야 한다.

## 원문의 모호한 부분에 대한 계약과 가정

- 주입 함수와 입력 참조는 테스트 중 안정적이며 주입 API는 동기 예외 없이 Promise를 반환합니다.
- 오류는 Error 객체이며 실패는 처리되지 않은 Promise 거부로 유출되면 안 됩니다.
- 취소를 지원하지 않는 API도 테스트합니다. 언마운트 시 대기 작업을 시작하거나 늦은 응답을 반영하지 않습니다.
- 사용자 콜백의 예외, 잘못된 입력, 스타일은 평가하지 않습니다. React StrictMode에서도 효과 정리가 안전해야 합니다.
- 구현 방식, 내부 자료구조, 상태 객체 동일성은 평가하지 않습니다.

## 실행

루트에서 `corepack pnpm@10 install --frozen-lockfile` 후:

```sh
npm test -- --runInBand --testPathPatterns="react/06. Responsive Processor/index.test.js"
```

제공 UI는 마운트되지만 hook은 초기 상태와 빈 동작만 반환합니다. 비동기 로직은 TODO이며 06번 작업 연결부는 Not implemented 오류를 던집니다. 구현 전 요구사항 assertion 실패는 정상이며 러너/모듈 오류와 구분하세요.

## 테스트 범위

`index.test.js`는 React DOM에서 마운트하고 수동 Promise 및 가상 타이머로 순서, 오류, 정리와 상태 전환을 관찰합니다.
실제 네트워크나 임의 sleep은 사용하지 않습니다. 원문의 번호와 테스트 이름을 함께 읽어 평가 범위를 확인하세요.
기본 UI와 hook 연결은 제공됩니다. 입력/버튼 조작과 화면의 목록·로딩·오류·진행률을 관찰하는 UI 테스트 및 hook 계약 테스트를 함께 실행합니다. 비동기 상태 전환·요청·스케줄링·정리는 직접 구현하세요.

`npm run react:browser` 후 http://127.0.0.1:8000 에서 Exercise를 선택해 미구현 UI도 볼 수 있습니다. 구현 후 Mock requests에서 JSON 응답을 편집하고 Resolve/Reject를 원하는 순서로 눌러 역순 응답과 실패를 재현하세요. 실제 서버는 필요하지 않습니다.

## 브라우저 검증

React 개발 환경에서 컴포넌트를 마운트하고 createTask에 createProcessingTask를 전달하세요.
큰 숫자 배열(예: 5백만 항목)로 Start를 누르고 Processing 표시와 Notes 입력/스크롤 반응을 확인합니다.
DevTools Performance에서 계산 중 paint 및 입력 처리가 이어지는지 확인합니다. 완료 결과와 강제 실패를 각각 확인하고,
진행 중 언마운트 후 Worker/타이머가 남지 않는지 확인하세요. 자동 테스트 통과만으로 이 검증을 대체할 수 없습니다.
