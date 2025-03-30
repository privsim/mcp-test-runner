import { GoParser } from '../go.js';

describe('GoParser', () => {
  const parser = new GoParser();

  it('should parse successful test output', () => {
    const stdout = `=== RUN   TestAdd
--- PASS: TestAdd (0.00s)
=== RUN   TestString
--- PASS: TestString (0.00s)
PASS
ok      github.com/example/pkg      0.007s
`;
    const stderr = '';

    const result = parser.parse(stdout, stderr);

    expect(result.framework).toBe('go');
    expect(result.summary.total).toBe(2);
    expect(result.summary.passed).toBe(2);
    expect(result.summary.failed).toBe(0);
    expect(result.tests.length).toBe(2);
    expect(result.tests[0].name).toBe('TestAdd');
    expect(result.tests[0].passed).toBeTruthy();
    expect(result.tests[1].name).toBe('TestString');
    expect(result.tests[1].passed).toBeTruthy();
  });

  it('should parse failed test output', () => {
    const stdout = `=== RUN   TestAdd
--- PASS: TestAdd (0.00s)
=== RUN   TestFail
--- FAIL: TestFail (0.00s)
    basic_test.go:15: Expected 2 + 2 to equal 5
FAIL
exit status 1
FAIL    github.com/example/pkg      0.007s
`;
    const stderr = '';

    const result = parser.parse(stdout, stderr);

    expect(result.framework).toBe('go');
    expect(result.summary.total).toBe(2);
    expect(result.summary.passed).toBe(1);
    expect(result.summary.failed).toBe(1);
    expect(result.tests.length).toBe(2);
    expect(result.tests[0].name).toBe('TestAdd');
    expect(result.tests[0].passed).toBeTruthy();
    expect(result.tests[1].name).toBe('TestFail');
    expect(result.tests[1].passed).toBeFalsy();
    expect(result.tests[1].output.some(line => line.includes('Expected 2 + 2 to equal 5'))).toBeTruthy();
  });

  it('should capture test output', () => {
    const stdout = `=== RUN   TestWithOutput
some test output
--- PASS: TestWithOutput (0.00s)
PASS
ok      github.com/example/pkg      0.007s
`;
    const stderr = '';

    const result = parser.parse(stdout, stderr);

    expect(result.framework).toBe('go');
    expect(result.tests.length).toBe(1);
    expect(result.tests[0].name).toBe('TestWithOutput');
    expect(result.tests[0].output).toContain('some test output');
  });

  it('should handle compilation errors', () => {
    const stdout = '';
    const stderr = `# github.com/example/pkg
./test.go:10:13: undefined: foo
FAIL    github.com/example/pkg [build failed]
`;

    const result = parser.parse(stdout, stderr);

    expect(result.framework).toBe('go');
    expect(result.summary.total).toBe(1);
    expect(result.summary.passed).toBe(0);
    expect(result.summary.failed).toBe(1);
    expect(result.tests.length).toBe(1);
    expect(result.tests[0].name).toBe('Compilation Error');
    expect(result.tests[0].passed).toBeFalsy();
    expect(result.tests[0].output.some(line => line.includes('undefined: foo'))).toBeTruthy();
  });

  it('should handle empty output', () => {
    const result = parser.parse('', '');
    
    expect(result.framework).toBe('go');
    expect(result.tests).toHaveLength(0);
    expect(result.summary.total).toBe(0);
    expect(result.summary.passed).toBe(0);
    expect(result.summary.failed).toBe(0);
  });
});
