const React = require('react');
const h = React.createElement;

function useDeliveryPolling(fetchStatus) {
  // TODO: 조회, 중복 방지, backoff, 중지 및 정리를 구현하세요.
  return { status: null, loading: false, error: null, stopped: false, stop() {} };
}

function DeliveryStatus({ fetchStatus }) {
  const { status, loading, error, stopped, stop } = useDeliveryPolling(fetchStatus);
  return h('section', { 'aria-label': 'Delivery' },
    h('p', { 'aria-label': 'Delivery status' }, status || 'Unknown'),
    h('p', { role: 'status' }, loading ? 'Loading' : stopped ? 'Stopped' : 'Waiting'),
    error && h('p', { role: 'alert' }, error.message),
    h('button', { onClick: stop, disabled: stopped }, 'Stop'));
}
module.exports = { useDeliveryPolling, DeliveryStatus };
