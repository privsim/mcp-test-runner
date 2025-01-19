export default {
  transform: {
    '^.+\\.(t|j)sx?$': '@swc/jest'
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx', '.jsx'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/build/'],
  globalTeardown: './test/teardown.js'
}
