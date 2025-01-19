import { TestParser, ParsedResults, TestResult, TestSummary } from './types.js';
import { debug } from '../utils.js';

export class FlutterParser implements TestParser {
  parse(stdout: string, stderr: string): ParsedResults {
    debug('Parsing Flutter output');

    const lines = stdout.split('\n').filter(line => line.trim());
    const tests: TestResult[] = [];
    let currentTest: TestResult | null = null;
    let currentOutput: string[] = [];

    for (const line of lines) {
      debug('Processing line:', line);

      // Match test status lines
      // Format: "00:01 +1: test name" or "00:01 -1: test name [E]"
      const testMatch = line.match(/^(\d{2}:\d{2})\s+([+-]\d+):\s+(.+?)(?:\s+\[([E])\])?$/);
      if (testMatch) {
        // Save previous test if exists
        if (currentTest) {
          currentTest.output = currentOutput;
          tests.push(currentTest);
        }

        const [, timestamp, status, testName, error] = testMatch;
        
        // Skip summary lines
        if (testName.includes('All tests passed') || testName.includes('loading ')) {
          currentTest = null;
          currentOutput = [];
          continue;
        }

        const isPassing = status.includes('+') && !status.includes('-') && !error;
        currentTest = {
          name: testName.trim(),
          passed: isPassing,
          output: [],
          rawOutput: line
        };
        currentOutput = [];
        continue;
      }

      // Handle log output
      const logMatch = line.match(/^\s*log output:\s*(.+)$/);
      if (logMatch && currentTest) {
        const [, output] = logMatch;
        currentOutput.push(output.trim());
        continue;
      }

      // Collect other output for current test
      if (currentTest && line.trim() && !line.match(/^\d{2}:\d{2}/)) {
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
        name: 'Flutter Test Execution',
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