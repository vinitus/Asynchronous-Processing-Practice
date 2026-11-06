const React = require('react');
const h = React.createElement;

function LargeDataProcessor({ createTask, input }) {
  const [notes, setNotes] = React.useState('');
  // TODO: 작업 상태, paint 기회, 비동기 작업 연결 및 정리를 구현하세요.
  const loading = false, result = null, error = null;
  function start() { /* TODO */ }
  return h('section', { 'aria-label': 'Data processor' },
    h('button', { onClick: start, disabled: loading }, 'Start'),
    h('label', null, 'Notes', h('input', { value: notes, onChange: e => setNotes(e.target.value) })),
    h('p', { role: 'status' }, loading ? 'Processing' : result === null ? 'Idle' : result),
    error && h('p', { role: 'alert' }, error.message));
}
function createProcessingTask(input) {
  // TODO: 메인 스레드를 독점하지 않는 취소 가능한 합계 계산을 구현하세요.
  throw new Error('Not implemented');
}
module.exports = { LargeDataProcessor, createProcessingTask };
