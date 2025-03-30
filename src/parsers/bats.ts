import { TestParser, ParsedResults, TestResult, TestSummary } from './types.js';
import { debug } from '../utils.js';

export class BatsParser implements TestParser {
  parse(stdout: string, stderr: string): ParsedResults {
    debug('Parsing Bats output');

    const lines = stdout.split('\n').filter(line => line.trim());
    const tests: TestResult[] = [];
    let currentTest: TestResult | null = null;
    let currentOutput: string[] = [];
    let setupOutput: string[] = [];

    for (const line of lines) {
      debug('Processing line:', line);
      
      // Match TAP test result line
      const testMatch = line.match(/^(ok|not ok)\s+(\d+)\s+(.+)$/);
      if (testMatch) {
        // Save previous test if exists
        if (currentTest) {
          currentTest.output = [...currentOutput];
          tests.push(currentTest);
        }

        const [, status, , name] = testMatch;
        currentTest = {
          name: name.trim(),
          passed: status === 'ok',
          output: [],
          rawOutput: line
        };
        currentOutput = [...setupOutput]; // Include setup output for each test
        continue;
      }

      // Collect comment lines that include error information or setup/teardown
      if (line.startsWith('#')) {
        const commentLine = line.substring(1).trim();
        
        if (!currentTest) {
          // Store setup output for later tests
          setupOutput.push(commentLine);
        } else {
          currentOutput.push(commentLine);
        }
        continue;
      }

      // Collect output for current test
      if (currentTest) {
        currentOutput.push(line.trim());
      }
    }

    // Add last test if exists
    if (currentTest) {
      currentTest.output = [...currentOutput];
      tests.push(currentTest);
    }

    // If no tests were parsed but we have stderr, create a failed test
    if (tests.length === 0 && stderr) {
      tests.push({
        name: 'Test Execution Error',
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