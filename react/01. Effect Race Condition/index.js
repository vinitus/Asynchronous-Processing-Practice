const React = require('react');
const h = React.createElement;

function useCarSearch(query, fetchApi) {
  // TODO: 요청, 최신성, HTTP 오류, loading 및 정리를 구현하세요.
  return { cars: [], loading: false, error: null };
}

function CarSearch({ fetchApi }) {
  const [query, setQuery] = React.useState('');
  const { cars, loading, error } = useCarSearch(query, fetchApi);
  return h('section', { 'aria-label': 'Car search' },
    h('label', null, 'Query', h('input', { value: query, onChange: e => setQuery(e.target.value) })),
    h('p', { role: 'status' }, loading ? 'Loading' : 'Idle'),
    error && h('p', { role: 'alert' }, error.message),
    h('ul', { 'aria-label': 'Cars' }, cars.map((car, i) => h('li', { key: i }, car))));
}
module.exports = { useCarSearch, CarSearch };
