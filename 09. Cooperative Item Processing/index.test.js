const { processItems } = require('./index');
const { deferred, turn, watch } = require('../testing/helpers.cjs');

test('09: 100000 items exactly once in order and external work runs between batches', async () => {
  const items = Array.from({ length: 100000 }, (_, i) => i);
  const seen = [], externalAt = [];
  const yieldControl = jest.fn(async () => { await turn(); externalAt.push(seen.length); });
  const value = await processItems(items, (item, index) => { seen.push([item, index]); }, { batchSize: 1000, yieldControl });
  expect(value).toBeUndefined();
  expect(seen).toEqual(items.map((i) => [i, i]));
  expect(yieldControl).toHaveBeenCalledTimes(99);
  expect(externalAt).toEqual(Array.from({ length: 99 }, (_, i) => (i + 1) * 1000));
});

test('09: processing pauses until injected yield resolves', async () => {
  const gate = deferred(), seen = [];
  const yieldControl = jest.fn(() => gate.promise);
  const result = watch(processItems(['a', 'b', 'c'], (item) => seen.push(item), { batchSize: 2, yieldControl }));
  await turn();
  expect(seen).toEqual(['a', 'b']);
  expect(result.status).toBe('pending');
  expect(yieldControl).toHaveBeenCalledTimes(1);
  gate.resolve();
  await result.done;
  expect(seen).toEqual(['a', 'b', 'c']);
  expect(result.status).toBe('fulfilled');
});

test.each([[0, 3, 0], [1, 3, 0], [3, 3, 0], [4, 3, 1], [6, 3, 1], [7, 3, 2], [3, 1, 2]])(
  '09: length %i, batch %i yields %i times', async (length, batchSize, count) => {
    const visit = jest.fn(), yieldControl = jest.fn(async () => {});
    const result = watch(processItems(Array.from({ length }, (_, i) => i), visit, { batchSize, yieldControl }));
    await result.done;
    expect(result.status).toBe('fulfilled');
    expect(visit.mock.calls).toEqual(Array.from({ length }, (_, i) => [i, i]));
    expect(yieldControl).toHaveBeenCalledTimes(count);
  },
);
