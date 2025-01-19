import { TestParser, ParsedResults, TestResult, TestSummary } from './types.js';
import { debug } from '../utils.js';

export class PytestParser implements TestParser {
  parse(stdout: string, stderr: string): ParsedResults {
    debug('Parsing pytest output');
    const lines = stdout.split('\n');
    const tests: TestResult[] = [];
    let currentTest: TestResult | null = null;
    let currentOutput: string[] = [];

    for (const line of lines) {
      debug('Processing line:', line);

      // Match test result lines in verbose output
      // Example: "test/test_basic.py::test_addition PASSED [ 25%]"
      const testMatch = line.match(/^(.+?::[\w_]+)\s+(PASSED|FAILED|SKIPPED|ERROR|XFAIL|XPASS)(\s+\[\s*\d+%\])?$/);
      if (testMatch) {
        if (currentTest) {
          currentTest.output = currentOutput;
          tests.push(currentTest);
        }

        const [, name, status] = testMatch;
        currentTest = {
          name: name.split('::').pop() || name, // Extract just the test name
          passed: status === 'PASSED' || status === 'XPASS',
          output: [],
        };
        currentOutput = [];
        continue;
      }

      // Collect output for current test
      if (currentTest && line.trim() &&
          !line.startsWith('===') &&
          !line.startsWith('collecting') &&
          !line.includes('test session starts') &&
          !line.includes('passed in')) {
        currentOutput.push(line.trim());
      }
    }

    // Add last test if exists
    if (currentTest) {
      currentTest.output = currentOutput;
      tests.push(currentTest);
    }

    // If no tests were parsed but we have stderr, create a failed test
    if (tests.length === 0 && stderr) {
      tests.push({
        name: 'Test execution',
        passed: false,
        output: stderr.split('\n').filter(line => line.trim()),
      });
    }

    return {
      framework: 'pytest',
      tests,
      summary: this.createSummary(tests),
    };
  }

  private createSummary(tests: TestResult[]): TestSummary {
    return {
      total: tests.length,
      passed: tests.filter(t => t.passed).length,
      failed: tests.filter(t => !t.passed).length,
    };
  }
}