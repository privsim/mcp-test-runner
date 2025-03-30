import { RustParser } from '../rust.js';

describe('RustParser', () => {
  const parser = new RustParser();

  it('should parse successful test output', () => {
    const stdout = `
    Running tests/test_basic.rs
    
    running 3 tests
    test test_addition ... ok
    test test_subtraction ... ok
    test test_multiplication ... ok
    
    test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
    `;
    const stderr = '';

    const result = parser.parse(stdout, stderr);

    expect(result.framework).toBe('rust');
    expect(result.summary.total).toBe(3);
    expect(result.summary.passed).toBe(3);
    expect(result.summary.failed).toBe(0);
    expect(result.tests.length).toBe(3);
    expect(result.tests[0].name).toBe('test_addition');
    expect(result.tests[0].passed).toBeTruthy();
  });

  it('should parse failed test output', () => {
    const stdout = `
    Running tests/test_basic.rs
    
    running 3 tests
    test test_addition ... ok
    test test_subtraction ... FAILED
    test test_multiplication ... ok
    
    failures:
    
    ---- test_subtraction ----
    thread 'test_subtraction' panicked at 'assertion failed: \`(left == right)\`
      left: \`1\`,
      right: \`0\`', tests/test_basic.rs:14:5
    note: run with \`RUST_BACKTRACE=1\` environment variable to display a backtrace
    
    
    failures:
        test_subtraction
    
    test result: FAILED. 2 passed; 1 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.01s
    `;
    const stderr = '';

    const result = parser.parse(stdout, stderr);

    expect(result.framework).toBe('rust');
    expect(result.summary.total).toBe(3);
    expect(result.summary.passed).toBe(2);
    expect(result.summary.failed).toBe(1);
    expect(result.tests.length).toBe(3);
    expect(result.tests[1].name).toBe('test_subtraction');
    expect(result.tests[1].passed).toBeFalsy();
    expect(result.tests[1].output.length).toBeGreaterThan(1);
    expect(result.tests[1].output.some(line => line.includes('assertion failed'))).toBeTruthy();
  });

  it('should parse compilation error output', () => {
    const stdout = '';
    const stderr = `
    error[E0425]: cannot find value \`undefinedVar\` in this scope
      --> src/lib.rs:5:13
       |
    5  |     println!("{}", undefinedVar);
       |                    ^^^^^^^^^^^^ not found in this scope
    
    error: could not compile \`myproject\` due to previous error
    `;

    const result = parser.parse(stdout, stderr);

    expect(result.framework).toBe('rust');
    expect(result.summary.total).toBe(1);
    expect(result.summary.passed).toBe(0);
    expect(result.summary.failed).toBe(1);
    expect(result.tests.length).toBe(1);
    expect(result.tests[0].name).toBe('Compilation Error');
    expect(result.tests[0].passed).toBeFalsy();
    expect(result.tests[0].output.some(line => line.includes('error[E0425]'))).toBeTruthy();
  });

  it('should parse ignored tests', () => {
    const stdout = `
    Running tests/test_basic.rs
    
    running 4 tests
    test test_addition ... ok
    test test_ignored ... ignored
    test test_subtraction ... ok
    test test_multiplication ... ok
    
    test result: ok. 3 passed; 0 failed; 1 ignored; 0 measured; 0 filtered out; finished in 0.01s
    `;
    const stderr = '';

    const result = parser.parse(stdout, stderr);

    expect(result.framework).toBe('rust');
    expect(result.summary.total).toBe(3); // Ignored tests don't count in total
    expect(result.summary.passed).toBe(3);
    expect(result.summary.failed).toBe(0);
    expect(result.tests.length).toBe(3); // Should not include the ignored test
    expect(result.tests.some(t => t.name === 'test_ignored')).toBeFalsy();
  });
});
