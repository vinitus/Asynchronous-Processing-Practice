const React = require('react');
const h = React.createElement;

function useProjectDashboard(api) {
  // TODO: 의존 요청, 전역 동시성, 부분 결과, 요약 및 정리를 구현하세요.
  return { projects: [], loading: false, error: null, summary: null };
}

function ProjectDashboard({ api }) {
  const { projects, loading, error, summary } = useProjectDashboard(api);
  return h('section', { 'aria-label': 'Project dashboard' },
    h('p', { role: 'status' }, loading ? 'Loading' : 'Idle'),
    error && h('p', { role: 'alert' }, error.message),
    h('pre', { 'aria-label': 'Dashboard summary' }, summary ? JSON.stringify(summary) : 'Pending'),
    projects.map(project => h('article', { key: project.id, 'aria-label': String(project.id) },
      h('h2', null, String(project.id)),
      Object.entries(project.sections).map(([name, section]) => h('div', { key: name, 'aria-label': name },
        h('h3', null, name), h('span', null, section.status),
        section.status === 'success' && h('pre', null, typeof section.data === 'string' ? section.data : JSON.stringify(section.data)),
        section.error && h('p', { role: 'alert' }, section.error.message))))));
}
module.exports = { useProjectDashboard, ProjectDashboard };
