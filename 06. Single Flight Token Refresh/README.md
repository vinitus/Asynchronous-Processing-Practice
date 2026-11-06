# 문제 06. 동시 401 응답과 Single Flight 토큰 갱신

대시보드의 동시 요청 다섯 개가 만료된 토큰으로 401을 받습니다. 토큰 갱신과 재전송을 관리하는 `createAuthenticatedClient`를 작성하세요.

## API

CommonJS export: `createAuthenticatedClient({ initialToken, request, refreshToken })`.
반환 객체는 `request(resource): Promise`와 `logout(): void`를 제공합니다.

- 주입 `request(resource, token)`은 응답으로 이행하거나 `Error`로 거부됩니다. 인증 오류의 `error.status`는 숫자 401입니다.
- 주입 `refreshToken()`은 새 토큰 문자열로 이행하거나 오류로 거부됩니다.
- client의 request는 최종 응답을 반환하고, API 오류는 원래 객체로 거부합니다.

## 요구사항

1. 갱신 진행 중 다른 인증 실패 요청은 같은 갱신 결과를 기다립니다.
2. 동시 다섯 401에도 갱신 함수는 한 번 실행됩니다.
3. 성공 시 새 토큰으로 각 원래 요청을 최대 한 번 재시도합니다.
4. 갱신 실패 시 모든 대기 요청이 인증 실패로 종료됩니다.
5. 갱신 완료 후 필요하면 새 갱신을 시작할 수 있습니다.
6. 실패한 갱신을 영구 공유하지 않습니다.
7. 재시도도 401이면 추가 갱신 없이 실패합니다.
8. 다른 API 오류로는 갱신하지 않습니다.
9. 로그아웃은 갱신 대기 요청을 종료합니다.

## 명시적 가정

- 갱신 실패는 `name === 'AuthenticationError'`, `cause === 원래 갱신 오류`인 오류로 거부합니다.
- 로그아웃 대기 요청 및 로그아웃 이후 요청은 `name === 'LoggedOutError'`로 거부합니다. 늦은 갱신 완료·실패로 재전송하거나 로그인 상태로 복구하지 않습니다.
- 갱신 중 시작한 새 요청의 최초 전송 정책은 평가하지 않습니다. 테스트의 401들은 해당 갱신이 끝나기 전에 도착합니다.
- 최초 토큰과 갱신된 토큰은 문자열입니다. 주입 API는 Promise를 반환하며 동기 예외는 범위 밖입니다.

## 실행 및 테스트 근거

루트에서 `npm.cmd test -- --runInBand --testPathPatterns="06. Single Flight Token Refresh/index.test.js"`.
수동 Promise로 다섯 요청의 401, 갱신 합류·성공·실패(1–4), 이후 갱신(5·6), 재시도 상한(7), 비인증 오류(8), 로그아웃과 늦은 결과(9)를 검증합니다. 임의 지연은 없습니다. 스켈레톤은 실패합니다.
