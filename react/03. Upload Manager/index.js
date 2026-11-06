const React = require('react');
const h = React.createElement;

function useUploadManager(upload) {
  // TODO: 큐, 동시성, 재시도, 진행률, 취소 및 정리를 구현하세요.
  return {
    files: [],
    summary: { total: 0, queued: 0, uploading: 0, success: 0, failed: 0, cancelled: 0 },
    addFiles() {}, cancel() {},
  };
}

function UploadList({ upload }) {
  const { files, summary, addFiles, cancel } = useUploadManager(upload);
  return h('section', { 'aria-label': 'Uploads' },
    h('label', null, 'Files', h('input', { type: 'file', multiple: true, accept: 'image/*',
      onChange: e => {
        addFiles(Array.from(e.target.files, file => ({ id: file.name, file })));
        e.target.value = '';
      } })),
    h('pre', { 'aria-label': 'Upload summary' }, JSON.stringify(summary)),
    h('ul', { 'aria-label': 'Upload files' }, files.map(file => h('li', { key: file.id, 'aria-label': file.id },
      h('span', null, file.id), h('span', null, file.status),
      h('progress', { 'aria-label': `Progress ${file.id}`, max: 100, value: file.progress }),
      h('span', null, `Attempts: ${file.attempts}`),
      file.error && h('span', { role: 'alert' }, file.error.message),
      h('button', { onClick: () => cancel(file.id), disabled: !['queued', 'uploading'].includes(file.status) }, `Cancel ${file.id}`)))));
}
module.exports = { useUploadManager, UploadList };
