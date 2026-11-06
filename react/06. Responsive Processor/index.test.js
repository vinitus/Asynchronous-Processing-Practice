/** @jest-environment jsdom */
const React = require('react');
const { render, screen, fireEvent, act } = require('@testing-library/react');
const { deferred, settle, tick } = require('../helpers.cjs');
const { LargeDataProcessor, createProcessingTask } = require('./index');
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });
// Deliberately execute a bounded number of browser frames/tasks, never a real sleep.
async function startTask() {
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(screen.getByRole('status').textContent).toBe('Processing');
  for (let i = 0; i < 4; i++) await tick(16);
}

test.each([false, true])('1,3,5: loading commits before task, input remains editable, completion/error (%s)', async (fail) => {
  const gate = deferred();
  const createTask = jest.fn(() => {
    expect(screen.getByRole('status').textContent).toBe('Processing');
    return { promise: gate.promise, cancel: jest.fn() };
  });
  render(React.createElement(LargeDataProcessor, { createTask, input: [1, 2] }));
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(screen.getByRole('status').textContent).toBe('Processing');
  // Scheduling must yield to a browser task/frame, rather than starting CPU work inline.
  expect(createTask).not.toHaveBeenCalled();
  for (let i = 0; i < 4; i++) await tick(16);
  expect(createTask).toHaveBeenCalledTimes(1); expect(createTask).toHaveBeenCalledWith([1, 2]);
  expect(screen.getByRole('button', { name: 'Start' }).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'still responsive' } });
  expect(screen.getByLabelText('Notes').value).toBe('still responsive');
  await settle(gate, fail ? new Error('conversion failed') : '3', fail);
  expect(screen.getByRole(fail ? 'alert' : 'status').textContent).toContain(fail ? 'conversion failed' : '3');
  expect(screen.getByRole('button', { name: 'Start' }).disabled).toBe(false);
});

test('4: unmount before scheduled start prevents work; active task cancelled and rejection handled', async () => {
  const gate = deferred(), cancel = jest.fn();
  const createTask = jest.fn(() => ({ promise: gate.promise, cancel }));
  const first = render(React.createElement(LargeDataProcessor, { createTask, input: [] }));
  fireEvent.click(screen.getByRole('button', { name: 'Start' })); first.unmount();
  await tick(1000); expect(createTask).not.toHaveBeenCalled();
  const second = render(React.createElement(LargeDataProcessor, { createTask, input: [] }));
  await startTask(); expect(createTask).toHaveBeenCalledTimes(1);
  second.unmount(); expect(cancel).toHaveBeenCalledTimes(1); await settle(gate, new Error('cancelled'), true);
});

test('2: task connector has cancellable asynchronous contract and calculates result', async () => {
  const task = createProcessingTask([2, 3, -1]);
  expect(task.promise).toBeInstanceOf(Promise); expect(typeof task.cancel).toBe('function');
  let finished = false; task.promise.then(() => { finished = true; });
  expect(finished).toBe(false);
  await act(async () => { await jest.runAllTimersAsync(); });
  expect(await task.promise).toBe('4');
  const cancelled = createProcessingTask([1, 2]);
  cancelled.promise.catch(() => {}); cancelled.cancel();
  await act(async () => { await jest.runAllTimersAsync(); });
  expect(jest.getTimerCount()).toBe(0);
});
