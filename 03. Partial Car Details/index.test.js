const { loadCarDetails } = require('./index');
const { controlled, turn, watch } = require('../testing/helpers.cjs');
const names = ['car', 'insurance', 'discount'];

test.each(Array.from({ length: 8 }, (_, mask) => [mask]))('03: complete outcome mask %i', async (mask) => {
  const { gates, api } = controlled(names);
  const result = watch(loadCarDetails('car-7', api));
  await turn();
  for (const name of names) {
    expect(api[name]).toHaveBeenCalledTimes(1);
    expect(api[name].mock.calls[0][0]).toBe('car-7');
  }
  const failures = names.filter((_, i) => mask & (1 << i));
  // Reject before resolving other requests to expose fail-fast result loss.
  for (const name of failures) gates[name].reject(new Error(name));
  await turn();
  if (failures.length < 3) expect(result.status).toBe('pending');
  for (const name of names.filter((n) => !failures.includes(n)).reverse()) gates[name].resolve({ source: name });
  await result.done;
  expect(result.status).toBe('fulfilled');
  for (const name of names) expect(result.value[name]).toEqual(failures.includes(name) ? null : { source: name });
  expect([...result.value.errors].sort()).toEqual([...failures].sort());
  expect(result.value.canReserve).toBe(!(mask & 3));
});
