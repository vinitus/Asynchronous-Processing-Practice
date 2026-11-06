const { createAuthenticatedClient } = require('./index');
const { deferred, turn, watch } = require('../testing/helpers.cjs');
const unauthorized = () => Object.assign(new Error('unauthorized'), { status: 401 });

function setup() {
  const sends = [], refreshes = [];
  const request = jest.fn((resource, token) => {
    const gate = deferred();
    sends.push({ resource, token, ...gate });
    return gate.promise;
  });
  const refreshToken = jest.fn(() => {
    const gate = deferred(); refreshes.push(gate); return gate.promise;
  });
  return { client: createAuthenticatedClient({ initialToken: 'old', request, refreshToken }), sends, refreshes, request, refreshToken };
}

test('06: successful initial response passes through without refresh', async () => {
  const { client, sends, refreshToken } = setup();
  const result = watch(client.request('profile'));
  await turn();
  expect(sends).toHaveLength(1);
  expect(sends[0].resource).toBe('profile');
  expect(sends[0].token).toBe('old');
  sends[0].resolve({ userId: 1 });
  await result.done;
  expect(result.value).toEqual({ userId: 1 });
  expect(refreshToken).not.toHaveBeenCalled();
});

test('06: five 401s share refresh, late joiner waits, all retry with new token', async () => {
  const { client, sends, refreshes, refreshToken } = setup();
  const results = Array.from({ length: 5 }, (_, i) => watch(client.request(`r${i}`)));
  await turn();
  expect(sends).toHaveLength(5);
  expect(sends.every((s) => s.token === 'old')).toBe(true);
  sends[0].reject(unauthorized());
  await turn();
  for (const s of sends.slice(1, 5)) s.reject(unauthorized());
  await turn();
  expect(refreshToken).toHaveBeenCalledTimes(1);
  expect(sends).toHaveLength(5);
  refreshes[0].resolve('new');
  await turn();
  expect(sends).toHaveLength(10);
  expect(sends.slice(5).map((s) => s.resource).sort()).toEqual(['r0', 'r1', 'r2', 'r3', 'r4']);
  for (const s of sends.slice(5)) { expect(s.token).toBe('new'); s.resolve(s.resource); }
  await Promise.all(results.map((r) => r.done));
  expect(results.map((r) => r.value)).toEqual(['r0', 'r1', 'r2', 'r3', 'r4']);
  // A later expiration must allow another refresh.
  const later = watch(client.request('later'));
  await turn();
  expect(sends[10].token).toBe('new');
  sends[10].reject(unauthorized());
  await turn();
  expect(refreshToken).toHaveBeenCalledTimes(2);
  refreshes[1].resolve('newer');
  await turn();
  expect(sends[11].token).toBe('newer');
  sends[11].resolve('ok');
  await later.done;
  expect(later.value).toBe('ok');
});

test('06: refresh rejection reaches every waiter and does not poison future refresh', async () => {
  const { client, sends, refreshes, refreshToken } = setup();
  const results = Array.from({ length: 5 }, (_, i) => watch(client.request(String(i))));
  await turn();
  sends.forEach((s) => s.reject(unauthorized()));
  await turn();
  expect(refreshToken).toHaveBeenCalledTimes(1);
  const failure = new Error('expired refresh token');
  refreshes[0].reject(failure);
  await Promise.all(results.map((r) => r.done));
  for (const r of results) {
    expect(r.status).toBe('rejected');
    expect(r.error.name).toBe('AuthenticationError');
    expect(r.error.cause).toBe(failure);
  }
  expect(sends).toHaveLength(5);
  const next = watch(client.request('next'));
  await turn();
  sends[5].reject(unauthorized());
  await turn();
  expect(refreshToken).toHaveBeenCalledTimes(2);
  refreshes[1].resolve('recovered');
  await turn();
  sends[6].resolve('ok');
  await next.done;
  expect(next.value).toBe('ok');
});

test('06: retry 401 stops after one retry', async () => {
  const { client, sends, refreshes, refreshToken } = setup();
  const result = watch(client.request('profile'));
  await turn(); sends[0].reject(unauthorized());
  await turn(); refreshes[0].resolve('new');
  await turn(); const error = unauthorized(); sends[1].reject(error);
  await turn();
  expect(result.status).toBe('rejected');
  expect(result.error).toBe(error);
  expect(sends).toHaveLength(2);
  expect(refreshToken).toHaveBeenCalledTimes(1);
});

test('06: non-authentication errors pass through without refresh', async () => {
  const { client, sends, refreshToken } = setup();
  const result = watch(client.request('profile'));
  await turn();
  const error = Object.assign(new Error('unavailable'), { status: 503 });
  sends[0].reject(error);
  await result.done;
  expect(result.error).toBe(error);
  expect(refreshToken).not.toHaveBeenCalled();
});

test.each(['resolve', 'reject'])('06: logout terminates all waiters before late refresh %s', async (outcome) => {
  const { client, sends, refreshes } = setup();
  const results = [watch(client.request('a')), watch(client.request('b'))];
  await turn(); sends.forEach((s) => s.reject(unauthorized()));
  await turn(); expect(refreshes).toHaveLength(1);
  client.logout();
  await turn();
  for (const r of results) {
    expect(r.status).toBe('rejected');
    expect(r.error.name).toBe('LoggedOutError');
  }
  refreshes[0][outcome](outcome === 'resolve' ? 'late' : new Error('late'));
  await turn();
  expect(sends).toHaveLength(2);
  const next = watch(client.request('after logout'));
  await next.done;
  expect(next.error.name).toBe('LoggedOutError');
  expect(sends).toHaveLength(2);
});
