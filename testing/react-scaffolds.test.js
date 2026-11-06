/** @jest-environment jsdom */
// The starter UI must render before the learner implements asynchronous behavior.
const React = require('react');
const { render, screen, fireEvent } = require('@testing-library/react');
const pending = () => new Promise(() => {});
const cases = [
  ['01. Effect Race Condition', 'CarSearch', { fetchApi: jest.fn(pending) }, 'Query'],
  ['02. Product List', 'ProductList', { fetchProducts: jest.fn(pending) }, 'Category'],
  ['03. Upload Manager', 'UploadList', { upload: jest.fn(pending) }, 'Files'],
  ['04. Delivery Polling', 'DeliveryStatus', { fetchStatus: jest.fn(pending) }, 'Delivery status'],
  ['05. Project Dashboard', 'ProjectDashboard', { api: { listProjects: pending } }, 'Dashboard summary'],
  ['06. Responsive Processor', 'LargeDataProcessor', { createTask: jest.fn(pending), input: [] }, 'Notes'],
];
test.each(cases)('%s: provided UI mounts without an implemented solution', (folder, name, props, label) => {
  render(React.createElement(require(`../react/${folder}`)[name], props));
  expect(screen.getByLabelText(label)).toBeTruthy();
});
test('processor starter input is editable', () => {
  const { LargeDataProcessor } = require('../react/06. Responsive Processor');
  render(React.createElement(LargeDataProcessor, { createTask: jest.fn(pending), input: [] }));
  fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'notes' } });
  expect(screen.getByLabelText('Notes').value).toBe('notes');
});
