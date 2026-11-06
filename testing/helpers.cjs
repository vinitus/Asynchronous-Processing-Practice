// Test controls only: no production behavior is implemented here.
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const turn = () => new Promise((resolve) => setImmediate(resolve));
function watch(promise) {
  if (!promise || typeof promise.then !== 'function') throw new Error('Expected a Promise');
  const result = { status: 'pending' };
  result.done = promise.then(
    (value) => { result.status = 'fulfilled'; result.value = value; },
    (error) => { result.status = 'rejected'; result.error = error; },
  );
  return result;
}
function controlled(names) {
  const gates = Object.fromEntries(names.map((name) => [name, deferred()]));
  const api = Object.fromEntries(names.map((name) => [name, jest.fn(() => gates[name].promise)]));
  return { gates, api };
}
module.exports = { deferred, turn, watch, controlled };
