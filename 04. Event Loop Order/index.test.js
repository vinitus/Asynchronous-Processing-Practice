const { createHook, executionAsyncId } = require('node:async_hooks');
const { predictEventLoopOrder } = require('./index');

test('04: predicts original program order and execution categories', async () => {
  // Observe runtime contexts without annotating individual outputs with answers.
  const types = new Map();
  const hook = createHook({
    init(id, type) { types.set(id, type); },
    destroy(id) { types.delete(id); },
  });
  const actual = [];
  let synchronous = true;
  const categories = { PROMISE: 'microtask', Microtask: 'microtask', Timeout: 'timer' };
  const log = (label) => {
    const kind = synchronous ? 'sync' : categories[types.get(executionAsyncId())];
    actual.push({ label, kind });
  };
  hook.enable();
  try {
    let timerDone;
    const timer = new Promise((resolve) => { timerDone = resolve; });
    log('A');
    setTimeout(() => { log('B'); timerDone(); }, 0);
    Promise.resolve().then(() => log('C'));
    queueMicrotask(() => log('D'));
    const scenario = (async () => {
      log('E');
      await null;
      log('F');
    })();
    log('G');
    synchronous = false;
    await scenario;
    await timer;
  } finally {
    hook.disable();
  }
  expect(actual).toHaveLength(7);
  expect(actual.every((entry) => Object.values(categories).includes(entry.kind) || entry.kind === 'sync')).toBe(true);
  const prediction = await predictEventLoopOrder();
  expect(Array.isArray(prediction)).toBe(true);
  expect(prediction).toHaveLength(actual.length);
  // Report a verdict without printing the expected ordering/classifications.
  expect(actual.every((expected, i) => {
    const entry = prediction[i];
    return entry !== null && typeof entry === 'object'
      && entry.label === expected.label && entry.kind === expected.kind;
  })).toBe(true);
});
