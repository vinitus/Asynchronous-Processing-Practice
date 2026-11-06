/** @jest-environment jsdom */
const { renderHook, act } = require('@testing-library/react');
const { deferred, settle, tick, retryable } = require('../helpers.cjs');
const { useDeliveryPolling } = require('./index');
beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

test('1–7: no overlap, exponential failure delay, success reset, delivered stops', async () => {
  const gates = Array.from({ length: 5 }, deferred); let n = 0;
  const api = jest.fn(() => gates[n++].promise);
  const { result } = renderHook(() => useDeliveryPolling(api));
  expect(result.current.loading).toBe(true); await tick(20000); expect(api).toHaveBeenCalledTimes(1);
  await settle(gates[0], retryable(), true); expect(result.current.error).toBeInstanceOf(Error);
  expect(result.current.loading).toBe(false);
  await tick(3999); expect(api).toHaveBeenCalledTimes(1); await tick(1);
  await settle(gates[1], retryable(), true); await tick(7999); expect(api).toHaveBeenCalledTimes(2); await tick(1);
  await settle(gates[2], 'IN_TRANSIT'); expect(result.current.error).toBeNull();
  await tick(1999); expect(api).toHaveBeenCalledTimes(3); await tick(1);
  await settle(gates[3], 'DELIVERED'); await tick(100000);
  expect(api).toHaveBeenCalledTimes(4); expect(result.current).toMatchObject({ status: 'DELIVERED', stopped: true, loading: false });
});

test.each([false, true])('8,9: stop clears timer or invalidates active response (%s)', async (pending) => {
  const gate = deferred(); const api = jest.fn(() => gate.promise);
  const { result } = renderHook(() => useDeliveryPolling(api));
  if (!pending) await settle(gate, 'READY');
  act(() => result.current.stop());
  if (pending) await settle(gate, 'DELIVERED');
  expect(result.current).toMatchObject({ stopped: true, loading: false, status: pending ? null : 'READY' });
  await tick(100000); expect(api).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
});

test('3,8: terminal error stops; unmount clears timers and handles late rejection', async () => {
  const a = deferred(); const api = jest.fn(() => a.promise);
  const hook = renderHook(() => useDeliveryPolling(api));
  await settle(a, new Error('forbidden'), true); expect(hook.result.current.stopped).toBe(true);
  await tick(100000); expect(api).toHaveBeenCalledTimes(1); hook.unmount();
  const b = deferred(); const secondApi = () => b.promise;
  const second = renderHook(() => useDeliveryPolling(secondApi));
  second.unmount(); await settle(b, retryable(), true); expect(jest.getTimerCount()).toBe(0);
});

test('component renders status and error information', async () => {
  const React = require('react'); const { render, screen } = require('@testing-library/react');
  const { DeliveryStatus } = require('./index');
  const a = deferred(), b = deferred(); const api = jest.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  render(React.createElement(DeliveryStatus, { fetchStatus: api }));
  await settle(a, 'IN_TRANSIT'); expect(screen.getByText(/IN_TRANSIT/)).toBeTruthy();
  await tick(2000); await settle(b, new Error('network unavailable'), true);
  expect(screen.getByText(/network unavailable/)).toBeTruthy();
});
