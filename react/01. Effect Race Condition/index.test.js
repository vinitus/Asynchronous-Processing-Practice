/** @jest-environment jsdom */
const { renderHook } = require('@testing-library/react');
const { deferred, settle } = require('../helpers.cjs');
const { useCarSearch } = require('./index');
const response = (cars) => ({ ok: true, status: 200, json: jest.fn().mockResolvedValue(cars) });

test('1,4,5: encodes URI, loads and displays latest cars', async () => {
  const gate = deferred(); const api = jest.fn(() => gate.promise);
  const { result } = renderHook(() => useCarSearch('SUV & 전기차', api));
  expect(api.mock.calls[0][0]).toBe(`/api/cars?q=${encodeURIComponent('SUV & 전기차')}`);
  expect(result.current.loading).toBe(true);
  await settle(gate, response(['EV']));
  expect(result.current).toMatchObject({ cars: ['EV'], loading: false, error: null });
});

test.each([false, true])('1–4: stale success/failure ignored while latest pending and after success (%s)', async (reject) => {
  const old = deferred(), latest = deferred(), last = deferred();
  const api = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise).mockReturnValueOnce(last.promise);
  const { result, rerender } = renderHook(({ q }) => useCarSearch(q, api), { initialProps: { q: 'a' } });
  rerender({ q: 'b' });
  await settle(old, reject ? new Error('old') : response(['old']), reject);
  expect(result.current).toMatchObject({ cars: [], loading: true, error: null });
  rerender({ q: 'c' });
  await settle(last, response(['new']));
  await settle(latest, reject ? new Error('stale') : response(['stale']), reject);
  expect(result.current).toMatchObject({ cars: ['new'], loading: false, error: null });
});

test('6: HTTP failure does not parse JSON; new query clears error', async () => {
  const a = deferred(), b = deferred(); const json = jest.fn();
  const api = jest.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
  const { result, rerender } = renderHook(({ q }) => useCarSearch(q, api), { initialProps: { q: 'a' } });
  await settle(a, { ok: false, status: 503, json });
  expect(result.current.error).toBeInstanceOf(Error); expect(json).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);
  rerender({ q: 'b' }); expect(result.current.error).toBeNull();
  const error = new Error('offline'); await settle(b, error, true);
  expect(result.current.error).toBe(error);
});

test('2,7: invalidates delayed JSON on empty input and unmount; catches late rejection', async () => {
  const json = deferred(), late = deferred();
  const api = jest.fn().mockResolvedValueOnce({ ok: true, json: () => json.promise }).mockReturnValueOnce(late.promise);
  const { result, rerender, unmount } = renderHook(({ q }) => useCarSearch(q, api), { initialProps: { q: 'a' } });
  await require('@testing-library/react').act(async () => {});
  rerender({ q: '' }); await settle(json, ['old']);
  expect(api).toHaveBeenCalledTimes(1);
  expect(result.current).toMatchObject({ cars: [], loading: false, error: null });
  rerender({ q: 'b' }); unmount(); await settle(late, new Error('late'), true);
});

test.each([false, true])('UI: query input, loading and latest result survive stale completion (%s)', async (fail) => {
  const React = require('react');
  const { render, screen, fireEvent, within } = require('@testing-library/react');
  const { CarSearch } = require('./index');
  const old = deferred(), latest = deferred();
  const api = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  render(React.createElement(CarSearch, { fetchApi: api }));
  expect(api).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'SUV' } });
  expect(screen.getByRole('status').textContent).toBe('Loading');
  fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'SUV & 전기차' } });
  expect(api.mock.calls[1][0]).toBe(`/api/cars?q=${encodeURIComponent('SUV & 전기차')}`);
  await settle(latest, response(['new EV']));
  await settle(old, fail ? new Error('obsolete') : response(['old SUV']), fail);
  expect(within(screen.getByRole('list', { name: 'Cars' })).getByText('new EV')).toBeTruthy();
  expect(screen.queryByText('old SUV')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('status').textContent).toBe('Idle');
});

test('UI: failed HTTP response displays error; clearing query resets the screen', async () => {
  const React = require('react');
  const { render, screen, fireEvent } = require('@testing-library/react');
  const { CarSearch } = require('./index');
  const gate = deferred(); const api = jest.fn(() => gate.promise);
  render(React.createElement(CarSearch, { fetchApi: api }));
  fireEvent.change(screen.getByLabelText('Query'), { target: { value: 'car' } });
  await settle(gate, { ok: false, status: 503, json: jest.fn() });
  expect(screen.getByRole('alert').textContent.length).toBeGreaterThan(0);
  expect(screen.getByRole('status').textContent).toBe('Idle');
  fireEvent.change(screen.getByLabelText('Query'), { target: { value: '' } });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('list', { name: 'Cars' }).children).toHaveLength(0);
  expect(api).toHaveBeenCalledTimes(1);
});
