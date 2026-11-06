const { createReservationManager } = require('./index');
const { controlled, turn, watch } = require('../testing/helpers.cjs');
const names = ['show', 'seat', 'eligibility', 'pricing', 'hold', 'amount', 'order', 'payment', 'confirm', 'release'];
const data = {
  show: { id: 1 }, seat: { available: true }, eligibility: { eligible: true }, pricing: { price: 50 },
  hold: { holdId: 2 }, amount: { total: 50 }, order: { orderId: 3 }, payment: { transactionId: 4 },
  confirm: { reservationId: 5 }, release: { ok: true },
};
function setup() {
  const fixture = controlled(names);
  const manager = createReservationManager(fixture.api);
  return { ...fixture, manager, result: watch(manager.run({ showId: 1 })) };
}
function called(api) { return names.filter((n) => api[n].mock.calls.length); }
function expectCalled(api, expected) {
  expect(called(api).sort()).toEqual([...expected].sort());
  for (const name of names) expect(api[name].mock.calls.length).toBeLessThanOrEqual(1);
}
async function release(f, name, value = data[name]) { f.gates[name].resolve(value); await turn(); }
async function startBranches(f) { await turn(); await release(f, 'show'); }
async function heldBeforePricing(f) {
  await startBranches(f);
  await release(f, 'seat'); await release(f, 'eligibility');
  expect(f.api.hold).toHaveBeenCalledTimes(1);
  await release(f, 'hold');
}
// Complete only requests actually made. This is a mock driver, not a workflow implementation.
async function finish(f, failures = {}, overrides = {}) {
  const settled = new Set();
  for (let round = 0; round < names.length + 1; round++) {
    await turn();
    const pending = called(f.api).filter((n) => !settled.has(n));
    if (!pending.length) break;
    for (const n of pending) {
      settled.add(n);
      if (failures[n]) f.gates[n].reject(failures[n]);
      else f.gates[n].resolve(Object.hasOwn(overrides, n) ? overrides[n] : data[n]);
    }
  }
  await turn();
  expect(f.result.status).toBe('fulfilled');
}
const expected = (extra = {}) => ({
  success: false, payment: 'not_started', hold: 'none', failedStage: null,
  recovery: 'not_needed', cancelled: false, ...extra,
});

test('12: dependency boundaries, independent branches, exact input propagation and final success', async () => {
  const f = setup(); await turn();
  expectCalled(f.api, ['show']);
  expect(f.api.show.mock.calls[0][0]).toEqual({ showId: 1 });
  await release(f, 'show');
  expectCalled(f.api, ['show', 'seat', 'eligibility', 'pricing']);
  for (const n of ['seat', 'eligibility', 'pricing']) expect(f.api[n].mock.calls[0][0]).toEqual({ show: data.show });
  await release(f, 'eligibility');
  expect(f.api.hold).not.toHaveBeenCalled(); expect(f.api.amount).not.toHaveBeenCalled();
  await release(f, 'pricing');
  expect(f.api.amount).toHaveBeenCalledTimes(1);
  expect(f.api.amount.mock.calls[0][0]).toEqual({ eligibility: data.eligibility, pricing: data.pricing });
  await release(f, 'amount'); expect(f.api.order).not.toHaveBeenCalled();
  await release(f, 'seat');
  expect(f.api.hold.mock.calls[0][0]).toEqual({ seat: data.seat, eligibility: data.eligibility });
  expect(f.api.order).not.toHaveBeenCalled();
  await release(f, 'hold');
  expect(f.api.order.mock.calls[0][0]).toEqual({ hold: data.hold, amount: data.amount });
  expect(f.api.payment).not.toHaveBeenCalled();
  await release(f, 'order');
  expect(f.api.payment.mock.calls[0][0]).toEqual({ order: data.order });
  expect(f.api.confirm).not.toHaveBeenCalled();
  await release(f, 'payment');
  expect(f.api.confirm.mock.calls[0][0]).toEqual({ hold: data.hold, payment: data.payment });
  expect(f.result.status).toBe('pending');
  await release(f, 'confirm');
  expect(f.result.value).toEqual(expected({ success: true, payment: 'paid', hold: 'confirmed' }));
  expectCalled(f.api, names.filter((n) => n !== 'release'));
});

test('12: hold can finish while pricing is pending, but order waits for amount', async () => {
  const f = setup(); await heldBeforePricing(f);
  expect(f.api.amount).not.toHaveBeenCalled(); expect(f.api.order).not.toHaveBeenCalled();
  await release(f, 'pricing');
  expect(f.api.amount).toHaveBeenCalledTimes(1);
  expect(f.api.order).not.toHaveBeenCalled();
  await finish(f);
  expect(f.result.value.success).toBe(true);
});

