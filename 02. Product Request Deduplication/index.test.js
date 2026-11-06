const { createRequestDeduplicator } = require('./index');
const { deferred, turn, watch } = require('../testing/helpers.cjs');

test('02: shares pending work, preserves ID independence and input', async () => {
  const a = deferred(), b = deferred();
  const api = jest.fn((id) => ({ a, b })[id].promise);
  const client = createRequestDeduplicator(api);
  const calls = [watch(client.request('a')), watch(client.request('a')), watch(client.request('b'))];
  await turn();
  expect(api.mock.calls.map((args) => args[0]).sort()).toEqual(['a', 'b']);
  b.resolve({ id: 'b' });
  await turn();
  expect(calls[2].value).toEqual({ id: 'b' });
  expect(calls[0].status).toBe('pending');
  a.resolve({ id: 'a' });
  await Promise.all(calls.map((c) => c.done));
  expect(calls.map((c) => c.value)).toEqual([{ id: 'a' }, { id: 'a' }, { id: 'b' }]);
});

test.each(['resolve', 'reject'])('02: clears completed %s so next call is fresh', async (outcome) => {
  const first = deferred(), next = deferred();
  const api = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
  const client = createRequestDeduplicator(api);
  const a = watch(client.request('x')), b = watch(client.request('x'));
  await turn();
  expect(api).toHaveBeenCalledTimes(1);
  const value = outcome === 'resolve' ? { id: 'x' } : new Error('offline');
  first[outcome](value);
  await Promise.all([a.done, b.done]);
  for (const result of [a, b]) {
    expect(result.status).toBe(outcome === 'resolve' ? 'fulfilled' : 'rejected');
    if (outcome === 'resolve') expect(result.value).toEqual(value);
    else expect(result.error).toBe(value);
  }
  const c = watch(client.request('x'));
  await turn();
  expect(api).toHaveBeenCalledTimes(2);
  next.resolve({ fresh: true });
  await c.done;
  expect(c.value).toEqual({ fresh: true });
});
