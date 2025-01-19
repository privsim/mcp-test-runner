import { TestRunnerServer } from '../src/index.js';

class TestOnlyRunner extends TestRunnerServer {
  constructor() {
    super();
    // Override server to prevent connection
    this.server = {
      connect: () => Promise.resolve(),
      close: () => Promise.resolve()
    };
  }


  async run() {
    // Override to prevent actual server startup
    return Promise.resolve();
  }

  // Add cleanup method
  async cleanup() {
    if (this.server) {
      await this.server.close();
    }
  }
}


describe('TestRunnerServer', () => {
  let server;

  beforeEach(() => {
    server = new TestOnlyRunner();
  });

  describe('parseTestResults', () => {
    describe('bats parser', () => {
      it('should parse successful bats test output', () => {
        const stdout = `ok 1 basic test
ok 2 another test
`;
        const results = server.parseTestResults('bats', stdout, '');
        expect(results.framework).toBe('bats');
        expect(results.tests).toHaveLength(2);
        expect(results.summary.total).toBe(2);
        expect(results.summary.passed).toBe(2);
        expect(results.summary.failed).toBe(0);
      });

      it('should parse failed bats test output', () => {
        const stdout = `ok 1 passing test
not ok 2 failing test
`;
        const results = server.parseTestResults('bats', stdout, '');
        expect(results.tests).toHaveLength(2);
        expect(results.summary.passed).toBe(1);
        expect(results.summary.failed).toBe(1);
      });
    });

    describe('flutter parser', () => {
      it('should parse successful flutter test output', () => {
        const stdout = `00:00 +0: test one
00:00 +1: test two
00:00 +2: All tests passed!
`;
        const results = server.parseTestResults('flutter', stdout, '');
        expect(results.framework).toBe('flutter');
        expect(results.tests).toHaveLength(2);
        expect(results.summary.total).toBe(2);
        expect(results.summary.passed).toBe(2);
        expect(results.summary.failed).toBe(0);
      });

      it('should parse failed flutter test output', () => {
        const stdout = `00:00 +0: test one
00:00 -1: test two failed
`;
        const results = server.parseTestResults('flutter', stdout, '');
        expect(results.tests).toHaveLength(2);
        expect(results.summary.passed).toBe(1);
        expect(results.summary.failed).toBe(1);
      });
    });

    describe('pytest parser', () => {
      it('should parse successful pytest output', () => {
        const stdout = `test_file.py::test_one PASSED [ 50%]
test_file.py::test_two PASSED [100%]
`;
        const results = server.parseTestResults('pytest', stdout, '');
        expect(results.framework).toBe('pytest');
        expect(results.tests).toHaveLength(2);
        expect(results.summary.total).toBe(2);
        expect(results.summary.passed).toBe(2);
        expect(results.summary.failed).toBe(0);
      });

      it('should parse failed pytest output', () => {
        const stdout = `test_file.py::test_one PASSED [ 50%]
test_file.py::test_two FAILED [100%]
`;
        const results = server.parseTestResults('pytest', stdout, '');
        expect(results.tests).toHaveLength(2);
        expect(results.summary.passed).toBe(1);
        expect(results.summary.failed).toBe(1);
      });
    });

    describe('jest parser', () => {
      it('should parse successful jest output', () => {
        const stdout = `✓ test one (2ms)
✓ test two (1ms)
`;
        const results = server.parseTestResults('jest', stdout, '');
        expect(results.framework).toBe('jest');
        expect(results.tests).toHaveLength(2);
        expect(results.summary.total).toBe(2);
        expect(results.summary.passed).toBe(2);
        expect(results.summary.failed).toBe(0);
      });

      it('should parse failed jest output', () => {
        const stdout = `✓ test one (2ms)
✕ test two (1ms)
`;
        const results = server.parseTestResults('jest', stdout, '');
        expect(results.tests).toHaveLength(2);
        expect(results.summary.passed).toBe(1);
        expect(results.summary.failed).toBe(1);
      });
    });

    describe('go parser', () => {
      it('should parse successful go test output', () => {
        const stdout = `=== RUN   TestAdd
--- PASS: TestAdd (0.00s)
=== RUN   TestString
--- PASS: TestString (0.00s)
PASS
`;
        const results = server.parseTestResults('go', stdout, '');
        expect(results.framework).toBe('go');
        expect(results.tests).toHaveLength(2);
        expect(results.summary.total).toBe(2);
        expect(results.summary.passed).toBe(2);
        expect(results.summary.failed).toBe(0);
      });

      it('should parse failed go test output', () => {
        const stdout = `=== RUN   TestAdd
--- PASS: TestAdd (0.00s)
=== RUN   TestFail
--- FAIL: TestFail (0.00s)
    basic_test.go:15: Expected 2 + 2 to equal 5
FAIL
`;
        const results = server.parseTestResults('go', stdout, '');
        expect(results.tests).toHaveLength(2);
        expect(results.summary.passed).toBe(1);
        expect(results.summary.failed).toBe(1);
      });

      it('should capture test output', () => {
        const stdout = `=== RUN   TestWithOutput
some test output
--- PASS: TestWithOutput (0.00s)
PASS
`;
        const results = server.parseTestResults('go', stdout, '');
        expect(results.tests).toHaveLength(1);
        expect(results.tests[0].output).toContain('some test output');
      });
    });

    describe('error handling', () => {
      it('should handle empty input', () => {
        const results = server.parseTestResults('bats', '', '');
        expect(results.tests).toHaveLength(0);
        expect(results.summary.total).toBe(0);
      });

      it('should handle stderr input', () => {
        const results = server.parseTestResults('bats', '', 'Error occurred');
        expect(results.tests[0].passed).toBe(false);
        expect(results.summary.failed).toBe(1);
      });
    });
  });
});
