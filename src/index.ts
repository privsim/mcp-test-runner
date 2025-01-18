#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Request
} from '@modelcontextprotocol/sdk/types.js';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SpawnOptions } from 'node:child_process';

const DEFAULT_TIMEOUT = 300000; // 5 minutes

type Framework = 'bats' | 'pytest' | 'flutter' | 'jest' | 'go';

interface TestRunArguments {
  command: string;
  workingDir: string;
  framework: Framework;
  outputDir?: string;
  timeout?: number;
  env?: Record<string, string>;
}

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

const debug = (...args: any[]) => {
  console.error('[DEBUG]', ...args);
};

export class TestRunnerServer {
  server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'test-runner',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {
            run_tests: {
              name: 'run_tests',
              description: 'Run tests and capture output',
              inputSchema: {
                type: 'object',
                properties: {
                  command: {
                    type: 'string',
                    description: 'Test command to execute (e.g., "bats tests/*.bats")',
                  },
                  workingDir: {
                    type: 'string',
                    description: 'Working directory for test execution',
                  },
                  framework: {
                    type: 'string',
                    enum: ['bats', 'pytest', 'flutter', 'jest', 'go'],
                    description: 'Testing framework being used',
                  },
                  outputDir: {
                    type: 'string',
                    description: 'Directory to store test results',
                  },
                  timeout: {
                    type: 'number',
                    description: 'Test execution timeout in milliseconds (default: 300000)',
                  },
                  env: {
                    type: 'object',
                    description: 'Environment variables for test execution',
                    additionalProperties: {
                      type: 'string'
                    }
                  },
                },
                required: ['command', 'workingDir', 'framework'],
              },
            },
          },
        },
      }
    );

    this.setupTools();
  }

  private setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'run_tests',
          description: 'Run tests and capture output',
          inputSchema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'Test command to execute (e.g., "bats tests/*.bats")',
              },
              workingDir: {
                type: 'string',
                description: 'Working directory for test execution',
              },
              framework: {
                type: 'string',
                enum: ['bats', 'pytest', 'flutter', 'jest', 'go'],
                description: 'Testing framework being used',
              },
              outputDir: {
                type: 'string',
                description: 'Directory to store test results',
              },
              timeout: {
                type: 'number',
                description: 'Test execution timeout in milliseconds (default: 300000)',
              },
              env: {
                type: 'object',
                description: 'Environment variables for test execution',
                additionalProperties: {
                  type: 'string'
                }
              },
            },
            required: ['command', 'workingDir', 'framework'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: Request) => {
      if (!request.params?.name) {
        throw new Error('Missing tool name');
      }

      if (request.params.name !== 'run_tests') {
        throw new Error(`Unknown tool: ${request.params.name}`);
      }

      if (!request.params.arguments) {
        throw new Error('Missing tool arguments');
      }

      const args = request.params.arguments as unknown as TestRunArguments;
      if (!this.isValidTestRunArguments(args)) {
        throw new Error('Invalid test run arguments');
      }

      const { command, workingDir, framework, outputDir = 'test_reports', timeout = DEFAULT_TIMEOUT, env } = args;

      debug('Running tests with args:', { command, workingDir, framework, outputDir, timeout, env });

      // Create output directory
      const resultDir = join(workingDir, outputDir);
      await mkdir(resultDir, { recursive: true });

      try {
        // Run tests with timeout
        const results = await this.executeTestCommand(command, workingDir, framework, resultDir, timeout, args.env);

        return {
          content: [
            {
              type: 'text',
              text: this.createSummary(results),
            },
          ],
          isError: results.summary.failed > 0,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        debug('Test execution failed:', errorMessage);
        throw new Error(`Test execution failed: ${errorMessage}`);
      }
    });
  }

  private async executeTestCommand(
    command: string,
    workingDir: string,
    framework: Framework,
    resultDir: string,
    timeout: number,
    env?: Record<string, string>
  ): Promise<ParsedResults> {
    const tests: TestResult[] = [];
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Test execution timed out'));
      }, timeout);

      // Split command into executable and args
      const parts = command.split(' ');
      const cmd = parts[0];
      const cmdArgs = parts.slice(1);

      debug('Executing command:', { cmd, cmdArgs, workingDir });

      const spawnOptions: SpawnOptions = {
        cwd: workingDir,
        env: { ...process.env, ...(env || {}) },
        shell: true, // Enable shell for better command execution
      };

      const childProcess = spawn(cmd, cmdArgs, spawnOptions);

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        debug('stdout chunk:', chunk);
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        debug('stderr chunk:', chunk);
        
        // Immediately create an error entry for stderr output
        if (chunk.trim()) {
          const errorLines = chunk.trim().split('\n');
          if (tests.length === 0) {
            tests.push({
              name: 'Build Error',
              passed: false,
              output: errorLines
            });
          } else {
            // Append to the last test's output
            const lastTest = tests[tests.length - 1];
            lastTest.output = lastTest.output.concat(errorLines);
          }
        }
      });

      childProcess.on('error', (error: Error) => {
        debug('Process error:', error);
        clearTimeout(timer);
        reject(error);
      });

      childProcess.on('close', async (code: number | null) => {
        clearTimeout(timer);
        debug('Process closed with code:', code);

        // Save raw output
        await writeFile(join(resultDir, 'test_output.log'), stdout);
        if (stderr) {
          await writeFile(join(resultDir, 'test_errors.log'), stderr);
        }

        // Parse and format results
        const results = this.parseTestResults(framework, stdout, stderr);
        await writeFile(
          join(resultDir, 'test_results.json'),
          JSON.stringify(results, null, 2)
        );

        // Create human-readable summary
        const summary = this.createSummary(results);
        await writeFile(join(resultDir, 'summary.txt'), summary);

        if (code !== 0 && !['pytest', 'go'].includes(framework)) { // pytest and go return non-zero for failed tests
          reject(new Error(`Command failed with exit code ${code}\nstderr: ${stderr}`));
        } else {
          resolve(results);
        }
      });
    });
  }

  private isValidTestRunArguments(args: unknown): args is TestRunArguments {
    if (typeof args !== 'object' || args === null) return false;
    const a = args as Record<string, unknown>;
    return (
      typeof a.command === 'string' &&
      typeof a.workingDir === 'string' &&
      typeof a.framework === 'string' &&
      ['bats', 'pytest', 'flutter', 'jest', 'go'].includes(a.framework) &&
      (a.outputDir === undefined || typeof a.outputDir === 'string') &&
      (a.timeout === undefined || (typeof a.timeout === 'number' && a.timeout > 0)) &&
      (a.env === undefined || (typeof a.env === 'object' && a.env !== null &&
        Object.entries(a.env).every(([key, value]) => typeof key === 'string' && typeof value === 'string')))
    );
  }

  private parseTestResults(framework: Framework, stdout: string, stderr: string): ParsedResults {
    debug('Parsing test results for framework:', framework);
    switch (framework) {
      case 'bats':
        return this.parseBatsOutput(stdout, stderr);
      case 'pytest':
        return this.parsePytestOutput(stdout, stderr);
      case 'flutter':
        return this.parseFlutterOutput(stdout);
      case 'jest':
        return this.parseJestOutput(stdout);
      case 'go':
        return this.parseGoOutput(stdout, stderr);
      default:
        return {
          framework,
          tests: [],
          summary: {
            total: 0,
            passed: 0,
            failed: stderr ? 1 : 0,
          },
        };
    }
  }

  private parseGoOutput(stdout: string, stderr: string): ParsedResults {
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
        const [, file, line, col, msg] = buildErrorMatch;
        tests.push({
          name: `Build Error in ${file}`,
          passed: false,
          output: [`Line ${line}, Column ${col}: ${msg}`]
        });
        continue;
      }

      // Then check for test results
      // First check for package-level results
      const packageMatch = line.match(/^(ok|FAIL)\s+(\S+)/);
      if (packageMatch) {
        const [, status, packageName] = packageMatch;
        // Only add package result if we don't already have a build error for it
        if (!tests.some(t => t.name.includes(packageName))) {
          tests.push({
            name: `Package: ${packageName}`,
            passed: status === 'ok',
            output: [
              `Status: ${status}`,
              `Package: ${packageName}`,
              line.includes('[build failed]') ? 'Build failed - see error details below' : line.trim()
            ].filter(l => {
              // Keep only essential information
              return !l.trim().match(/^FAIL$/) && // Remove standalone FAIL lines
                     !l.includes('FAIL\t') &&     // Remove FAIL tab lines
                     !l.includes('cannot convert typeStr') && // Remove duplicate error messages
                     !l.startsWith('# ') &&       // Remove package headers
                     l !== line.trim();           // Remove raw output if we have a processed version
            }).filter((item, index, arr) => arr.indexOf(item) === index) // Remove any remaining duplicates
              .filter((item, index, arr) => arr.indexOf(item) === index)  // Remove duplicates
          });
        }
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

      // Log all output for debugging
      debug('Raw line:', line);

      // Collect all non-empty lines as potential output
      if (line.trim()) {
        // Always collect output for current test if we have one
        if (currentTest) {
          currentOutput.push(line.trim());
        } else {
          // Handle compiler errors and build failures
          if (line.match(/\w+\.go:\d+:\d+:/)) {
            // Extract file and error message
            const [file, ...errorParts] = line.split(':');
            const errorMsg = errorParts.join(':').trim();
            
            // Create a new build error entry or append to existing one
            const lastTest = tests[tests.length - 1];
            if (!lastTest || !lastTest.name.startsWith('Build Error')) {
              tests.push({
                name: `Build Error in ${file}`,
                passed: false,
                output: [`${errorMsg}`]
              });
            } else {
              lastTest.output.push(line.trim());
            }
          } else if (line.includes('build failed') || line.includes('FAIL')) {
            // Capture build failure messages
            if (tests.length === 0) {
              tests.push({
                name: 'Build Failure',
                passed: false,
                output: [line.trim()]
              });
            } else {
              tests[tests.length - 1].output.push(line.trim());
            }
          } else if (tests.length === 0) {
            tests.push({
              name: 'Build Output',
              passed: false,
              output: [line.trim()]
            });
          } else {
            tests[tests.length - 1].output.push(line.trim());
          }
        }

        // Check for error indicators
        const isErrorLine = line.startsWith('# ') ||
            line.includes('build failed') ||
            line.includes('cannot find') ||
            line.includes('error:') ||
            line.includes('failed running test') ||
            line.includes('cannot convert') ||
            line.match(/\w+\.go:\d+:\d+:/) ||  // Capture Go compiler errors
            line.match(/FAIL\s+[\w\/\.-]+\s+/) || // Capture package FAIL lines
            line.startsWith('FAIL') || // Capture any FAIL lines
            line.match(/^\s*#/); // Capture any comment lines

        if (isErrorLine) {
          
          // Handle package-level errors
          if (line.startsWith('# ')) {
            // Start a new package error section
            if (currentTest) {
              currentTest.output = currentOutput;
              tests.push(currentTest);
            }
            currentTest = {
              name: line.substring(2).trim(),
              passed: false,
              output: []
            };
            currentOutput = [];
          } else if (tests.length === 0 || !currentTest) {
            // Create or update error entry
            if (tests.length === 0) {
              tests.push({
                name: line.includes('build failed') ? 'Build Error' : 'Package Error',
                passed: false,
                output: [line.trim()]
              });
            } else if (line.match(/\w+\.go:\d+:\d+:/)) {
              // For compiler errors, create a new error entry
              tests.push({
                name: 'Compiler Error',
                passed: false,
                output: [line.trim()]
              });
            } else {
              // Append to existing error entry
              tests[tests.length - 1].output.push(line.trim());
            }
      
            // Also capture stderr if available
            if (stderr && !currentTest) {
              const stderrLines = stderr.split('\n').filter(l => l.trim());
              if (stderrLines.length > 0) {
                tests[tests.length - 1].output.push(...stderrLines);
              }
            }
          } else {
            // Append to current test's output
            currentOutput.push(line.trim());
          }
        } else if (currentTest) {
          // Skip test framework output lines
          if (!line.startsWith('=== RUN') &&
              !line.startsWith('--- PASS') &&
              !line.startsWith('--- FAIL') &&
              !line.startsWith('PASS') &&
              !line.startsWith('FAIL') &&
              !line.startsWith('ok') &&
              !line.startsWith('?')) {
            currentOutput.push(line.trim());
          }
        }
      }
    }

    // Add last test if exists
    if (currentTest) {
      currentTest.output = currentOutput;
      tests.push(currentTest);
    }

    // Process stderr for build errors
    if (stderr) {
      const stderrLines = stderr.split('\n').filter(line => line.trim());
      for (const line of stderrLines) {
        const buildErrorMatch = line.match(/^(.*\.go):(\d+):(\d+):\s+(.+)$/);
        if (buildErrorMatch) {
          const [, file, lineNum, col, msg] = buildErrorMatch;
          const existingTest = tests.find(t => t.name === `Build Error in ${file}`);
          if (existingTest) {
            existingTest.output.push(`Line ${lineNum}, Column ${col}: ${msg}`);
          } else {
            tests.push({
              name: `Build Error in ${file}`,
              passed: false,
              output: [
                `File: ${file}`,
                `Location: Line ${lineNum}, Column ${col}`,
                `Error: ${msg}`
              ]
            });
          }
        } else if (line.includes('build failed')) {
          const packageMatch = line.match(/FAIL\s+([\w\/\.-]+)/);
          const packageName = packageMatch ? packageMatch[1] : 'unknown package';
          tests.push({
            name: 'Build Failure',
            passed: false,
            output: [
              `Package: ${packageName}`,
              `Status: Build Failed`,
              `Details: ${line.trim()}`
            ]
          });
        }
      }
    }

    const results = {
      framework: 'go',
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.passed).length,
        failed: tests.filter(t => !t.passed).length,
      },
    };

    debug('Parsed results:', results);
    return results;
  }

  private parseBatsOutput(stdout: string, stderr: string): ParsedResults {
    debug('Parsing Bats output');
    const lines = stdout.split('\n');
    const tests: TestResult[] = [];
    let currentTest: TestResult | null = null;
    let currentOutput: string[] = [];

    // TAP output format parsing
    for (const line of lines) {
      debug('Processing line:', line);
      
      // Match TAP test result line
      const testMatch = line.match(/^(ok|not ok)\s+(\d+)\s+(.+)$/);
      if (testMatch) {
        // Save previous test if exists
        if (currentTest) {
          currentTest.output = currentOutput;
          tests.push(currentTest);
        }

        const [, status, , name] = testMatch;
        currentTest = {
          name: name.trim(),
          passed: status === 'ok',
          output: [],
        };
        currentOutput = [];
        continue;
      }

      // Collect output for current test
      if (currentTest && line.trim() && !line.startsWith('#')) {
        currentOutput.push(line.trim());
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

    const results = {
      framework: 'bats',
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.passed).length,
        failed: tests.filter(t => !t.passed).length,
      },
    };

    debug('Parsed results:', results);
    return results;
  }

  private parsePytestOutput(stdout: string, stderr: string): ParsedResults {
    debug('Parsing pytest output');
    const lines = stdout.split('\n');
    const tests: TestResult[] = [];
    let currentTest: TestResult | null = null;
    let currentOutput: string[] = [];

    for (const line of lines) {
      debug('Processing line:', line);

      // Match test result lines in verbose output
      // Example: "test/test_basic.py::test_addition PASSED [ 25%]"
      const testMatch = line.match(/^(.+?::[\w_]+)\s+(PASSED|FAILED|SKIPPED|ERROR|XFAIL|XPASS)(\s+\[\s*\d+%\])?$/);
      if (testMatch) {
        if (currentTest) {
          currentTest.output = currentOutput;
          tests.push(currentTest);
        }

        const [, name, status] = testMatch;
        currentTest = {
          name: name.split('::').pop() || name, // Extract just the test name
          passed: status === 'PASSED' || status === 'XPASS',
          output: [],
        };
        currentOutput = [];
        continue;
      }

      // Collect output for current test
      if (currentTest && line.trim() &&
          !line.startsWith('===') &&
          !line.startsWith('collecting') &&
          !line.includes('test session starts') &&
          !line.includes('passed in')) {
        currentOutput.push(line.trim());
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

    const results = {
      framework: 'pytest',
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.passed).length,
        failed: tests.filter(t => !t.passed).length,
      },
    };

    debug('Parsed results:', results);
    return results;
  }

  private parseFlutterOutput(output: string): ParsedResults {
    debug('Parsing Flutter output');
    const lines = output.split('\n');
    const tests: TestResult[] = [];
    let currentTest: TestResult | null = null;
    let currentOutput: string[] = [];

    for (const line of lines) {
      debug('Processing line:', line);

      // Skip non-test output lines
      if (line.startsWith('loading') ||
          line.includes('All tests passed') ||
          line.includes('Welcome to Flutter') ||
          line.includes('Flutter tool analytics') ||
          line.includes('Google Analytics') ||
          line.includes('Waiting for another flutter command') ||
          line.includes('Running "flutter pub get"')) {
        continue;
      }

      // Match test result lines
      // Example: "00:00 +1: basic addition test"
      // Example: "00:00 -1: failed test"
      const testMatch = line.match(/^\d{2}:\d{2}\s+([+-]\d+):\s+(.+?)(?:\s+\(.*?\))?$/);
      if (testMatch) {
        const [, status, name] = testMatch;
        // Skip loading and summary lines
        if (!name.startsWith('loading ') && !name.includes('All tests passed')) {
          if (currentTest) {
            currentTest.output = currentOutput;
            tests.push(currentTest);
          }

          currentTest = {
            name: name.trim(),
            passed: status.startsWith('+'),
            output: [],
          };
          currentOutput = [];
        }
        continue;
      }

      // Collect output for current test
      if (currentTest && line.trim()) {
        currentOutput.push(line.trim());
      }
    }

    // Add last test if exists
    if (currentTest) {
      currentTest.output = currentOutput;
      tests.push(currentTest);
    }

    const results = {
      framework: 'flutter',
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.passed).length,
        failed: tests.filter(t => !t.passed).length,
      },
    };

    debug('Parsed results:', results);
    return results;
  }

  private parseJestOutput(output: string): ParsedResults {
    debug('Parsing Jest output');
    const lines = output.split('\n');
    const tests: TestResult[] = [];
    let currentTest: TestResult | null = null;
    let currentOutput: string[] = [];

    for (const line of lines) {
      debug('Processing line:', line);

      // Match test result lines
      // Example: "✓ basic addition test (2 ms)"
      // Example: "✕ failed test (3 ms)"
      const testMatch = line.match(/^([✓✕])\s+(.+?)(?:\s+\(\d+\s*m?s\))?$/);
      if (testMatch) {
        if (currentTest) {
          currentTest.output = currentOutput;
          tests.push(currentTest);
        }

        const [, status, name] = testMatch;
        currentTest = {
          name: name.trim(),
          passed: status === '✓',
          output: [],
        };
        currentOutput = [];
        continue;
      }

      // Collect output for current test
      if (currentTest && line.trim() &&
          !line.startsWith('PASS') &&
          !line.startsWith('FAIL') &&
          !line.includes('Test Suites:') &&
          !line.includes('Tests:') &&
          !line.includes('Snapshots:') &&
          !line.includes('Time:')) {
        currentOutput.push(line.trim());
      }
    }

    // Add last test if exists
    if (currentTest) {
      currentTest.output = currentOutput;
    }

    const results = {
      framework: 'jest',
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.passed).length,
        failed: tests.filter(t => !t.passed).length,
      },
    };

    debug('Parsed results:', results);
    return results;
  }

  private createSummary(results: ParsedResults): string {
    const { framework, summary, tests } = results;
    
    let text = `Test Results (${framework})\n`;
    text += '='.repeat(20) + '\n\n';
    
    if (summary) {
      text += `Total Tests: ${summary.total}\n`;
      text += `Passed: ${summary.passed}\n`;
      text += `Failed: ${summary.failed}\n\n`;
    }

    if (tests && tests.length > 0) {
      text += 'Test Details:\n';
      text += '-'.repeat(12) + '\n\n';
      
      tests.forEach(test => {
        text += `${test.passed ? '✓' : '✗'} ${test.name}\n`;
        if (!test.passed && test.output.length > 0) {
          text += 'Output:\n';
          test.output.forEach(line => {
            text += `  ${line}\n`;
          });
          text += '\n';
        }
      });
    }

    return text;
  }

  async run(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('Test Runner MCP server running on stdio');
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

const server = new TestRunnerServer();
server.run().catch(console.error);