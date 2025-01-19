import { TestParser, ParsedResults, TestResult, TestSummary } from './types.js';
import { debug } from '../utils.js';

export class PytestParser implements TestParser {
  parse(stdout: string, stderr: string): ParsedResults {
    debug('Parsing pytest output');

    const lines = stdout.split('\n').filter(line => line.trim());
    const tests: TestResult[] = [];

    for (const line of lines) {
      debug('Processing line:', line);

      // Match test result lines in verbose output
      // Example: "test/test_basic.py::test_addition PASSED [ 25%]"
      const testMatch = line.match(/^(.+?::[\w_]+)\s+(PASSED|FAILED|SKIPPED|ERROR|XFAIL|XPASS)(\s+\[\s*\d+%\])?$/);
      if (testMatch) {
        const [, name, status] = testMatch;
        tests.push({
          name: name.split('::').pop() || name, // Extract just the test name
          passed: status === 'PASSED' || status === 'XPASS',
          output: [],
          rawOutput: line
        });
        continue;
      }

      // Add output to the last test if it exists
      if (line.trim() &&
          !line.startsWith('===') &&
          !line.startsWith('collecting') &&
          !line.includes('test session starts') &&
          !line.includes('passed in') &&
          tests.length > 0) {
        const lastTest = tests[tests.length - 1];
        lastTest.output.push(line.trim());
        lastTest.rawOutput = (lastTest.rawOutput || '') + '\n' + line;
      }
    }

    // If no tests were parsed but we have stderr, create a failed test
    if (tests.length === 0 && stderr) {
      tests.push({
        name: 'Test execution',
        passed: false,
        output: stderr.split('\n').filter(line => line.trim()),
        rawOutput: stderr
      });
    }

    return {
      framework: 'pytest',
      tests,
      summary: this.createSummary(tests),
      rawOutput: `${stdout}\n${stderr}`.trim()
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