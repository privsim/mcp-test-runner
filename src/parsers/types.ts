export interface TestResult {
  name: string;
  passed: boolean;
  output: string[];
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
}

export interface ParsedResults {
  framework: string;
  tests: TestResult[];
  summary: TestSummary;
}

export interface TestParser {
  parse(stdout: string, stderr: string): ParsedResults;
}