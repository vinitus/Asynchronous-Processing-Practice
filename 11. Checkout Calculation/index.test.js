const { calculateCheckout } = require('./index');
const { controlled, turn, watch } = require('../testing/helpers.cjs');
const names = ['A', 'B1', 'B2', 'B3', 'B4', 'C', 'D1', 'D2', 'D3', 'E'];
const data = {
  A: { subtotal: 100 }, B1: { stock: 1 }, B2: { tier: 'gold' }, B3: { delivery: 'standard' },
  B4: { promotion: 1 }, C: { amount: 5 }, D1: { coupon: 1 }, D2: 10, D3: { allowed: true }, E: { discount: 20 },
};
function expectCalls(api, expected) {
  expect(names.filter((n) => api[n].mock.calls.length).sort()).toEqual([...expected].sort());
  for (const name of names) expect(api[name].mock.calls.length).toBeLessThanOrEqual(1);
}
async function release(gates, name) { gates[name].resolve(data[name]); await turn(); }

test('11: starts each branch when its own prerequisites are ready, forwards dependency values', async () => {
  const { gates, api } = controlled(names);
  const input = { cartId: 3 }, result = watch(calculateCheckout(input, api));
  await turn(); expectCalls(api, ['A']); expect(api.A.mock.calls[0][0]).toEqual(input);
  await release(gates, 'A');
  expectCalls(api, ['A', 'B1', 'B2', 'B3', 'B4']);
  for (const n of ['B1', 'B2', 'B3', 'B4']) expect(api[n].mock.calls[0][0]).toEqual({ A: data.A });
  await release(gates, 'B4');
  expectCalls(api, ['A', 'B1', 'B2', 'B3', 'B4', 'D3']);
  expect(api.D3.mock.calls[0][0]).toEqual({ B4: data.B4 });
  await release(gates, 'B1');
  expect(api.D1).toHaveBeenCalledTimes(1);
  expect(api.D2).not.toHaveBeenCalled();
  expect(api.D1.mock.calls[0][0]).toEqual({ B1: data.B1, B4: data.B4 });
  await release(gates, 'D1'); expect(api.E).not.toHaveBeenCalled();
  await release(gates, 'D3'); expect(api.E).toHaveBeenCalledTimes(1);
  expect(api.E.mock.calls[0][0]).toEqual({ D1: data.D1, D3: data.D3 });
  await release(gates, 'B2'); expect(api.C).toHaveBeenCalledTimes(1);
  expect(api.C.mock.calls[0][0]).toEqual({ B2: data.B2 });
  await release(gates, 'B3'); expect(api.D2).toHaveBeenCalledTimes(1);
  expect(api.D2.mock.calls[0][0]).toEqual({ B1: data.B1, B3: data.B3 });
  for (const n of ['E', 'C']) await release(gates, n);
  expect(result.status).toBe('pending');
  await release(gates, 'D2'); await result.done;
  expect(result.status).toBe('fulfilled');
  expect(result.value.canPay).toBe(true);
  expect(result.value.amounts).toEqual({ subtotal: 100, shipping: 10, points: 5, discount: 20, total: 85 });
  for (const name of names) expect(result.value.nodes[name]).toEqual({ status: 'success', value: data[name] });
});

test.each([
  ['D1', 'B1', 'B4'], ['D1', 'B4', 'B1'],
  ['D2', 'B1', 'B3'], ['D2', 'B3', 'B1'],
  ['E', 'D1', 'D3'], ['E', 'D3', 'D1'],
])('11: %s waits for both prerequisites when %s finishes before %s', async (node, first, second) => {
  const { gates, api } = controlled(names);
  const result = watch(calculateCheckout({}, api));
  await turn(); await release(gates, 'A');
  if (node === 'E') {
    for (const n of ['B1', 'B4']) await release(gates, n);
    expect(api.D1).toHaveBeenCalledTimes(1);
    expect(api.D3).toHaveBeenCalledTimes(1);
  }
  expect(api[node]).not.toHaveBeenCalled();
  await release(gates, first);
  expect(api[node]).not.toHaveBeenCalled();
  await release(gates, second);
  expect(api[node]).toHaveBeenCalledTimes(1);
  expect(api[node].mock.calls[0][0]).toEqual({ [first]: data[first], [second]: data[second] });
  // All remaining gates may now finish, without imposing sibling start order.
  for (const n of names) gates[n].resolve(data[n]);
  await result.done;
  expect(result.status).toBe('fulfilled');
  expect(result.value.canPay).toBe(true);
});