test.each([
  ['show', [], 'none', 'not_started', 'not_needed'],
  ['seat', ['show', 'eligibility', 'pricing'], 'none', 'not_started', 'not_needed'],
  ['eligibility', ['show', 'seat', 'pricing'], 'none', 'not_started', 'not_needed'],
  ['hold', ['show', 'seat', 'eligibility', 'pricing', 'amount'], 'none', 'not_started', 'not_needed'],
  ['order', ['show', 'seat', 'eligibility', 'pricing', 'hold', 'amount', 'release'], 'released', 'not_started', 'released'],
  ['payment', ['show', 'seat', 'eligibility', 'pricing', 'hold', 'amount', 'order', 'release'], 'released', 'failed', 'released'],
  ['confirm', ['show', 'seat', 'eligibility', 'pricing', 'hold', 'amount', 'order', 'payment'], 'held', 'paid', 'not_needed'],
])('12: failure at %s records stage and performs only valid downstream work', async (stage, others, hold, payment, recovery) => {
  const f = setup();
  await finish(f, { [stage]: new Error(stage) });
  // Amount is independent of seat; allow it to have started before seat failure was observed.
  const optional = stage === 'seat' && f.api.amount.mock.calls.length ? ['amount'] : [];
  expectCalled(f.api, [stage, ...others, ...optional]);
  expect(f.result.value).toEqual(expected({ failedStage: stage, hold, payment, recovery }));
  if (recovery === 'released') expect(f.api.release.mock.calls[0][0]).toEqual({ hold: data.hold });
});

test.each([['seat', { available: false }], ['eligibility', { eligible: false }]])(
  '12: unsuccessful %s decision never holds or orders', async (stage, value) => {
    const f = setup(); await finish(f, {}, { [stage]: value });
    expect(f.api.hold).not.toHaveBeenCalled(); expect(f.api.order).not.toHaveBeenCalled();
    expect(f.api.payment).not.toHaveBeenCalled(); expect(f.api.release).not.toHaveBeenCalled();
    expect(f.result.value).toEqual(expected({ failedStage: stage }));
    if (stage === 'eligibility') expect(f.api.amount).not.toHaveBeenCalled();
  },
);

test.each(['pricing', 'amount'])('12: %s failure after successful hold releases it', async (stage) => {
  const f = setup(); await heldBeforePricing(f);
  if (stage === 'amount') await release(f, 'pricing');
  f.gates[stage].reject(new Error(stage)); await turn();
  expect(f.api.release).toHaveBeenCalledTimes(1);
  expect(f.api.order).not.toHaveBeenCalled();
  // Complete any already-started requests, including recovery.
  await finish(f, { [stage]: new Error(stage) });
  expect(f.result.value).toEqual(expected({ failedStage: stage, hold: 'released', recovery: 'released' }));
});

test('12: pricing fails before hold prerequisites finish; no new work starts', async () => {
  const f = setup(); await startBranches(f);
  expectCalled(f.api, ['show', 'seat', 'eligibility', 'pricing']);
  f.gates.pricing.reject(new Error('pricing')); await turn();
  await release(f, 'seat'); await release(f, 'eligibility');
  await finish(f);
  expectCalled(f.api, ['show', 'seat', 'eligibility', 'pricing']);
  expect(f.result.value).toEqual(expected({ failedStage: 'pricing' }));
});

test('12: amount failure followed by late hold rejection needs no release', async () => {
  const f = setup(); await startBranches(f);
  for (const n of ['seat', 'eligibility', 'pricing']) await release(f, n);
  expect(f.api.hold).toHaveBeenCalledTimes(1);
  expect(f.api.amount).toHaveBeenCalledTimes(1);
  f.gates.amount.reject(new Error('amount')); await turn();
  f.gates.hold.reject(new Error('late hold')); await turn();
  await finish(f);
  expectCalled(f.api, ['show', 'seat', 'eligibility', 'pricing', 'hold', 'amount']);
  expect(f.result.value).toEqual(expected({ failedStage: 'amount' }));
});

test('12: amount fails while hold is pending; late successful hold is released', async () => {
  const f = setup(); await startBranches(f);
  for (const n of ['seat', 'eligibility', 'pricing']) await release(f, n);
  expect(f.api.hold).toHaveBeenCalledTimes(1);
  f.gates.amount.reject(new Error('amount')); await turn();
  expect(f.api.order).not.toHaveBeenCalled();
  await release(f, 'hold');
  expect(f.api.release).toHaveBeenCalledTimes(1);
  await release(f, 'release');
  expect(f.result.value).toEqual(expected({ failedStage: 'amount', hold: 'released', recovery: 'released' }));
});

test.each(['order', 'payment'])('12: release failure preserves original %s failure', async (stage) => {
  const f = setup(); await finish(f, { [stage]: new Error(stage), release: new Error('release') });
  expect(f.result.value).toEqual(expected({
    failedStage: stage, payment: stage === 'payment' ? 'failed' : 'not_started',
    hold: 'release_failed', recovery: 'failed',
  }));
  expect(f.api.release).toHaveBeenCalledTimes(1);
  expect(f.api.confirm).not.toHaveBeenCalled();
});

