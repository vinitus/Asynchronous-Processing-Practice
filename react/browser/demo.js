// UI preview and manually controlled API fixtures only; no exercise solutions.
const React = require('react');
const { createRoot } = require('react-dom/client');
const h = React.createElement;
const { CarSearch } = require('../01. Effect Race Condition');
const { ProductList } = require('../02. Product List');
const { UploadList } = require('../03. Upload Manager');
const { DeliveryStatus } = require('../04. Delivery Polling');
const { ProjectDashboard } = require('../05. Project Dashboard');
const { LargeDataProcessor, createProcessingTask } = require('../06. Responsive Processor');
const input = Array.from({ length: 5_000_000 }, (_, i) => i % 100);
const choices = ['Car search', 'Product list', 'Uploads', 'Delivery', 'Dashboard', 'Processor'];

function Demo() {
  const [selected, setSelected] = React.useState(choices[0]);
  const [mounted, setMounted] = React.useState(true);
  const [requests, setRequests] = React.useState([]);
  const api = React.useMemo(() => {
    const request = (name, args, initial) => new Promise((resolve, reject) => {
      setRequests(rows => [...rows, { id: rows.length, name, args, initial, resolve, reject }]);
    });
    return {
      fetchApi: (url) => request(url, [], { ok: true, status: 200, cars: ['EV'] }).then(value => ({ ...value, json: async () => value.cars })),
      fetchProducts: conditions => request('products', [conditions], { items: ['camera'], total: 42 }),
      upload: (file, options) => request(`upload ${file.name}`, [], 'uploaded'),
      fetchStatus: () => request('delivery', [], 'IN_TRANSIT'),
      dashboard: Object.fromEntries(['listProjects', 'deployment', 'build', 'incidents', 'owner', 'failedLogs', 'deploymentOwner'].map(name => [name,
        (...args) => request(name, args, name === 'listProjects' ? [{ id: 'alpha' }, { id: 'beta' }] : name === 'build' ? { status: 'failed' } : `${name} data`)])),
    };
  }, []);
  const previews = {
    'Car search': h(CarSearch, { fetchApi: api.fetchApi }),
    'Product list': h(ProductList, { fetchProducts: api.fetchProducts }),
    Uploads: h(UploadList, { upload: api.upload }),
    Delivery: h(DeliveryStatus, { fetchStatus: api.fetchStatus }),
    Dashboard: h(ProjectDashboard, { api: api.dashboard }),
    Processor: h(LargeDataProcessor, { createTask: createProcessingTask, input }),
  };
  return h(React.Fragment, null,
    h('h1', null, 'React practice'),
    h('p', null, 'Starter controls render before implementation. Async behavior is TODO. Resolve requests below in any order after implementing a hook.'),
    h('label', null, 'Exercise', h('select', { value: selected, onChange: e => setSelected(e.target.value) },
      choices.map(value => h('option', { key: value }, value)))),
    h('button', { onClick: () => setMounted(value => !value) }, 'Mount / Unmount'),
    mounted && h('main', { key: selected }, previews[selected]),
    h('h2', null, 'Mock requests (cancellation intentionally ignored)'),
    requests.map(row => h(RequestControl, { key: row.id, row })));
}
function RequestControl({ row }) {
  const [text, setText] = React.useState(JSON.stringify(row.initial));
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState('');
  function resolve() {
    try { const value = JSON.parse(text); row.resolve(value); setDone(true); setError(''); }
    catch { setError('Enter valid JSON'); }
  }
  return h('fieldset', { disabled: done },
    h('legend', null, `${row.id}: ${row.name} ${JSON.stringify(row.args)}`),
    h('label', null, 'Response JSON', h('textarea', { value: text, onChange: e => setText(e.target.value) })),
    h('button', { onClick: resolve }, 'Resolve'),
    h('button', { onClick: () => { row.reject(Object.assign(new Error('network failure'), { retryable: true })); setDone(true); } }, 'Reject'),
    error && h('p', { role: 'alert' }, error));
}
createRoot(document.getElementById('root')).render(h(Demo));
