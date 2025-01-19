export interface TestResult {
  name: string;
  passed: boolean;
  output: string[];
  rawOutput?: string;  // Complete unprocessed output for this test
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  duration?: number;  // Overall test duration
}

export interface ParsedResults {
  framework: string;
  tests: TestResult[];
  summary: TestSummary;
  rawOutput: string;  // Complete command output
}

// Base interface for all test parsers
export interface TestParser {
  parse(stdout: string, stderr: string): ParsedResults;
}