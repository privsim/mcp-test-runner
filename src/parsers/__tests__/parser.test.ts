import { TestParserFactory } from '../index.js';
import { BatsParser } from '../bats.js';
import { PytestParser } from '../pytest.js';
import { JestParser } from '../jest.js';
import { GoParser } from '../go.js';
import { FlutterParser } from '../flutter.js';
import type { Framework } from '../index.js';
import { getMockOutput } from '../../__mocks__/testOutputs.js';

const parserMap = {
  bats: BatsParser,
  pytest: PytestParser,
  jest: JestParser,
  go: GoParser,
  flutter: FlutterParser
} as const;

describe('Test Parser Suite', () => {
  // Test each framework parser
  Object.entries(parserMap).forEach(([framework, ParserClass]) => {
    describe(`${framework} Parser`, () => {
      const parser = new ParserClass();

      describe('Success cases', () => {
        test('parses passing tests', () => {
          const stdout = getMockOutput(framework as Framework, 'success');
          const result = parser.parse(stdout, '');
          expect(result.framework).toBe(framework);
          expect(result.summary.passed).toBeGreaterThan(0);
          expect(result.summary.failed).toBe(0);
        });

        test('captures test output', () => {
          const stdout = getMockOutput(framework as Framework, 'with_output');
          const result = parser.parse(stdout, '');
          expect(result.tests[0]?.output).toContain('some test output');
        });
      });

      describe('Failure cases', () => {
        test('parses failing tests', () => {
          const stdout = getMockOutput(framework as Framework, 'failure');
          const result = parser.parse(stdout, '');
          expect(result.summary.failed).toBeGreaterThan(0);
        });

        test('handles malformed output', () => {
          const stdout = 'Invalid test output format';
          const result = parser.parse(stdout, '');
          expect(result.tests).toBeDefined();
          expect(result.summary).toBeDefined();
        });
      });

      describe('Edge cases', () => {
        test('handles empty output', () => {
          const result = parser.parse('', '');
          expect(result.tests).toHaveLength(0);
          expect(result.summary.total).toBe(0);
        });

        test('handles stderr output', () => {
          const stdout = '';
          const stderr = 'Error occurred during test execution';
          const result = parser.parse(stdout, stderr);
          expect(result.tests[0]?.passed).toBe(false);
        });
      });
    });
  });

  describe('TestParserFactory', () => {
    test('returns correct parser for each framework', () => {
      Object.entries(parserMap).forEach(([framework, ParserClass]) => {
        const parser = TestParserFactory.getParser(framework as Framework);
        expect(parser).toBeInstanceOf(ParserClass);
      });
    });

    test('throws error for unsupported framework', () => {
      expect(() => {
        // @ts-expect-error Testing invalid framework
        TestParserFactory.getParser('invalid');
      }).toThrow('Unsupported framework: invalid');
    });

    test('parseTestResults returns correct results', () => {
      Object.keys(parserMap).forEach((framework) => {
        const stdout = getMockOutput(framework as Framework, 'success');
        const result = TestParserFactory.parseTestResults(framework as Framework, stdout, '');
        expect(result.framework).toBe(framework);
        expect(result.summary.passed).toBeGreaterThan(0);
        expect(result.summary.failed).toBe(0);
      });
    });
  });
});