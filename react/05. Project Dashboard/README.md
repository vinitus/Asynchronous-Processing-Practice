# React 문제 05. 프로젝트 모니터링 대시보드

원문: [react-problem.md](../../react-problem.md)의 문제 05. 정답을 포함하지 않는 연습 문제입니다.

## 공개 API와 계약

CommonJS `index.js`에서 다음 API를 내보내세요. React hook과 컴포넌트는 실제 React로 구현합니다.
JSX 사용은 선택입니다. 현재 설정에서는 `React.createElement`를 사용할 수 있습니다.

`useProjectDashboard(api)` → `{ projects: [], loading: false, error: null, summary: null }`.
api는 Promise를 반환하는 `listProjects()`, `deployment(id)`, `build(id)`, `incidents(id)`, `owner(id)`,
`failedLogs(id, build)`, `deploymentOwner(id, deployment, owner)`를 제공합니다. 각 호출의 마지막 선택 인수로 `{ signal }`을 전달할 수 있습니다.
목록은 `[{ id }]`, build 결과는 `{ status: 'success' | 'failed' }`입니다. 기타 성공 데이터의 형태는 자유입니다.
projects 항목은 `{ id, sections }`입니다. sections의 키는 deployment/build/incidents/owner/failedLogs/deploymentOwner이며
각 값은 `{ status: 'pending' | 'loading' | 'success' | 'error' | 'skipped', data, error }`입니다.
로그는 failed 빌드 성공 응답 뒤에만 호출합니다. deploymentOwner는 deployment와 owner 모두 성공한 뒤 호출합니다.
실행 불가능한 의존 작업은 skipped로 종료합니다. listProjects를 포함해 실제 미완료 Promise는 전역 최대 5개입니다.
목록 실패는 최상위 error에 저장하고 종료합니다. 부분 실패는 해당 section에 저장합니다.
모든 작업 종료 시 summary는 `{ success, failed, skipped }`이며 section 수를 셉니다. 성공한 빈 목록은 모두 0입니다.
`ProjectDashboard({ api })`는 프로젝트별 영역 상태/데이터/오류 및 종료 요약을 표시합니다.

## 요구사항

1. 접근 가능한 프로젝트 목록을 받은 뒤 프로젝트별 상세 요청을 실행한다.
2. 서로 의존하지 않는 상세 요청은 병렬로 실행한다.
3. 전체 API 요청 중 동시 실행 수는 최대 5개다.
4. 빌드가 성공한 프로젝트에 대해서는 실패 빌드 로그를 조회하지 않는다.
5. 빌드 조회가 실패한 경우 해당 빌드의 로그 조회를 실행하지 않는다.
6. 한 프로젝트의 일부 API가 실패해도 다른 프로젝트와 다른 정보 영역의 로딩은 계속된다.
7. 조회된 데이터와 오류 영역을 프로젝트별로 구분하여 화면에 표시한다.
8. 일부 영역이 실패하더라도 성공한 데이터는 화면에서 확인할 수 있어야 한다.
9. 전체 작업이 종료되면 성공·실패 현황을 요약하여 표시한다.
10. 컴포넌트 언마운트 시 대기 중인 작업은 시작하지 않고 이후 응답도 화면에 반영하지 않는다.

## 원문의 모호한 부분에 대한 계약과 가정

- 주입 함수와 입력 참조는 테스트 중 안정적이며 주입 API는 동기 예외 없이 Promise를 반환합니다.
- 오류는 Error 객체이며 실패는 처리되지 않은 Promise 거부로 유출되면 안 됩니다.
- 취소를 지원하지 않는 API도 테스트합니다. 언마운트 시 대기 작업을 시작하거나 늦은 응답을 반영하지 않습니다.
- 사용자 콜백의 예외, 잘못된 입력, 스타일은 평가하지 않습니다. React StrictMode에서도 효과 정리가 안전해야 합니다.
- 구현 방식, 내부 자료구조, 상태 객체 동일성은 평가하지 않습니다.

## 실행

루트에서 `corepack pnpm@10 install --frozen-lockfile` 후:

```sh
npm test -- --runInBand --testPathPatterns="react/05. Project Dashboard/index.test.js"
```

스켈레톤은 명시적으로 Not implemented 오류를 던집니다. 구현 전 assertion/미구현 오류는 정상이며 러너/모듈 오류와 구분하세요.

## 테스트 범위

`index.test.js`는 React DOM에서 마운트하고 수동 Promise 및 가상 타이머로 순서, 오류, 정리와 상태 전환을 관찰합니다.
실제 네트워크나 임의 sleep은 사용하지 않습니다. 원문의 번호와 테스트 이름을 함께 읽어 평가 범위를 확인하세요.
화면 컴포넌트에는 의미 있는 접근 가능한 목록/상태/오류 표시를 제공하세요.
