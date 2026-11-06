# React 비동기 연습 문제

[원문](../react-problem.md)의 여섯 문제를 각각 README, 미구현 `index.js`, 실행 가능한 Jest 테스트로 구성했습니다.
기존 루트의 JavaScript 01–12번과 별도로 번호를 매깁니다. 정답은 포함하지 않습니다.

| 번호 | 문제 | 구현 대상 |
| --- | --- | --- |
| 01 | [Effect Race Condition](./01.%20Effect%20Race%20Condition/README.md) | useCarSearch |
| 02 | [Product List](./02.%20Product%20List/README.md) | useProductList, ProductList |
| 03 | [Upload Manager](./03.%20Upload%20Manager/README.md) | useUploadManager, UploadList |
| 04 | [Delivery Polling](./04.%20Delivery%20Polling/README.md) | useDeliveryPolling, DeliveryStatus |
| 05 | [Project Dashboard](./05.%20Project%20Dashboard/README.md) | useProjectDashboard, ProjectDashboard |
| 06 | [Responsive Processor](./06.%20Responsive%20Processor/README.md) | LargeDataProcessor, createProcessingTask |

Node 24.11 이상에서 `corepack pnpm@10 install --frozen-lockfile`로 의존성을 설치하세요.

```sh
npm run test:react -- --runInBand
npm test -- --runInBand --testPathPatterns=testing/react-harness.test.js
```

첫 명령은 미구현 스켈레톤 때문에 실패하는 것이 정상입니다. 두 번째는 React DOM/Promise/가상 타이머 테스트 환경 자체를 검증하며 통과해야 합니다.
각 문제만 실행하는 명령은 개별 README에 있습니다. JSX 변환 설정은 추가하지 않았으므로 현재는 CommonJS와 React.createElement를 사용하세요.

06번 구현 후 `npm run react:browser`로 브라우저 데모를 열 수 있습니다. http://127.0.0.1:8000 에서 Start를 누르고
Processing 표시, Notes 입력, Mount / Unmount를 확인하세요. 5백만 항목의 기대 결과는 `247500000`입니다.
실패 UI는 createTask를 거부하는 테스트 함수로 교체하여 검증할 수 있습니다.
JSDOM은 실제 paint나 CPU 사용량을 검증하지 않으므로 06번 README의 브라우저 체크리스트를 함께 수행해야 합니다.
Worker를 선택하면 Worker가 없는 JSDOM에서는 타이머 분할 대체 동작을 제공하세요.

테스트는 요청 순서를 정해놓지 않고 실제 호출과 완료를 관찰합니다. StrictMode 효과 재실행에 안전한 정리를 구현하세요.
