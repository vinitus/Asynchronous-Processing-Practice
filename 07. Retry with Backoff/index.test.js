const { retry } = require('./index');
const { deferred, turn, watch } = require('../testing/helpers.cjs');
const options = (extra = {}) => ({
  maxAttempts: 3, baseDelayMs: 100, signal: new AbortController().signal,
  random: jest.fn(() => 0.5), sleep: jest.fn(async () => {}), shouldRetry: jest.fn(() => true), ...extra,
});

test('07: first success passes value without delay', async () => {
  const opts = options();
  const operation = jest.fn(async () => ({ price: 9 }));
  await expect(retry(operation, opts)).resolves.toEqual({ price: 9 });
  expect(operation).toHaveBeenCalledTimes(1);
  expect(operation.mock.calls[0][0]).toEqual({ attempt: 1, signal: opts.signal });
  expect(opts.sleep).not.toHaveBeenCalled();
});

test('07: exponential full jitter and no attempt before injected sleep completes', async () => {
  const waits = [deferred(), deferred(), deferred()];
  const sleep = jest.fn().mockReturnValueOnce(waits[0].promise).mockReturnValueOnce(waits[1].promise).mockReturnValueOnce(waits[2].promise);
  const random = jest.fn().mockReturnValueOnce(0).mockReturnValueOnce(0.25).mockReturnValueOnce(0.75);
  const error = new Error('503');
  const operation = jest.fn().mockRejectedValueOnce(error).mockRejectedValueOnce(error).mockRejectedValueOnce(error).mockResolvedValue('ok');
  const opts = options({ maxAttempts: 4, baseDelayMs: 101, sleep, random });
  const result = watch(retry(operation, opts));
  for (let i = 0; i < 3; i++) {
    await turn();
    expect(operation).toHaveBeenCalledTimes(i + 1);
    expect(sleep).toHaveBeenCalledTimes(i + 1);
    expect(sleep.mock.calls[i]).toEqual([[0, 50.5, 303][i], opts.signal]);
    expect(result.status).toBe('pending');
    waits[i].resolve();
  }
  await result.done;
  expect(result.value).toBe('ok');
  expect(operation.mock.calls.map((args) => args[0].attempt)).toEqual([1, 2, 3, 4]);
  expect(random).toHaveBeenCalledTimes(3);
});

test.each([1, 3])('07: maxAttempts=%i includes initial call and propagates final error', async (maxAttempts) => {
  const errors = Array.from({ length: maxAttempts }, (_, i) => new Error(String(i)));
  let count = 0;
  const operation = jest.fn(async () => { throw errors[count++]; });
  const opts = options({ maxAttempts });
  await expect(retry(operation, opts)).rejects.toBe(errors.at(-1));
  expect(operation).toHaveBeenCalledTimes(maxAttempts);
  expect(opts.sleep).toHaveBeenCalledTimes(maxAttempts - 1);
});

test('07: shouldRetry veto stops without delay', async () => {
  const error = new Error('permanent');
  const operation = jest.fn(async () => { throw error; });
  const opts = options({ shouldRetry: jest.fn(() => false) });
  await expect(retry(operation, opts)).rejects.toBe(error);
  expect(opts.shouldRetry).toHaveBeenCalledWith(error);
  expect(operation).toHaveBeenCalledTimes(1);
  expect(opts.sleep).not.toHaveBeenCalled();
});

test('07: pre-aborted signal prevents first operation', async () => {
  const abort = new AbortController(); abort.abort();
  const operation = jest.fn();
  await expect(retry(operation, options({ signal: abort.signal }))).rejects.toHaveProperty('name', 'AbortError');
  expect(operation).not.toHaveBeenCalled();
});

test('07: later shouldRetry veto propagates that error without another delay or attempt', async () => {
  const temporary = new Error('temporary'), terminal = new Error('terminal');
  const operation = jest.fn().mockRejectedValueOnce(temporary).mockRejectedValueOnce(terminal);
  const opts = options({ shouldRetry: jest.fn((error) => error === temporary) });
  await expect(retry(operation, opts)).rejects.toBe(terminal);
  expect(opts.shouldRetry).toHaveBeenCalledWith(temporary);
  expect(opts.shouldRetry).toHaveBeenCalledWith(terminal);
  expect(operation).toHaveBeenCalledTimes(2);
  expect(opts.sleep).toHaveBeenCalledTimes(1);
});

test.each(['resolve', 'reject'])('07: cancellation during operation ignores late %s', async (outcome) => {
  const abort = new AbortController(), gate = deferred();
  const operation = jest.fn(() => gate.promise);
  const opts = options({ signal: abort.signal });
  const result = watch(retry(operation, opts));
  await turn();
  expect(operation.mock.calls[0][0].signal).toBe(abort.signal);
  abort.abort(); await turn();
  expect(result.status).toBe('rejected');
  expect(result.error.name).toBe('AbortError');
  gate[outcome](outcome === 'resolve' ? 'late' : new Error('late'));
  await turn();
  expect(operation).toHaveBeenCalledTimes(1);
  expect(opts.sleep).not.toHaveBeenCalled();
});

test.each(['resolve', 'reject'])('07: cancellation during retry sleep ignores late %s without retrying', async (outcome) => {
  const abort = new AbortController(), gate = deferred();
  const operation = jest.fn().mockRejectedValue(new Error('503'));
  const opts = options({ signal: abort.signal, sleep: jest.fn(() => gate.promise) });
  const result = watch(retry(operation, opts));
  await turn();
  expect(opts.sleep.mock.calls[0][1]).toBe(abort.signal);
  abort.abort(); await turn();
  expect(result.status).toBe('rejected');
  expect(result.error.name).toBe('AbortError');
  const cancellation = result.error;
  gate[outcome](outcome === 'resolve' ? undefined : new Error('late sleep'));
  await turn();
  expect(operation).toHaveBeenCalledTimes(1);
  expect(opts.sleep).toHaveBeenCalledTimes(1);
  expect(result.status).toBe('rejected');
  expect(result.error).toBe(cancellation);
});
