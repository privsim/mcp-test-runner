import { TestParser, ParsedResults, TestResult, TestSummary } from './types.js';
import { debug } from '../utils.js';

export class GoParser implements TestParser {
  parse(stdout: string, stderr: string): ParsedResults {
    debug('Parsing Go test output');

    const lines = stdout.split('\n').filter(line => line.trim());
    const tests: TestResult[] = [];
    let currentTestName: string | null = null;
    let currentOutput: string[] = [];

    // If there's no input and no errors, return empty results
    if (!stdout.trim() && !stderr.trim()) {
      return {
        framework: 'go',
        tests: [],
        summary: this.createSummary([]),
        rawOutput: ''
      };
    }

    for (const line of lines) {
      debug('Processing line:', line);

      // First check for build errors
      const buildErrorMatch = line.match(/^(.*\.go):(\d+):(\d+):\s+(.+)$/);
      if (buildErrorMatch) {
        const [, file, lineNum, col, msg] = buildErrorMatch;
        tests.push({
          name: `Build Error in ${file}`,
          passed: false,
          output: [`Line ${lineNum}, Column ${col}: ${msg}`],
          rawOutput: line
        });
        continue;
      }

      // Check for test start
      const runMatch = line.match(/^=== RUN\s+(.+)$/);
      if (runMatch) {
        currentTestName = runMatch[1];
        currentOutput = [];
        continue;
      }

      // Check for test result
      const testMatch = line.match(/^--- (PASS|FAIL): (.+?)(?: \(.*\))?$/);
      if (testMatch) {
        const [, status, name] = testMatch;
        // Only add test if we have a matching RUN line or it's a direct PASS/FAIL
        if (name === currentTestName || !currentTestName) {
          tests.push({
            name: name.trim(),
            passed: status === 'PASS',
            output: [...currentOutput],
            rawOutput: currentOutput.length > 0 ? currentOutput.join('\n') : line
          });
          currentTestName = null;
          currentOutput = [];
        }
        continue;
      }

      // Collect output if we have a current test and it's not a test runner line
      if (currentTestName && line.trim() &&
          !line.startsWith('=== RUN') &&
          !line.startsWith('--- PASS') &&
          !line.startsWith('--- FAIL') &&
          !line.startsWith('PASS') &&
          !line.startsWith('FAIL')) {
        currentOutput.push(line.trim());
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
      framework: 'go',
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