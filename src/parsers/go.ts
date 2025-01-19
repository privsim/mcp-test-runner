import { TestParser, ParsedResults, TestResult, TestSummary } from './types.js';
import { debug } from '../utils.js';

export class GoParser implements TestParser {
  parse(stdout: string, stderr: string): ParsedResults {
    debug('Parsing Go test output');
    const lines = stdout.split('\n');
    const tests: TestResult[] = [];
    let currentTest: TestResult | null = null;
    let currentOutput: string[] = [];

    for (const line of lines) {
      debug('Processing line:', line);

      // First check for build errors
      const buildErrorMatch = line.match(/^(.*\.go):(\d+):(\d+):\s+(.+)$/);
      if (buildErrorMatch) {
        const [, file, lineNum, col, msg] = buildErrorMatch;
        tests.push({
          name: `Build Error in ${file}`,
          passed: false,
          output: [`Line ${lineNum}, Column ${col}: ${msg}`]
        });
        continue;
      }

      // Then check for individual test results
      const testMatch = line.match(/^--- (PASS|FAIL): ([^\s]+)/);
      if (testMatch) {
        if (currentTest) {
          currentTest.output = currentOutput;
          tests.push(currentTest);
        }

        const [, status, name] = testMatch;
        currentTest = {
          name: name.trim(),
          passed: status === 'PASS',
          output: [],
        };
        currentOutput = [];
        continue;
      }

      // Collect output for current test
      if (line.trim()) {
        if (currentTest) {
          if (!line.startsWith('=== RUN') &&
              !line.startsWith('--- PASS') &&
              !line.startsWith('--- FAIL') &&
              !line.startsWith('PASS') &&
              !line.startsWith('FAIL')) {
            currentOutput.push(line.trim());
          }
        } else if (line.includes('build failed')) {
          tests.push({
            name: 'Build Failure',
            passed: false,
            output: [line.trim()]
          });
        }
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
      framework: 'go',
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