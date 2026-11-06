# JavaScript 문제 테스트 실행

01–12번은 `js-problem.md`의 순서와 번호를 따릅니다. 기존 01번 파일은 보존했습니다. 각 문제 폴더의 README.md에 API, 원문 요구사항, 모호함을 해소한 가정 및 테스트 근거가 있습니다.

프로젝트 루트에서 기존 잠금 파일에 맞춰 `pnpm install`을 실행한 뒤:

```sh
npm test -- --runInBand
```

Windows PowerShell 실행 정책으로 npm.ps1이 차단되는 경우:

```powershell
npm.cmd test -- --runInBand
```

문제 하나만 실행하는 명령은 해당 README에 있습니다. Jest 설정은 루트의 `jest.config.cjs`를 사용하며 TypeScript 테스트 검색도 유지합니다.

`helpers.cjs`는 수동 Promise, 이벤트 루프 차례 대기, Promise 결과 관찰, 주입 API Mock만 제공합니다. 운영 로직이나 정답 구현은 포함하지 않습니다. 비동기 테스트는 요청 완료를 직접 제어하며 임의 sleep, 실제 네트워크, 난수 또는 실행 시간 측정에 의존하지 않습니다. Worker 진입 스크립트 테스트는 별도 실제 스레드를 사용하며 테스트가 끝나면 종료합니다.

제공된 모든 index.js와 worker.js는 미구현 스켈레톤입니다. 구현하기 전에는 테스트가 실패해야 합니다. 테스트 러너의 제한 시간은 무한 대기 감지용이며 문제의 성능 제한이 아닙니다.

원문에서 선택 확장으로 제시한 Retry-After(07), scheduler.yield 및 환경별 대체 동작(09), Transferable ArrayBuffer(10)는 필수 테스트에 포함하지 않습니다.

React 문제는 [react/README.md](../react/README.md)를 참고하세요. `npm run test:react -- --runInBand`로 별도 실행할 수 있습니다.
