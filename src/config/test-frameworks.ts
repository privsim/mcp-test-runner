export const frameworkConfigs = {
  bats: {
    setup: 'sudo apt-get install -y bats',
    testCommand: 'bats test/*.bats',
    testFilePattern: '*.bats'
  },
  pytest: {
    setup: 'pip install pytest',
    testCommand: 'python -m pytest',
    testFilePattern: 'test_*.py'
  },
  go: {
    setup: 'go mod init test-runner-tests',
    testCommand: 'go test ./...',
    testFilePattern: '*_test.go'
  },
  jest: {
    setup: 'npm install -g jest',
    testCommand: 'jest',
    testFilePattern: '*.test.js'
  },
  flutter: {
    setup: 'sudo snap install flutter --classic',
    testCommand: 'flutter test',
    testFilePattern: '*_test.dart'
  }
} as const;

export type Framework = keyof typeof frameworkConfigs;

export function isValidFramework(framework: string): framework is Framework {
  return framework in frameworkConfigs;
}

export function getFrameworkConfig(framework: Framework) {
  return frameworkConfigs[framework];
}