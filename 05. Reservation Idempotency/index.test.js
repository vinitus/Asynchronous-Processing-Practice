const { createReservationAttemptManager } = require('./index');
const { deferred, turn, watch } = require('../testing/helpers.cjs');

test.each(['resolve', 'reject'])('05: shares active %s, releases pending and preserves key', async (outcome) => {
  const first = deferred(), next = deferred();
  const api = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
  const createKey = jest.fn().mockReturnValueOnce('key-1').mockReturnValueOnce('key-2');
  const manager = createReservationAttemptManager({ createReservation: api, createKey });
  const payload = { carId: 'a' };
  const attempt = manager.newAttempt(payload);
  expect(api).not.toHaveBeenCalled();
  expect(attempt.key).toBe('key-1');
  const a = watch(attempt.submit()), b = watch(attempt.submit());
  expect(attempt.isPending()).toBe(true);
  await turn();
  expect(api).toHaveBeenCalledTimes(1);
  expect(api.mock.calls[0]).toEqual([payload, { idempotencyKey: 'key-1' }]);
  const value = outcome === 'resolve' ? { reservation: 1 } : new Error('timeout');
  first[outcome](value);
  await Promise.all([a.done, b.done]);
  for (const r of [a, b]) {
    expect(r.status).toBe(outcome === 'resolve' ? 'fulfilled' : 'rejected');
    if (outcome === 'resolve') expect(r.value).toEqual(value);
    else expect(r.error).toBe(value);
  }
  expect(attempt.isPending()).toBe(false);
  const retry = watch(attempt.submit());
  await turn();
  expect(api.mock.calls[1]).toEqual([payload, { idempotencyKey: 'key-1' }]);
  next.resolve({ reservation: 1 });
  await retry.done;
  expect(attempt.isPending()).toBe(false);
  expect(manager.newAttempt(payload).key).toBe('key-2');
  expect(createKey).toHaveBeenCalledTimes(2);
});

test('05: server commits then loses response; retry does not create another reservation', async () => {
  const records = new Map();
  let loseResponse = true, serial = 0;
  // Server fixture: server-side idempotency is explicitly part of the scenario.
  const api = jest.fn(async (payload, { idempotencyKey }) => {
    if (!records.has(idempotencyKey)) records.set(idempotencyKey, { id: records.size + 1, ...payload });
    if (loseResponse) { loseResponse = false; throw new Error('response lost'); }
    return records.get(idempotencyKey);
  });
  const manager = createReservationAttemptManager({ createReservation: api, createKey: () => `key-${++serial}` });
  const attempt = manager.newAttempt({ seat: 4 });
  await expect(attempt.submit()).rejects.toThrow('response lost');
  expect(attempt.isPending()).toBe(false);
  await expect(attempt.submit()).resolves.toEqual({ id: 1, seat: 4 });
  expect(records.size).toBe(1);
  const fresh = manager.newAttempt({ seat: 5 });
  await expect(fresh.submit()).resolves.toEqual({ id: 2, seat: 5 });
  expect(records.size).toBe(2);
});

test('05: separate attempts can progress independently', async () => {
  const gates = [deferred(), deferred()];
  let serial = 0;
  const api = jest.fn().mockReturnValueOnce(gates[0].promise).mockReturnValueOnce(gates[1].promise);
  const manager = createReservationAttemptManager({ createReservation: api, createKey: () => String(++serial) });
  const a = manager.newAttempt('a'), b = manager.newAttempt('b');
  const x = watch(a.submit()), y = watch(b.submit());
  await turn();
  expect(api).toHaveBeenCalledTimes(2);
  gates[1].resolve('b');
  await y.done;
  expect(a.isPending()).toBe(true);
  expect(b.isPending()).toBe(false);
  gates[0].resolve('a');
  await x.done;
});
