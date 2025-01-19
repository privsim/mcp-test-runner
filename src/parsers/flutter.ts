import { TestParser, ParsedResults, TestResult, TestSummary } from './types.js';
import { debug } from '../utils.js';

export class FlutterParser implements TestParser {
  parse(stdout: string, stderr: string): ParsedResults {
    debug('Parsing Flutter output');

    const lines = stdout.split('\n');
    const tests: TestResult[] = [];
    let currentTest: TestResult | null = null;
    let currentOutput: string[] = [];
    let isCollectingStackTrace = false;
    let isCollectingException = false;

    for (const line of lines) {
      debug('Processing line:', line);

      // Check for Flutter test framework exceptions
      if (line.includes('EXCEPTION CAUGHT BY FLUTTER TEST FRAMEWORK')) {
        isCollectingException = true;
        if (currentTest) {
          currentTest.passed = false;
          currentOutput.push(line);
        }
        continue;
      }

      // Check for stack traces
      if (line.match(/^#\d+\s+.*$/)) {
        isCollectingStackTrace = true;
        if (currentTest) {
          currentOutput.push(line);
        }
        continue;
      }

      // Match test status lines
      // Format: "00:01 +1: test name" or "00:01 -1: test name [E]"
      const testMatch = line.match(/^(\d{2}:\d{2})\s+([+-]\d+):\s+(.+?)(?:\s+\[([E])\])?$/);
      if (testMatch) {
        // Save previous test if exists
        if (currentTest) {
          currentTest.output = currentOutput;
          currentTest.rawOutput = currentOutput.join('\n');
          tests.push(currentTest);
        }

        const [, timestamp, status, testName, error] = testMatch;
        const isPassing = status.includes('+') && !status.includes('-') && !error;
        
        // Skip summary lines
        if (testName.includes('All tests passed') || testName.includes('loading ')) {
          currentTest = null;
          currentOutput = [];
          continue;
        }

        // Create new test result
        currentTest = {
          name: testName.trim(),
          passed: isPassing,
          output: [],
          rawOutput: line
        };
        currentOutput = [];
        isCollectingStackTrace = false;
        isCollectingException = false;
        continue;
      }

      // Handle assertion errors
      if (line.includes('Failed assertion:') || line.includes('Expected:') || line.includes('Actual:')) {
        if (currentTest) {
          currentTest.passed = false;
          currentOutput.push(line.trim());
        }
        continue;
      }

      // Collect output for current test
      if (currentTest && line.trim()) {
        // Include all output when collecting stack trace or exception
        if (isCollectingStackTrace || isCollectingException) {
          currentOutput.push(line.trim());
        }
        // Normal output collection
        else if (line.includes('log output:')) {
          const output = line.replace('log output:', '').trim();
          currentOutput.push(output);
        }
        // Collect error messages and other output
        else if (!line.match(/^\d{2}:\d{2}/) && !line.includes('To run this test again:')) {
          currentOutput.push(line.trim());
        }
      }

      // Reset collection flags on empty lines
      if (!line.trim()) {
        isCollectingStackTrace = false;
        isCollectingException = false;
      }
    }

    // Add last test if exists
    if (currentTest) {
      currentTest.output = currentOutput;
      currentTest.rawOutput = currentOutput.join('\n');
      tests.push(currentTest);
    }

    // Handle stderr and framework errors
    if ((tests.length === 0 && stderr) || stderr.includes('flutter test')) {
      const errorTest: TestResult = {
        name: 'Flutter Test Execution',
        passed: false,
        output: stderr.split('\n').filter(line => line.trim()),
        rawOutput: stderr
      };
      tests.push(errorTest);
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