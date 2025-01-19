import { TestParser, ParsedResults, TestResult, TestSummary } from './types.js';
import { debug } from '../utils.js';

export class BatsParser implements TestParser {
  parse(stdout: string, stderr: string): ParsedResults {
    debug('Parsing Bats output');

    const lines = stdout.split('\n').filter(line => line.trim());
    const tests: TestResult[] = [];
    let currentTest: TestResult | null = null;
    let currentOutput: string[] = [];

    for (const line of lines) {
      debug('Processing line:', line);
      
      // Match TAP test result line
      const testMatch = line.match(/^(ok|not ok)\s+(\d+)\s+(.+)$/);
      if (testMatch) {
        // Save previous test if exists
        if (currentTest) {
          currentTest.output = currentOutput;
          tests.push(currentTest);
        }

        const [, status, , name] = testMatch;
        currentTest = {
          name: name.trim(),
          passed: status === 'ok',
          output: [],
          rawOutput: line
        };
        currentOutput = [];
        continue;
      }

      // Collect output for current test
      if (currentTest && !line.startsWith('#')) {
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
        rawOutput: stderr
      });
    }

    return {
      framework: 'bats',
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