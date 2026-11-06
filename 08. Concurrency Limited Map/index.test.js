const { mapWithConcurrency } = require('./index');
const { deferred, turn, watch } = require('../testing/helpers.cjs');

test.each([1, 2, 9])('08: limit %i, bounded activity, exactly once and ordered results', async (limit) => {
  const items = ['a', 'b', 'c', 'd', 'e'];
  const gates = items.map(() => deferred());
  const running = new Set(), finished = new Set();
  let active = 0, peak = 0;
  const mapper = jest.fn((item, index) => {
    expect(item).toBe(items[index]);
    running.add(index); active++; peak = Math.max(peak, active);
    expect(active).toBeLessThanOrEqual(limit);
    return gates[index].promise.finally(() => { active--; running.delete(index); });
  });
  const result = watch(mapWithConcurrency(items, limit, mapper));
  // Release currently running requests in reverse order; allow any valid scheduling policy.
  for (let round = 0; round < items.length; round++) {
    await turn();
    const batch = [...running].sort((a, b) => b - a);
    if (!batch.length) break;
    for (const index of batch) { finished.add(index); gates[index].resolve(`value-${index}`); }
  }
  await turn();
  expect(result.status).toBe('fulfilled');
  expect(result.value).toEqual(items.map((_, i) => `value-${i}`));
  expect(mapper).toHaveBeenCalledTimes(items.length);
  expect(finished.size).toBe(items.length);
  expect(peak).toBeLessThanOrEqual(limit);
});

test('08: empty input does not call mapper', async () => {
  const mapper = jest.fn();
  await expect(mapWithConcurrency([], 2, mapper)).resolves.toEqual([]);
  expect(mapper).not.toHaveBeenCalled();
});

test.each([0, -1])('08: invalid limit %i rejects', async (limit) => {
  const mapper = jest.fn();
  await expect(mapWithConcurrency([1], limit, mapper)).rejects.toBeInstanceOf(RangeError);
  expect(mapper).not.toHaveBeenCalled();
});

test.each(['resolve', 'reject'])('08: failure stops new work, ignores late %s of started work', async (outcome) => {
  const started = [];
  const mapper = jest.fn((item) => {
    const gate = deferred(); started.push({ item, ...gate }); return gate.promise;
  });
  const result = watch(mapWithConcurrency([0, 1, 2, 3, 4], 2, mapper));
  await turn();
  expect(started.length).toBeGreaterThan(0);
  expect(started.length).toBeLessThanOrEqual(2);
  const count = started.length;
  const error = new Error('failed');
  started[0].reject(error);
  await turn();
  expect(result.status).toBe('rejected');
  expect(result.error).toBe(error);
  expect(mapper).toHaveBeenCalledTimes(count);
  // A serial scheduler is valid. Check every other in-flight task if present;
  // requiring a second one would impose an undocumented minimum concurrency.
  for (const gate of started.slice(1)) gate[outcome](outcome === 'resolve' ? 'late' : new Error('late'));
  await turn();
  expect(mapper).toHaveBeenCalledTimes(count);
  expect(result.status).toBe('rejected');
  expect(result.error).toBe(error);
});
