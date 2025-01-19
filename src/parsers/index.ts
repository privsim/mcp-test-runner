import { BatsParser } from './bats.js';
import { JestParser } from './jest.js';
import { PytestParser } from './pytest.js';
import { FlutterParser } from './flutter.js';
import { GoParser } from './go.js';
import { ParsedResults, TestParser } from './types.js';
import { debug } from '../utils.js';

export type Framework = 'bats' | 'pytest' | 'flutter' | 'jest' | 'go';

export class TestParserFactory {
  private static parsers: Record<Framework, TestParser> = {
    bats: new BatsParser(),
    jest: new JestParser(),
    pytest: new PytestParser(),
    flutter: new FlutterParser(),
    go: new GoParser(),
  };

  static getParser(framework: Framework): TestParser {
    const parser = this.parsers[framework];
    if (!parser) {
      throw new Error(`Unsupported framework: ${framework}`);
    }
    return parser;
  }

  static parseTestResults(
    framework: Framework, 
    stdout: string, 
    stderr: string
  ): ParsedResults {
    try {
      debug('Parsing test results for framework:', framework);
      debug('stdout:', stdout);
      debug('stderr:', stderr);
      
      // Attempt parsing with framework-specific parser
      const parser = this.getParser(framework);
      const results = parser.parse(stdout, stderr);

      // Enhanced validation of parsed results
      const hasValidTests = results.tests.length > 0;
      const hasValidOutput = results.tests.some(test => 
        test.output.length > 0 || (test.rawOutput && test.rawOutput.length > 0)
      );

      // If no valid tests or output, return empty results with framework info
      if (!hasValidTests || !hasValidOutput) {
        debug('No valid test results found');
        return {
          framework,
          tests: [],
          summary: {
            total: 0,
            passed: 0,
            failed: 0
          },
          rawOutput: `${stdout}\n${stderr}`.trim()
        };
      }

      // Ensure raw output is preserved
      if (!results.rawOutput) {
        results.rawOutput = `${stdout}\n${stderr}`.trim();
      }

      debug('Successfully parsed results:', results);
      return results;

    } catch (err) {
      const error = err as Error;
      debug('Error during parsing:', error);
      
      // Return error as a failed test result
      return {
        framework,
        tests: [{
          name: 'Parsing Error',
          passed: false,
          output: [error.message],
          rawOutput: error.stack
        }],
        summary: {
          total: 1,
          passed: 0,
          failed: 1
        },
        rawOutput: error.stack || error.message
      };
    }
  }
}

// Re-export types
export * from './types.js';
