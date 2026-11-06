// Browser harness only. Implement exercise 06 before starting the demo.
const React = require('react');
const { createRoot } = require('react-dom/client');
const { LargeDataProcessor, createProcessingTask } = require('../06. Responsive Processor');
const input = Array.from({ length: 5_000_000 }, (_, i) => i % 100);
function Demo() {
  const [mounted, setMounted] = React.useState(true);
  return React.createElement(React.Fragment, null,
    React.createElement('button', { onClick: () => setMounted(value => !value) }, 'Mount / Unmount'),
    mounted && React.createElement(LargeDataProcessor, { createTask: createProcessingTask, input }));
}
createRoot(document.getElementById('root')).render(React.createElement(Demo));
