import { BatsParser } from '../bats.js';

describe('BatsParser', () => {
  let parser: BatsParser;
  
  beforeEach(() => {
    parser = new BatsParser();
  });
  
  it('should parse test output with all passing tests', () => {
    const stdout = `1..3
ok 1 first test
ok 2 second test
ok 3 third test`;
    
    const result = parser.parse(stdout, '');
    
    expect(result.framework).toBe('bats');
    expect(result.tests).toHaveLength(3);
    expect(result.summary.total).toBe(3);
    expect(result.summary.passed).toBe(3);
    expect(result.summary.failed).toBe(0);
    
    expect(result.tests[0].name).toBe('first test');
    expect(result.tests[0].passed).toBeTruthy();
    expect(result.tests[1].name).toBe('second test');
    expect(result.tests[1].passed).toBeTruthy();
    expect(result.tests[2].name).toBe('third test');
    expect(result.tests[2].passed).toBeTruthy();
  });
  
  it('should parse test output with failing tests', () => {
    const stdout = `1..3
ok 1 first test
not ok 2 second test
# (in test file test.bats, line 20)
#   \`[ "$output" = "expected output" ]' failed
ok 3 third test`;
    
    const result = parser.parse(stdout, '');
    
    expect(result.framework).toBe('bats');
    expect(result.tests).toHaveLength(3);
    expect(result.summary.total).toBe(3);
    expect(result.summary.passed).toBe(2);
    expect(result.summary.failed).toBe(1);
    
    expect(result.tests[0].name).toBe('first test');
    expect(result.tests[0].passed).toBeTruthy();
    expect(result.tests[1].name).toBe('second test');
    expect(result.tests[1].passed).toBeFalsy();
    expect(result.tests[1].output).toContain('(in test file test.bats, line 20)');
    expect(result.tests[1].output).toContain('\`[ "$output" = "expected output" ]\' failed');
    expect(result.tests[2].name).toBe('third test');
    expect(result.tests[2].passed).toBeTruthy();
  });
  
  it('should parse test output with setup and teardown', () => {
    const stdout = `1..2
# setup
# running test
ok 1 first test
# running test
ok 2 second test
# teardown`;
    
    const result = parser.parse(stdout, '');
    
    expect(result.framework).toBe('bats');
    expect(result.tests).toHaveLength(2);
    expect(result.summary.total).toBe(2);
    expect(result.summary.passed).toBe(2);
    expect(result.summary.failed).toBe(0);
    
    expect(result.tests[0].name).toBe('first test');
    expect(result.tests[0].output).toContain('setup');
    expect(result.tests[0].output).toContain('running test');
  });
  
  it('should handle empty output', () => {
    const result = parser.parse('', '');
    
    expect(result.framework).toBe('bats');
    expect(result.tests).toHaveLength(0);
    expect(result.summary.total).toBe(0);
    expect(result.summary.passed).toBe(0);
    expect(result.summary.failed).toBe(0);
  });
  
  it('should handle stderr as test failure', () => {
    const stdout = '';
    const stderr = 'Error: Command failed with exit code 1';
    
    const result = parser.parse(stdout, stderr);
    
    expect(result.framework).toBe('bats');
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0].name).toBe('Test Execution Error');
    expect(result.tests[0].passed).toBeFalsy();
    expect(result.tests[0].output).toContain('Error: Command failed with exit code 1');
    expect(result.summary.total).toBe(1);
    expect(result.summary.passed).toBe(0);
    expect(result.summary.failed).toBe(1);
  });
});