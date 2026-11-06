/** @jest-environment jsdom */
const { renderHook } = require('@testing-library/react');
const { deferred, settle } = require('../helpers.cjs');
const { useProjectDashboard } = require('./index');
function fixture() {
  const calls = []; let active = 0, peak = 0;
  const api = Object.fromEntries(['listProjects', 'deployment', 'build', 'incidents', 'owner', 'failedLogs', 'deploymentOwner'].map(name => [name,
    jest.fn((...args) => {
      const gate = deferred(); active++; peak = Math.max(peak, active);
      calls.push({ name, args, gate, done: false });
      return gate.promise.finally(() => active--);
    })]));
  async function finish(call, value, reject = false) {
    expect(call).toBeDefined(); call.done = true; await settle(call.gate, value, reject);
  }
  return { api, calls, finish, peak: () => peak };
}

test('1–9: dependencies, parallel details, global cap, progressive results and partial failure summary', async () => {
  const f = fixture(); const { result } = renderHook(() => useProjectDashboard(f.api));
  expect(f.calls.map(c => c.name)).toEqual(['listProjects']);
  await f.finish(f.calls[0], [{ id: 'a' }, { id: 'b' }]);
  expect(f.calls).toHaveLength(6); // all five available slots start without waiting for unrelated work
  expect(f.calls.slice(1).every(c => ['deployment', 'build', 'incidents', 'owner'].includes(c.name))).toBe(true);
  // Resolve whichever ready tasks the implementation schedules, without imposing queue order.
  let seenProgress = false;
  for (let step = 0; step < 20 && f.calls.some(c => !c.done); step++) {
    const call = f.calls.find(c => !c.done);
    const id = call.args[0];
    if (call.name === 'failedLogs') {
      expect(id).toBe('a'); expect(call.args[1]).toEqual({ status: 'failed' });
      expect(result.current.projects.find(p => p.id === id).sections.build.status).toBe('success');
    }
    if (call.name === 'deploymentOwner') {
      expect(call.args.slice(1, 3)).toEqual([`deployment-${id}`, `owner-${id}`]);
    }
    const fail = call.name === 'incidents' && id === 'a';
    const value = fail ? new Error('incidents unavailable') : call.name === 'build' ? { status: id === 'a' ? 'failed' : 'success' } : `${call.name}-${id}`;
    await f.finish(call, value, fail);
    const sections = result.current.projects.flatMap(p => Object.values(p.sections));
    if (result.current.loading && sections.some(s => s.status === 'success')) seenProgress = true;
  }
  expect(seenProgress).toBe(true); expect(f.peak()).toBeLessThanOrEqual(5);
  expect(f.api.failedLogs).toHaveBeenCalledTimes(1); expect(f.api.deploymentOwner).toHaveBeenCalledTimes(2);
  expect(result.current).toMatchObject({ loading: false, error: null, summary: { success: 10, failed: 1, skipped: 1 } });
  expect(result.current.projects.find(p => p.id === 'a').sections.incidents.error).toBeInstanceOf(Error);
});

test('5: failed build and dependency suppress downstream requests', async () => {
  const f = fixture(); const { result } = renderHook(() => useProjectDashboard(f.api));
  await f.finish(f.calls[0], [{ id: 'a' }]);
  for (const call of f.calls.slice(1)) await f.finish(call, new Error('failed'), true);
  expect(f.api.failedLogs).not.toHaveBeenCalled(); expect(f.api.deploymentOwner).not.toHaveBeenCalled();
  expect(result.current.summary).toEqual({ success: 0, failed: 4, skipped: 2 });
});

test.each([false, true])('list failure or empty list completes (%s)', async (fail) => {
  const gate = deferred(); const error = new Error('list');
  const api = { listProjects: () => gate.promise };
  const { result } = renderHook(() => useProjectDashboard(api));
  await settle(gate, fail ? error : [], fail); expect(result.current.loading).toBe(false);
  if (fail) expect(result.current.error).toBe(error);
  else expect(result.current.summary).toEqual({ success: 0, failed: 0, skipped: 0 });
});

test('10: unmount prevents queued work and consumes active rejections', async () => {
  const f = fixture(); const { unmount } = renderHook(() => useProjectDashboard(f.api));
  await f.finish(f.calls[0], Array.from({ length: 30 }, (_, id) => ({ id })));
  expect(f.calls).toHaveLength(6); unmount();
  for (const call of f.calls.slice(1)) await f.finish(call, new Error('late'), true);
  expect(f.calls).toHaveLength(6);
});

test('component displays project-specific partial success and errors', async () => {
  const React = require('react'); const { render, screen } = require('@testing-library/react');
  const { ProjectDashboard } = require('./index'); const f = fixture();
  render(React.createElement(ProjectDashboard, { api: f.api }));
  await f.finish(f.calls[0], [{ id: 'project-a' }]);
  for (let i = 0; i < 10 && f.calls.some(c => !c.done); i++) {
    const call = f.calls.find(c => !c.done);
    await f.finish(call, call.name === 'build' ? { status: 'success' } : call.name === 'incidents' ? new Error('incident unavailable') : `${call.name}-visible`, call.name === 'incidents');
  }
  expect(screen.getByText(/project-a/)).toBeTruthy();
  expect(screen.getByText(/deployment-visible/)).toBeTruthy();
  expect(screen.getByText(/incident unavailable/)).toBeTruthy();
});
