# Test Runner MCP

A Model Context Protocol (MCP) server for running and parsing test results from multiple testing frameworks. This server provides a unified interface for executing tests and processing their outputs, supporting:

- Bats (Bash Automated Testing System)
- Pytest (Python Testing Framework)
- Flutter Tests
- Jest (JavaScript Testing Framework)
- Go Tests

<a href="https://glama.ai/mcp/servers/q001c11ec3"><img width="380" height="200" src="https://glama.ai/mcp/servers/q001c11ec3/badge" alt="Test Runner MCP server" /></a>

## Installation

```bash
npm install test-runner-mcp
```

## Prerequisites

The following test frameworks need to be installed for their respective test types:

- Bats: `apt-get install bats` or `brew install bats`
- Pytest: `pip install pytest`
- Flutter: Follow [Flutter installation guide](https://flutter.dev/docs/get-started/install)
- Jest: `npm install --save-dev jest`
- Go: Follow [Go installation guide](https://go.dev/doc/install)

## Usage

### Configuration

Add the test-runner to your MCP settings:

```json
{
  "mcpServers": {
    "test-runner": {
      "command": "node",
      "args": ["/path/to/test-runner-mcp/build/index.js"],
      "env": {
        "NODE_PATH": "/path/to/test-runner-mcp/node_modules"
      }
    }
  }
}
```

### Running Tests

Use the `run_tests` tool with the following parameters:

```json
{
  "command": "test command to execute",
  "workingDir": "working directory for test execution",
  "framework": "bats|pytest|flutter|jest|go",
  "outputDir": "directory for test results"
}
```

Example for each framework:

```json
// Bats
{
  "command": "bats test/*.bats",
  "workingDir": "/path/to/project",
  "framework": "bats",
  "outputDir": "test_reports"
}

// Pytest
{
  "command": "pytest test_file.py -v",
  "workingDir": "/path/to/project",
  "framework": "pytest",
  "outputDir": "test_reports"
}

// Flutter
{
  "command": "flutter test test/widget_test.dart",
  "workingDir": "/path/to/project",
  "framework": "flutter",
  "outputDir": "test_reports"
}

// Jest
{
  "command": "jest test/*.test.js",
  "workingDir": "/path/to/project",
  "framework": "jest",
  "outputDir": "test_reports"
}

// Go
{
  "command": "go test ./...",
  "workingDir": "/path/to/project",
  "framework": "go",
  "outputDir": "test_reports"
}
```

## Output Format

The test runner produces structured output for all frameworks:

```typescript
interface TestResult {
  name: string;
  passed: boolean;
  output: string[];
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
}

interface ParsedResults {
  framework: string;
  tests: TestResult[];
  summary: TestSummary;
}
```

Results are saved in the specified output directory:
- `test_output.log`: Raw test output
- `test_errors.log`: Error messages if any
- `test_results.json`: Structured test results
- `summary.txt`: Human-readable summary

## Development

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

### Running Tests

```bash
npm test
```

The test suite includes tests for all supported frameworks and verifies both successful and failed test scenarios.

### CI/CD

The project uses GitHub Actions for continuous integration:
- Automated testing on Node.js 18.x and 20.x
- Test results uploaded as artifacts
- Dependabot configured for automated dependency updates

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
