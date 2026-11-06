const React = require('react');
const h = React.createElement;

function useProductList(fetchProducts) {
  // TODO: 조건 변경, 요청, 최신성, 새로고침 및 정리를 구현하세요.
  return {
    items: [], total: 0, loading: false, error: null,
    conditions: { category: '', status: '', sort: 'name', page: 1 },
    setFilters() {}, setPage() {}, refresh() {},
  };
}

function ProductList({ fetchProducts }) {
  const state = useProductList(fetchProducts);
  const select = (label, key, values) => h('label', { key }, label,
    h('select', { value: state.conditions[key], onChange: e => state.setFilters({ [key]: e.target.value }) },
      values.map(value => h('option', { key: value, value }, value || 'All'))));
  return h('section', { 'aria-label': 'Products' },
    select('Category', 'category', ['', 'clothing', 'electronics']),
    select('Sale status', 'status', ['', 'sale', 'hidden']),
    select('Sort', 'sort', ['name', 'price']),
    h('p', { 'aria-label': 'Page' }, String(state.conditions.page)),
    h('button', { onClick: () => state.setPage(state.conditions.page + 1) }, 'Next page'),
    h('button', { onClick: state.refresh }, 'Refresh'),
    h('p', { role: 'status' }, state.loading ? 'Loading' : 'Idle'),
    state.error && h('p', { role: 'alert' }, state.error.message),
    h('p', { 'aria-label': 'Total' }, String(state.total)),
    h('ul', { 'aria-label': 'Product items' }, state.items.map((item, i) => h('li', { key: i }, item))));
}
module.exports = { useProductList, ProductList };
