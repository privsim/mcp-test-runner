import { BatsParser } from './bats.js';
import { JestParser } from './jest.js';
import { PytestParser } from './pytest.js';
import { FlutterParser } from './flutter.js';
import { GoParser } from './go.js';
import type { ParsedResults } from './types.js';

export type Framework = 'bats' | 'pytest' | 'flutter' | 'jest' | 'go';

export class TestParserFactory {
  private static parsers = {
    bats: new BatsParser(),
    jest: new JestParser(),
    pytest: new PytestParser(),
    flutter: new FlutterParser(),
    go: new GoParser(),
  };

  static getParser(framework: Framework) {
    const parser = this.parsers[framework];
    if (!parser) {
      throw new Error(`Unsupported framework: ${framework}`);
    }
    return parser;
  }

  static parseTestResults(framework: Framework, stdout: string, stderr: string): ParsedResults {
    return this.getParser(framework).parse(stdout, stderr);
  }
}

// Re-export types
export * from './types.js';