import { JestParser } from '../jest.js';

describe('JestParser', () => {
  let parser: JestParser;
  
  beforeEach(() => {
    parser = new JestParser();
  });
  
  it('should parse test output with all passing tests', () => {
    const stdout = `PASS src/example.test.js
  Example Suite
    ✓ first test (2ms)
    ✓ second test (1ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        0.5s
Ran all test suites.`;
    
    const result = parser.parse(stdout, '');
    
    expect(result.framework).toBe('jest');
    expect(result.tests).toHaveLength(2);
    expect(result.summary.total).toBe(2);
    expect(result.summary.passed).toBe(2);
    expect(result.summary.failed).toBe(0);
    
    expect(result.tests[0].name).toBe('first test');
    expect(result.tests[0].passed).toBeTruthy();
    expect(result.tests[1].name).toBe('second test');
    expect(result.tests[1].passed).toBeTruthy();
  });
  
  it('should parse test output with failing tests', () => {
    const stdout = `FAIL src/example.test.js
  Example Suite
    ✓ first test (2ms)
    ✕ second test (1ms)
      Expected: true
      Received: false

Test Suites: 1 failed, 1 total
Tests:       1 passed, 1 failed, 2 total
Snapshots:   0 total
Time:        0.5s
Ran all test suites.`;
    
    const result = parser.parse(stdout, '');
    
    expect(result.framework).toBe('jest');
    expect(result.tests).toHaveLength(2);
    expect(result.summary.total).toBe(2);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.failed).toBe(1);
    
    expect(result.tests[0].name).toBe('first test');
    expect(result.tests[0].passed).toBeTruthy();
    expect(result.tests[1].name).toBe('second test');
    expect(result.tests[1].passed).toBeFalsy();
    expect(result.tests[1].output).toContain('Expected: true');
    expect(result.tests[1].output).toContain('Received: false');
  });
  
  it('should handle test output with console logs', () => {
    const stdout = `PASS src/example.test.js
  Example Suite
    ✓ test with logs (3ms)
      console.log
        This is a log message
        at Object.<anonymous> (src/example.test.js:5:9)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        0.5s
Ran all test suites.`;
    
    const result = parser.parse(stdout, '');
    
    expect(result.framework).toBe('jest');
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0].name).toBe('test with logs');
    expect(result.tests[0].output).toContain('console.log');
    expect(result.tests[0].output).toContain('This is a log message');
  });
  
  it('should handle empty output', () => {
    const result = parser.parse('', '');
    
    expect(result.framework).toBe('jest');
    expect(result.tests).toHaveLength(0);
    expect(result.summary.total).toBe(0);
    expect(result.summary.passed).toBe(0);
    expect(result.summary.failed).toBe(0);
  });
  
  it('should handle stderr as test failure', () => {
    const stdout = '';
    const stderr = 'Error: Jest failed to run tests';
    
    const result = parser.parse(stdout, stderr);
    
    expect(result.framework).toBe('jest');
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0].name).toBe('Test Execution Error');
    expect(result.tests[0].passed).toBeFalsy();
    expect(result.tests[0].output).toContain('Error: Jest failed to run tests');
    expect(result.summary.total).toBe(1);
    expect(result.summary.passed).toBe(0);
    expect(result.summary.failed).toBe(1);
  });
});