import { TestParser, ParsedResults, TestResult, TestSummary } from './types.js';
import { debug } from '../utils.js';

export class JestParser implements TestParser {
  parse(stdout: string, stderr: string): ParsedResults {
    debug('Parsing Jest output');

    const lines = stdout.split('\n').filter(line => line.trim());
    const tests: TestResult[] = [];

    for (const line of lines) {
      debug('Processing line:', line);

      // Match test result lines
      // Example: "✓ basic addition test (2ms)"
      // Example: "✕ failed test (3ms)"
      const testMatch = line.match(/^([✓✕])\s+(.+?)(?:\s+\(\d+\s*m?s\))?$/);
      if (testMatch) {
        const [, status, name] = testMatch;
        tests.push({
          name: name.trim(),
          passed: status === '✓',
          output: [],
          rawOutput: line
        });
        continue;
      }

      // Add output to the last test if it exists
      if (line.trim() &&
          !line.startsWith('PASS') &&
          !line.startsWith('FAIL') &&
          !line.includes('Test Suites:') &&
          !line.includes('Tests:') &&
          !line.includes('Snapshots:') &&
          !line.includes('Time:') &&
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
      framework: 'jest',
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