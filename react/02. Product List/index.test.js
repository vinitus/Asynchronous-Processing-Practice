/** @jest-environment jsdom */
const { renderHook, act, render, screen } = require('@testing-library/react');
const React = require('react');
const { deferred, settle } = require('../helpers.cjs');
const { useProductList, ProductList } = require('./index');

test('1–5: filter/page reset, atomic response and stale failures', async () => {
  const a = deferred(), b = deferred(), c = deferred();
  const api = jest.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise).mockReturnValueOnce(c.promise);
  const { result } = renderHook(() => useProductList(api));
  expect(result.current.conditions).toEqual({ category: '', status: '', sort: 'name', page: 1 });
  act(() => result.current.setPage(2));
  expect(api.mock.calls[1][0].page).toBe(2);
  act(() => result.current.setFilters({ category: 'electronics', status: 'sale', sort: 'price' }));
  expect(result.current.conditions).toEqual({ category: 'electronics', status: 'sale', sort: 'price', page: 1 });
  expect(api.mock.calls[2][0]).toEqual(result.current.conditions);
  expect(result.current.loading).toBe(true);
  await settle(c, { items: ['camera'], total: 21 });
  await settle(b, new Error('old'), true); await settle(a, { items: ['old'], total: 999 });
  expect(result.current).toMatchObject({ items: ['camera'], total: 21, loading: false, error: null });
});

test('3,6: sort resets page and refresh repeats unchanged conditions with new identity', async () => {
  const gates = Array.from({ length: 5 }, deferred); let n = 0;
  const api = jest.fn(() => gates[n++].promise);
  const { result } = renderHook(() => useProductList(api));
  act(() => result.current.setPage(3));
  act(() => result.current.setFilters({ sort: 'price' }));
  expect(result.current.conditions.page).toBe(1);
  act(() => result.current.refresh()); act(() => result.current.refresh());
  expect(api).toHaveBeenCalledTimes(5);
  expect(api.mock.calls[3][0]).toEqual(api.mock.calls[4][0]);
  await settle(gates[4], { items: ['latest'], total: 1 });
  await settle(gates[3], { items: ['stale'], total: 100 });
  expect(result.current.items).toEqual(['latest']); expect(result.current.total).toBe(1);
});

test('4,7: latest errors retain data, refresh clears errors, late unmounted rejection handled', async () => {
  const a = deferred(), b = deferred(), c = deferred();
  const api = jest.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise).mockReturnValueOnce(c.promise);
  const { result, unmount } = renderHook(() => useProductList(api));
  await settle(a, { items: ['saved'], total: 7 }); act(() => result.current.refresh());
  const error = new Error('failed'); await settle(b, error, true);
  expect(result.current).toMatchObject({ items: ['saved'], total: 7, error, loading: false });
  act(() => result.current.refresh()); expect(result.current.error).toBeNull();
  unmount(); await settle(c, error, true);
});

test('component exposes loaded data and total', async () => {
  const gate = deferred(); render(React.createElement(ProductList, { fetchProducts: () => gate.promise }));
  await settle(gate, { items: ['camera'], total: 42 });
  expect(screen.getByText(/camera/)).toBeTruthy(); expect(screen.getByText(/42/)).toBeTruthy();
});
