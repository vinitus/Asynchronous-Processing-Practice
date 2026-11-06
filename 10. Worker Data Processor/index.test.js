const { Worker } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const { createWorkerProcessor } = require('./index');
const { turn, watch } = require('../testing/helpers.cjs');

function mockWorker() {
  const listeners = { message: new Set(), error: new Set() };
  const worker = {
    onmessage: null, onerror: null,
    postMessage: jest.fn(), terminate: jest.fn(),
    addEventListener: (type, listener) => listeners[type].add(listener),
    removeEventListener: (type, listener) => listeners[type].delete(listener),
  };
  const callbacks = (type) => [...listeners[type], ...(worker[`on${type}`] ? [worker[`on${type}`]] : [])];
  const emit = (type, event) => callbacks(type).forEach((fn) => fn(event));
  return { worker, emit, callbacks };
}

test('10: creates worker, sends data once, uses worker result and cleans up', async () => {
  const mock = mockWorker(), createWorker = jest.fn(() => mock.worker);
  const processor = createWorkerProcessor({ createWorker });
  const result = watch(processor.process([2, 3]));
  await turn();
  expect(createWorker).toHaveBeenCalledTimes(1);
  expect(mock.worker.postMessage).toHaveBeenCalledTimes(1);
  expect(mock.worker.postMessage.mock.calls[0][0]).toEqual({ data: [2, 3] });
  expect(result.status).toBe('pending');
  // Deliberately distinct: the main module must return the message, not calculate locally.
  mock.emit('message', { data: { type: 'success', result: 987 } });
  await result.done;
  expect(result.value).toBe(987);
  expect(mock.worker.terminate).toHaveBeenCalledTimes(1);
});

test.each(['message', 'event'])('10: %s errors are observable and release resources', async (mode) => {
  const mock = mockWorker();
  const processor = createWorkerProcessor({ createWorker: () => mock.worker });
  const result = watch(processor.process([1]));
  await turn();
  const error = new Error('worker failed');
  if (mode === 'message') mock.emit('message', { data: { type: 'error', message: error.message } });
  else mock.emit('error', { error });
  await result.done;
  expect(result.status).toBe('rejected');
  expect(result.error.message).toBe('worker failed');
  if (mode === 'event') expect(result.error).toBe(error);
  expect(mock.worker.terminate).toHaveBeenCalledTimes(1);
});

test('10: pre-aborted operation does not allocate worker', async () => {
  const abort = new AbortController(); abort.abort();
  const createWorker = jest.fn();
  const processor = createWorkerProcessor({ createWorker });
  await expect(processor.process([], { signal: abort.signal })).rejects.toHaveProperty('name', 'AbortError');
  expect(createWorker).not.toHaveBeenCalled();
});

test.each(['abort', 'dispose'])('10: %s rejects promptly, cleans up and ignores queued callbacks', async (mode) => {
  const mock = mockWorker(), abort = new AbortController();
  const processor = createWorkerProcessor({ createWorker: () => mock.worker });
  const result = watch(processor.process([1], { signal: abort.signal }));
  await turn();
  const messages = mock.callbacks('message'), errors = mock.callbacks('error');
  if (mode === 'abort') abort.abort(); else processor.dispose();
  await turn();
  expect(result.status).toBe('rejected');
  expect(result.error.name).toBe(mode === 'abort' ? 'AbortError' : 'DisposedError');
  expect(mock.worker.terminate).toHaveBeenCalledTimes(1);
  messages.forEach((fn) => fn({ data: { type: 'success', result: 123 } }));
  errors.forEach((fn) => fn({ error: new Error('late') }));
  await turn();
  expect(result.status).toBe('rejected');
  expect(result.error.name).toBe(mode === 'abort' ? 'AbortError' : 'DisposedError');
});

describe('10: actual Worker entry', () => {
  const workers = [];
  afterEach(async () => { await Promise.all(workers.splice(0).map((w) => w.terminate())); });
  test.each([[[], 0], [[2, -3, 0], 13], [Array(100000).fill(3), 900000]])(
    'worker calculation case %#', async (data, expected) => {
      const source = fs.readFileSync(path.join(__dirname, 'worker.js'), 'utf8');
      // Adapt the Web Worker global API to a separate Node worker thread.
      const bootstrap = `
        const { parentPort } = require('node:worker_threads');
        globalThis.self = globalThis;
        globalThis.postMessage = value => parentPort.postMessage(value);
        const listeners = new Set();
        globalThis.addEventListener = (type, fn) => { if (type === 'message') listeners.add(fn); };
        globalThis.removeEventListener = (type, fn) => { if (type === 'message') listeners.delete(fn); };
        parentPort.on('message', data => {
          const event = { data };
          if (typeof globalThis.onmessage === 'function') globalThis.onmessage(event);
          for (const fn of listeners) fn(event);
        });
        require('node:vm').runInThisContext(${JSON.stringify(source)});
      `;
      const worker = new Worker(bootstrap, { eval: true });
      workers.push(worker);
      const reply = new Promise((resolve, reject) => {
        worker.once('message', resolve); worker.once('error', reject);
      });
      worker.postMessage({ data });
      await expect(reply).resolves.toEqual({ type: 'success', result: expected });
    },
  );
});
