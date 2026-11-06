/** @jest-environment jsdom */
// Runner smoke checks, independent of intentionally incomplete exercise exports.
const React = require('react');
const { renderHook, act } = require('@testing-library/react');
const { deferred, settle, tick } = require('../react/helpers.cjs');
test('React DOM mounts, rerenders and cleans up effects', () => {
  const cleanup = jest.fn();
  const hook = renderHook(({ value }) => {
    React.useEffect(() => cleanup, []);
    return value;
  }, { initialProps: { value: 1 } });
  expect(hook.result.current).toBe(1); hook.rerender({ value: 2 });
  expect(hook.result.current).toBe(2); hook.unmount(); expect(cleanup).toHaveBeenCalledTimes(1);
});
test('controlled Promise and fake timer updates flush through React act', async () => {
  jest.useFakeTimers();
  try {
    const gate = deferred();
    const hook = renderHook(() => {
      const [value, setValue] = React.useState('initial');
      React.useEffect(() => { gate.promise.then(setValue); }, []);
      return [value, setValue];
    });
    await settle(gate, 'resolved'); expect(hook.result.current[0]).toBe('resolved');
    act(() => { setTimeout(() => hook.result.current[1]('timer'), 2000); });
    await tick(1999); expect(hook.result.current[0]).toBe('resolved');
    await tick(1); expect(hook.result.current[0]).toBe('timer'); hook.unmount();
  } finally { jest.useRealTimers(); }
});
