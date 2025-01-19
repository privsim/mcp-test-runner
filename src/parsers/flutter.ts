import { TestParser, ParsedResults, TestResult, TestSummary } from './types.js';
import { debug } from '../utils.js';

export class FlutterParser implements TestParser {
  parse(stdout: string, stderr: string): ParsedResults {
    debug('Parsing Flutter output');

    const lines = stdout.split('\n').filter(line => line.trim());
    const tests: TestResult[] = [];
    let currentTest: TestResult | null = null;

    for (const line of lines) {
      debug('Processing line:', line);

      // Match test status lines
      // Format: "00:01 +1: test name" or "00:01 -1: test name"
      const testMatch = line.match(/^\d{2}:\d{2}\s+[+-]\d+:\s+(.+?)(?:\s+\[E\])?$/);
      if (testMatch) {
        const [, testName] = testMatch;
        const isPassing = line.includes('+') && !line.includes('-');
        
        // Skip if this is just a summary line
        if (testName.includes('All tests passed') || testName.includes('loading ')) {
          continue;
        }

        // Create new test result
        currentTest = {
          name: testName.trim(),
          passed: isPassing,
          output: [],
          rawOutput: line
        };
        tests.push(currentTest);
        continue;
      }

      // Collect output for current test
      if (currentTest && line.trim()) {
        if (line.includes('log output:')) {
          const output = line.replace('log output:', '').trim();
          currentTest.output.push(output);
          currentTest.rawOutput = (currentTest.rawOutput || '') + '\n' + line;
        } else if (!line.match(/^\d{2}:\d{2}/)) {
          currentTest.output.push(line.trim());
          currentTest.rawOutput = (currentTest.rawOutput || '') + '\n' + line;
        }
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
      framework: 'flutter',
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