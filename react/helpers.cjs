// Test controls only; no exercise implementation.
const { act } = require('@testing-library/react');
const { deferred } = require('../testing/helpers.cjs');
const settle = (gate, value, reject = false) => act(async () => {
  gate[reject ? 'reject' : 'resolve'](value);
});
const tick = (ms) => act(async () => { jest.advanceTimersByTime(ms); });
const retryable = () => Object.assign(new Error('network'), { retryable: true });
module.exports = { deferred, settle, tick, retryable };
