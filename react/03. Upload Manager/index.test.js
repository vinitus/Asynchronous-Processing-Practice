/** @jest-environment jsdom */
const { renderHook, act } = require('@testing-library/react');
const { deferred, settle, retryable } = require('../helpers.cjs');
const { useUploadManager } = require('./index');
const inputs = (n) => Array.from({ length: n }, (_, id) => ({ id: String(id), file: `file-${id}` }));

test('1,2,7,8: three actual requests, progress, completion, dedup and queue refill', async () => {
  const gates = []; let active = 0, peak = 0;
  const api = jest.fn(() => { const gate = deferred(); gates.push(gate); active++; peak = Math.max(peak, active); return gate.promise.finally(() => active--); });
  const { result } = renderHook(() => useUploadManager(api));
  act(() => result.current.addFiles(inputs(5))); expect(api).toHaveBeenCalledTimes(3);
  act(() => api.mock.calls[0][1].onProgress(45)); expect(result.current.files[0].progress).toBe(45);
  await settle(gates[0], 'url'); expect(api).toHaveBeenCalledTimes(4);
  expect(result.current.files[0]).toMatchObject({ status: 'success', progress: 100, result: 'url', attempts: 1 });
  act(() => result.current.addFiles(inputs(5))); expect(result.current.files).toHaveLength(5);
  await settle(gates[1], 'b'); await settle(gates[2], 'c'); await settle(gates[3], 'd'); await settle(gates[4], 'e');
  expect(peak).toBeLessThanOrEqual(3); expect(result.current.summary).toMatchObject({ total: 5, success: 5, uploading: 0, queued: 0 });
});

test('3–5: retry network twice, terminal failure does not stop other files', async () => {
  const gates = Array.from({ length: 5 }, deferred); let n = 0;
  const api = jest.fn(() => gates[n++].promise);
  const { result } = renderHook(() => useUploadManager(api));
  act(() => result.current.addFiles(inputs(2)));
  await settle(gates[0], retryable(), true); await settle(gates[2], retryable(), true); await settle(gates[3], retryable(), true);
  expect(api).toHaveBeenCalledTimes(4);
  expect(result.current.files[0]).toMatchObject({ status: 'failed', attempts: 3 });
  await settle(gates[1], 'ok'); expect(result.current.files[1].status).toBe('success');
  act(() => result.current.addFiles([{ id: 'fatal', file: 'fatal' }]));
  await settle(gates[4], new Error('invalid'), true); expect(api).toHaveBeenCalledTimes(5);
});

test('6,9: cancelling queued/active files keeps actual slot until settlement; unmount stops queue', async () => {
  const gates = []; const api = jest.fn(() => { const d = deferred(); gates.push(d); return d.promise; });
  const { result, unmount } = renderHook(() => useUploadManager(api));
  act(() => result.current.addFiles(inputs(6)));
  const options = api.mock.calls[0][1];
  act(() => { result.current.cancel('0'); result.current.cancel('3'); });
  expect(options.signal.aborted).toBe(true); expect(api).toHaveBeenCalledTimes(3);
  act(() => options.onProgress(90));
  expect(result.current.files[0]).toMatchObject({ status: 'cancelled', progress: 0 });
  await settle(gates[0], retryable(), true); expect(api).toHaveBeenCalledTimes(4);
  expect(api.mock.calls[3][0]).toBe('file-4');
  unmount(); await settle(gates[1], 'late'); await settle(gates[2], retryable(), true); await settle(gates[3], 'late');
  expect(api).toHaveBeenCalledTimes(4);
});

test('component connects file input to upload and renders file progress/status', async () => {
  const React = require('react');
  const { render, screen, fireEvent } = require('@testing-library/react');
  const { UploadList } = require('./index');
  const gate = deferred(); const api = jest.fn(() => gate.promise);
  render(React.createElement(UploadList, { upload: api }));
  const file = new File(['image'], 'car.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Files'), { target: { files: [file] } });
  expect(api.mock.calls[0][0]).toBe(file);
  expect(screen.getByText(/car.png/)).toBeTruthy();
  await settle(gate, 'uploaded');
  expect(require('@testing-library/react').within(screen.getByRole('listitem', { name: 'car.png' })).getByText('success')).toBeTruthy();
});

test('UI: progress, queued/active cancellation, actual concurrency and summary', async () => {
  const React = require('react');
  const { render, screen, fireEvent, within } = require('@testing-library/react');
  const { UploadList } = require('./index');
  const requests = [];
  const api = jest.fn((file, options) => { const gate = deferred(); requests.push({ file, options, gate }); return gate.promise; });
  render(React.createElement(UploadList, { upload: api }));
  const files = Array.from({ length: 5 }, (_, i) => new File(['image'], `${i}.png`, { type: 'image/png' }));
  fireEvent.change(screen.getByLabelText('Files'), { target: { files } });
  expect(requests).toHaveLength(3);
  act(() => requests[0].options.onProgress(45));
  expect(screen.getByRole('progressbar', { name: 'Progress 0.png' }).value).toBe(45);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel 0.png' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel 3.png' }));
  expect(requests[0].options.signal.aborted).toBe(true);
  expect(requests).toHaveLength(3);
  expect(within(screen.getByRole('listitem', { name: '3.png' })).getByText('cancelled')).toBeTruthy();
  await settle(requests[0].gate, new Error('cancelled'), true);
  expect(requests).toHaveLength(4); expect(requests[3].file.name).toBe('4.png');
  for (const request of requests.slice(1)) await settle(request.gate, 'uploaded');
  expect(JSON.parse(screen.getByLabelText('Upload summary').textContent)).toMatchObject({ total: 5, success: 3, cancelled: 2, uploading: 0, queued: 0 });
  expect(screen.getByRole('button', { name: 'Cancel 1.png' }).disabled).toBe(true);
});
