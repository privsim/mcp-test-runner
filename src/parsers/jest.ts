import { TestParser, ParsedResults, TestResult, TestSummary } from './types.js';
import { debug } from '../utils.js';

export class JestParser implements TestParser {
  parse(stdout: string, stderr: string): ParsedResults {
    debug('Parsing Jest output');
    const lines = stdout.split('\n');
    const tests: TestResult[] = [];
    let currentTest: TestResult | null = null;
    let currentOutput: string[] = [];

    for (const line of lines) {
      debug('Processing line:', line);

      // Match test result lines
      // Example: "✓ basic addition test (2ms)"
      // Example: "✕ failed test (3ms)"
      const testMatch = line.match(/^([✓✕])\s+(.+?)(?:\s+\(\d+\s*m?s\))?$/);
      if (testMatch) {
        if (currentTest) {
          currentTest.output = currentOutput;
          tests.push(currentTest);
        }

        const [, status, name] = testMatch;
        currentTest = {
          name: name.trim(),
          passed: status === '✓',
          output: [],
        };
        currentOutput = [];
        continue;
      }

      // Collect output for current test
      if (line.trim() &&
          !line.startsWith('PASS') &&
          !line.startsWith('FAIL') &&
          !line.includes('Test Suites:') &&
          !line.includes('Tests:') &&
          !line.includes('Snapshots:') &&
          !line.includes('Time:')) {
        if (currentTest) {
          currentOutput.push(line.trim());
        }
      }
    }

    // Add last test if exists
    if (currentTest) {
      currentTest.output = currentOutput;
      tests.push(currentTest);
    }

    // If no tests were parsed but we have stderr, create a failed test
    if ((tests.length === 0 || stderr) && stderr) {
      tests.push({
        name: 'Test execution',
        passed: false,
        output: stderr.split('\n').filter(line => line.trim()),
      });
    }

    return {
      framework: 'jest',
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