test.each([
  [0, 0, 0, 0, 0],
  [240, 17, 13, 29, 215],
  [75, 0, 0, 75, 0],
  [60, 9, 60, 0, 9],
])('11: monetary inputs subtotal=%i shipping=%i points=%i discount=%i yield total=%i', async (
  subtotal, shipping, points, discount, total,
) => {
  const values = { ...data, A: { subtotal }, D2: shipping, C: { amount: points }, E: { discount } };
  const { gates, api } = controlled(names);
  const result = watch(calculateCheckout({}, api));
  const completed = new Set();
  for (let round = 0; round < names.length; round++) {
    await turn();
    const ready = names.filter((n) => api[n].mock.calls.length && !completed.has(n));
    if (!ready.length) break;
    for (const n of ready) { completed.add(n); gates[n].resolve(values[n]); }
  }
  await turn();
  expect(result.status).toBe('fulfilled');
  expectCalls(api, names);
  expect(result.value.amounts).toEqual({ subtotal, shipping, points, discount, total });
  expect(result.value.canPay).toBe(true);
});

const failures = [
  ['A', ['B1', 'B2', 'B3', 'B4', 'C', 'D1', 'D2', 'D3', 'E'], false, null, null, 0, 0, null],
  ['B1', ['D1', 'D2', 'E'], false, 100, null, 5, 0, null],
  ['B2', ['C'], true, 100, 10, 0, 20, 90],
  ['B3', ['D2'], false, 100, null, 5, 20, null],
  ['B4', ['D1', 'D3', 'E'], true, 100, 10, 5, 0, 105],
  ['C', [], true, 100, 10, 0, 20, 90],
  ['D1', ['E'], true, 100, 10, 5, 0, 105],
  ['D2', [], false, 100, null, 5, 20, null],
  ['D3', ['E'], true, 100, 10, 5, 0, 105],
  ['E', [], true, 100, 10, 5, 0, 105],
];
test.each(failures)('11: %s failure preserves independent results and skips required descendants', async (
  failed, skipped, canPay, subtotal, shipping, points, discount, total,
) => {
  const { gates, api } = controlled(names);
  const result = watch(calculateCheckout({}, api)), completed = new Set();
  const error = new Error(`failure ${failed}`);
  // Test driver settles only API requests the submission actually started.
  for (let round = 0; round < names.length; round++) {
    await turn();
    const ready = names.filter((n) => api[n].mock.calls.length && !completed.has(n));
    if (!ready.length) break;
    for (const n of ready) {
      completed.add(n);
      if (n === failed) gates[n].reject(error); else gates[n].resolve(data[n]);
    }
  }
  await turn();
  expect(result.status).toBe('fulfilled');
  expectCalls(api, names.filter((n) => !skipped.includes(n)));
  for (const n of names) {
    if (n === failed) {
      expect(result.value.nodes[n].status).toBe('failure');
      expect(result.value.nodes[n].error).toBe(error);
    } else if (skipped.includes(n)) expect(result.value.nodes[n]).toEqual({ status: 'skipped' });
    else expect(result.value.nodes[n]).toEqual({ status: 'success', value: data[n] });
  }
  expect(result.value.canPay).toBe(canPay);
  expect(result.value.amounts).toEqual({ subtotal, shipping, points, discount, total });
});

test('11: coupon query failure does not wait for or block shipping completion', async () => {
  const { gates, api } = controlled(names), result = watch(calculateCheckout({}, api));
  await turn(); await release(gates, 'A');
  for (const n of ['B1', 'B3', 'B4']) await release(gates, n);
  gates.D1.reject(new Error('coupon unavailable')); await turn();
  expect(api.D2).toHaveBeenCalledTimes(1);
  await release(gates, 'D2');
  for (const n of ['B2', 'C', 'D3']) await release(gates, n);
  await result.done;
  expect(result.value.nodes.D2).toEqual({ status: 'success', value: 10 });
  expect(result.value.canPay).toBe(true);
  expect(api.E).not.toHaveBeenCalled();
});
