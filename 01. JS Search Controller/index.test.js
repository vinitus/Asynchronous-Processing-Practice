const { createSearchController } = require('./index');

// The API deliberately ignores cancellation. Each request settles only on command.
function setup() {
  const requests = [];
  const api = jest.fn((query) => {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    requests.push({ query, resolve, reject });
    return promise;
  });
  return { controller: createSearchController(api), requests, api };
}

// Observe a completed event-loop turn, without assuming a number of .then layers.
const settle = () => new Promise((resolve) => setImmediate(resolve));
const idle = { results: [], loading: false, error: null };
const snapshot = (state) => ({ ...state, results: [...state.results] });

describe('01. JS Search Controller', () => {
  test('initial state, query forwarding, immediate loading, and success', async () => {
    const { controller, requests, api } = setup();
    expect(controller.getState()).toEqual(idle);
    controller.search('현대 아반떼');
    expect(controller.getState()).toEqual({ ...idle, loading: true });
    await settle();
    expect(api).toHaveBeenCalledTimes(1);
    expect(requests[0].query).toBe('현대 아반떼');
    requests[0].resolve([{ id: 1 }]);
    await settle();
    expect(controller.getState()).toEqual({ results: [{ id: 1 }], loading: false, error: null });
    controller.dispose();
  });

  test('latest failure is observable and a new search clears it', async () => {
    const { controller, requests } = setup();
    controller.search('first');
    await settle();
    const listener = jest.fn((state) => snapshot(state));
    controller.subscribe(listener);
    await settle();
    listener.mockClear();
    const error = new Error('network failure');
    requests[0].reject(error);
    await settle();
    expect(controller.getState()).toEqual({ ...idle, error });
    expect(controller.getState().error).toBe(error);
    expect(listener).toHaveBeenCalled();
    expect(listener.mock.results.at(-1).value).toEqual({ ...idle, error });
    controller.search('retry');
    expect(controller.getState()).toEqual({ ...idle, loading: true });
    await settle();
    requests[1].resolve([]);
    await settle();
    expect(controller.getState()).toEqual(idle);
    controller.dispose();
  });

  test.each(['resolve', 'reject'])('stale %s cannot stop the latest loading state', async (outcome) => {
    const { controller, requests } = setup();
    controller.search('old');
    controller.search('new');
    await settle();
    expect(requests.map((r) => r.query)).toEqual(['old', 'new']);
    const listener = jest.fn();
    controller.subscribe(listener);
    await settle();
    listener.mockClear();
    requests[0][outcome](outcome === 'resolve' ? ['stale'] : new Error('stale'));
    await settle();
    expect(controller.getState()).toEqual({ ...idle, loading: true });
    expect(listener).not.toHaveBeenCalled();
    requests[1].resolve(['latest']);
    await settle();
    expect(controller.getState()).toEqual({ results: ['latest'], loading: false, error: null });
    controller.dispose();
  });

  test.each([
    ['resolve', 'resolve'], ['resolve', 'reject'],
    ['reject', 'resolve'], ['reject', 'reject'],
  ])('latest %s survives later stale %s', async (latestOutcome, staleOutcome) => {
    const { controller, requests } = setup();
    controller.search('old');
    controller.search('new');
    await settle();
    const error = new Error('latest failure');
    requests[1][latestOutcome](latestOutcome === 'resolve' ? ['new'] : error);
    await settle();
    const expected = latestOutcome === 'resolve'
      ? { results: ['new'], loading: false, error: null }
      : { ...idle, error };
    expect(controller.getState()).toEqual(expected);
    const listener = jest.fn();
    controller.subscribe(listener);
    await settle();
    listener.mockClear();
    requests[0][staleOutcome](staleOutcome === 'resolve' ? ['old'] : new Error('old failure'));
    await settle();
    expect(controller.getState()).toEqual(expected);
    expect(listener).not.toHaveBeenCalled();
    controller.dispose();
  });

  test('repeated identical queries are distinct searches', async () => {
    const { controller, requests } = setup();
    controller.search('same');
    controller.search('same');
    await settle();
    expect(requests).toHaveLength(2);
    requests[1].resolve(['second']);
    await settle();
    requests[0].resolve(['first']);
    await settle();
    expect(controller.getState()).toEqual({ results: ['second'], loading: false, error: null });
    controller.dispose();
  });

  test('previous results survive loading and failure; empty query clears results and error', async () => {
    const { controller, requests, api } = setup();
    controller.search('success');
    await settle();
    requests[0].resolve(['saved']);
    await settle();
    controller.search('failure');
    expect(controller.getState()).toEqual({ results: ['saved'], loading: true, error: null });
    await settle();
    const error = new Error('failed');
    requests[1].reject(error);
    await settle();
    expect(controller.getState()).toEqual({ results: ['saved'], loading: false, error });
    controller.search('');
    await settle();
    expect(controller.getState()).toEqual(idle);
    expect(api).toHaveBeenCalledTimes(2);
    controller.dispose();
  });

  test.each(['resolve', 'reject'])('empty query invalidates a pending %s', async (outcome) => {
    const { controller, requests, api } = setup();
    controller.search('pending');
    await settle();
    controller.search('');
    await settle();
    expect(controller.getState()).toEqual(idle);
    requests[0][outcome](outcome === 'resolve' ? ['late'] : new Error('late'));
    await settle();
    expect(controller.getState()).toEqual(idle);
    expect(api).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  test('subscribers receive current states and can unsubscribe independently', async () => {
    const { controller, requests } = setup();
    const first = jest.fn((state) => snapshot(state));
    const second = jest.fn((state) => snapshot(state));
    const unsubscribe = controller.subscribe(first);
    controller.subscribe(second);
    await settle();
    first.mockClear();
    second.mockClear();
    controller.search('query');
    await settle();
    for (const listener of [first, second]) {
      expect(listener).toHaveBeenCalled();
      expect(listener.mock.results.at(-1).value).toEqual({ ...idle, loading: true });
    }
    unsubscribe();
    first.mockClear();
    second.mockClear();
    requests[0].resolve(['found']);
    await settle();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
    expect(second.mock.results.at(-1).value).toEqual(controller.getState());
    expect(controller.getState()).toEqual({ results: ['found'], loading: false, error: null });
    second.mockClear();
    controller.search('');
    await settle();
    expect(second).toHaveBeenCalled();
    expect(second.mock.results.at(-1).value).toEqual(idle);
    controller.dispose();
  });

  test.each(['resolve', 'reject'])('dispose ignores pending %s and emits no late notification', async (outcome) => {
    const { controller, requests } = setup();
    const listener = jest.fn();
    controller.subscribe(listener);
    controller.search('pending');
    await settle();
    const before = snapshot(controller.getState());
    controller.dispose();
    await settle();
    listener.mockClear();
    requests[0][outcome](outcome === 'resolve' ? ['late'] : new Error('late'));
    await settle();
    expect(controller.getState()).toEqual(before);
    expect(listener).not.toHaveBeenCalled();
  });
});