test('12: cancel during initial lookup causes no hold or downstream calls', async () => {
  const f = setup(); await turn(); f.manager.cancel();
  await finish(f);
  expectCalled(f.api, ['show']);
  expect(f.result.value).toEqual(expected({ cancelled: true, failedStage: 'cancelled' }));
});

test('12: cancel during parallel lookups does not create a hold', async () => {
  const f = setup(); await startBranches(f); f.manager.cancel();
  await finish(f);
  expectCalled(f.api, ['show', 'seat', 'eligibility', 'pricing']);
  expect(f.result.value).toEqual(expected({ cancelled: true, failedStage: 'cancelled' }));
});

test.each(['resolve', 'reject'])('12: cancel pending hold followed by %s uses correct cleanup', async (outcome) => {
  const f = setup(); await startBranches(f);
  await release(f, 'seat'); await release(f, 'eligibility');
  expect(f.api.hold).toHaveBeenCalledTimes(1);
  f.manager.cancel();
  f.gates.hold[outcome](outcome === 'resolve' ? data.hold : new Error('hold'));
  await finish(f);
  expect(f.api.order).not.toHaveBeenCalled(); expect(f.api.payment).not.toHaveBeenCalled();
  expect(f.api.release).toHaveBeenCalledTimes(outcome === 'resolve' ? 1 : 0);
  expect(f.result.value).toEqual(expected({
    cancelled: true, failedStage: 'cancelled',
    hold: outcome === 'resolve' ? 'released' : 'none', recovery: outcome === 'resolve' ? 'released' : 'not_needed',
  }));
});

test.each([['amount', 'resolve'], ['order', 'resolve'], ['order', 'reject']])(
  '12: cancel while %s is pending, late %s releases held seat and prevents payment', async (stage, outcome) => {
  const f = setup(); await heldBeforePricing(f); await release(f, 'pricing');
  if (stage === 'order') await release(f, 'amount');
  expect(f.api[stage]).toHaveBeenCalledTimes(1);
  f.manager.cancel();
  await finish(f, outcome === 'reject' ? { [stage]: new Error('late order') } : {});
  expect(f.api.payment).not.toHaveBeenCalled(); expect(f.api.confirm).not.toHaveBeenCalled();
  expect(f.result.value).toEqual(expected({ cancelled: true, failedStage: 'cancelled', hold: 'released', recovery: 'released' }));
});

test.each(['resolve', 'reject'])('12: cancel during confirmation is ignored on late %s', async (outcome) => {
  const f = setup(); await heldBeforePricing(f);
  for (const n of ['pricing', 'amount', 'order', 'payment']) await release(f, n);
  expect(f.api.confirm).toHaveBeenCalledTimes(1);
  f.manager.cancel(); await turn();
  expect(f.result.status).toBe('pending');
  expect(f.api.release).not.toHaveBeenCalled();
  f.gates.confirm[outcome](outcome === 'resolve' ? data.confirm : new Error('confirm'));
  await finish(f);
  expect(f.api.release).not.toHaveBeenCalled();
  expect(f.result.value).toEqual(outcome === 'resolve'
    ? expected({ success: true, payment: 'paid', hold: 'confirmed' })
    : expected({ failedStage: 'confirm', payment: 'paid', hold: 'held' }));
});

test('12: cancellation recovery can itself fail', async () => {
  const f = setup(); await heldBeforePricing(f); f.manager.cancel();
  await finish(f, { release: new Error('cleanup failed') });
  for (const n of ['amount', 'order', 'payment', 'confirm']) expect(f.api[n]).not.toHaveBeenCalled();
  expect(f.result.value).toEqual(expected({ cancelled: true, failedStage: 'cancelled', hold: 'release_failed', recovery: 'failed' }));
});

test.each(['resolve', 'reject'])('12: cancel after payment starts waits for its %s and follows payment policy', async (outcome) => {
  const f = setup(); await heldBeforePricing(f);
  for (const n of ['pricing', 'amount', 'order']) await release(f, n);
  expect(f.api.payment).toHaveBeenCalledTimes(1);
  f.manager.cancel(); await turn();
  expect(f.api.release).not.toHaveBeenCalled(); expect(f.api.confirm).not.toHaveBeenCalled();
  f.gates.payment[outcome](outcome === 'resolve' ? data.payment : new Error('declined'));
  await finish(f);
  expect(f.result.value).toEqual(outcome === 'resolve'
    ? expected({ success: true, payment: 'paid', hold: 'confirmed' })
    : expected({ failedStage: 'payment', payment: 'failed', hold: 'released', recovery: 'released' }));
});
