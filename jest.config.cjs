/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(spec|test).[jt]s'],
  transform: {
    '^.+\\.tsx?$': 'babel-jest',
  },
};
