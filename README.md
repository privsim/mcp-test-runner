# Test Runner MCP

*** Note: this mcp server can be used by agents to potentially run arbitrary commands, 
this is something which can actually be quite helpful as intelligent agents will often automatically
and naturally take debugging steps to achieve specified task; especially if every instance of execution
for this tool is approved individually. Though I would not recommend allowing always approve execution***

A Model Context Protocol (MCP) server for running and parsing test results from multiple testing frameworks. This server provides a unified interface for executing tests and processing their outputs, supporting:

- Bats (Bash Automated Testing System)
- Pytest (Python Testing Framework)
- Flutter Tests
- Jest (JavaScript Testing Framework)
- Go Tests

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

Add the test-runner to your MCP settings (e.g., in `claude_desktop_config.json` or `cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "test-runner": {
      "command": "node",
      "args": ["/path/to/test-runner-mcp/build/index.js"],
      "env": {
        "NODE_PATH": "/path/to/test-runner-mcp/node_modules",
        // Flutter-specific environment (required for Flutter tests)
        "FLUTTER_ROOT": "/opt/homebrew/Caskroom/flutter/3.27.2/flutter",
        "PUB_CACHE": "/Users/username/.pub-cache",
        "PATH": "/opt/homebrew/Caskroom/flutter/3.27.2/flutter/bin:/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
```

Note: For Flutter tests, ensure you replace:
- `/opt/homebrew/Caskroom/flutter/3.27.2/flutter` with your actual Flutter installation path
- `/Users/username/.pub-cache` with your actual pub cache path
- Update PATH to include your system's actual paths

You can find these values by running:
```bash
# Get Flutter root
flutter --version

# Get pub cache path
echo $PUB_CACHE   # or default to $HOME/.pub-cache

# Get Flutter binary path
which flutter
```

### Running Tests

Use the `run_tests` tool with the following parameters:

```json
{
  "command": "test command to execute",
  "workingDir": "working directory for test execution",
  "framework": "bats|pytest|flutter|jest|go",
  "outputDir": "directory for test results",
  "timeout": "test execution timeout in milliseconds (default: 300000)",
  "env": "optional environment variables"
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
  "outputDir": "test_reports",
  "FLUTTER_ROOT": "/opt/homebrew/Caskroom/flutter/3.27.2/flutter",
  "PUB_CACHE": "/Users/username/.pub-cache",
  "PATH": "/opt/homebrew/Caskroom/flutter/3.27.2/flutter/bin:/usr/local/bin:/usr/bin:/bin"
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

### Flutter Test Support

The test runner includes enhanced support for Flutter tests:

1. Environment Setup
   - Automatic Flutter environment configuration
   - PATH and PUB_CACHE setup
   - Flutter installation verification

2. Error Handling
   - Stack trace collection
   - Assertion error handling
   - Exception capture
   - Test failure detection

3. Output Processing
   - Complete test output capture
   - Stack trace preservation
   - Detailed error reporting
   - Raw output preservation

## Output Format

The test runner produces structured output while preserving complete test output:

```typescript
interface TestResult {
  name: string;
  passed: boolean;
  output: string[];
  rawOutput?: string;  // Complete unprocessed output
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  duration?: number;
}

interface ParsedResults {
  framework: string;
  tests: TestResult[];
  summary: TestSummary;
  rawOutput: string;  // Complete command output
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
