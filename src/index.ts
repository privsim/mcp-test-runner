#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Request
} from '@modelcontextprotocol/sdk/types.js';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SpawnOptions } from 'node:child_process';
import { TestParserFactory, type Framework, type ParsedResults } from './parsers/index.js';
import { validateCommand, sanitizeEnvironmentVariables, type SecurityOptions } from './security.js';
import { debug } from './utils.js';

const DEFAULT_TIMEOUT = 300000; // 5 minutes

interface TestRunArguments {
  command: string;
  workingDir: string;
  framework: Framework;
  outputDir?: string;
  timeout?: number;
  env?: Record<string, string>;
  securityOptions?: Partial<SecurityOptions>;
}

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
                    enum: ['bats', 'pytest', 'flutter', 'jest', 'go', 'rust', 'generic'],
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
                  securityOptions: {
                    type: 'object',
                    description: 'Security options for command execution',
                    properties: {
                      allowSudo: {
                        type: 'boolean',
                        description: 'Allow sudo commands (default: false)'
                      },
                      allowSu: {
                        type: 'boolean',
                        description: 'Allow su commands (default: false)'
                      },
                      allowShellExpansion: {
                        type: 'boolean',
                        description: 'Allow shell expansion like $() or backticks (default: true)'
                      },
                      allowPipeToFile: {
                        type: 'boolean',
                        description: 'Allow pipe to file operations (default: false)'
                      }
                    }
                  }
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

  // Add parseTestResults method to fix the tests
  parseTestResults(framework: Framework, stdout: string, stderr: string): ParsedResults {
    return TestParserFactory.parseTestResults(framework, stdout, stderr);
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
                enum: ['bats', 'pytest', 'flutter', 'jest', 'go', 'rust', 'generic'],
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
              securityOptions: {
                type: 'object',
                description: 'Security options for command execution',
                properties: {
                  allowSudo: {
                    type: 'boolean',
                    description: 'Allow sudo commands (default: false)'
                  },
                  allowSu: {
                    type: 'boolean',
                    description: 'Allow su commands (default: false)'
                  },
                  allowShellExpansion: {
                    type: 'boolean',
                    description: 'Allow shell expansion like $() or backticks (default: true)'
                  },
                  allowPipeToFile: {
                    type: 'boolean',
                    description: 'Allow pipe to file operations (default: false)'
                  }
                }
              }
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

      const { command, workingDir, framework, outputDir = 'test_reports', timeout = DEFAULT_TIMEOUT, env, securityOptions } = args;

      // Validate command against security rules
      if (framework === 'generic') {
        const validation = validateCommand(command, securityOptions);
        if (!validation.isValid) {
          throw new Error(`Command validation failed: ${validation.reason}`);
        }
      }

      debug('Running tests with args:', { command, workingDir, framework, outputDir, timeout, env });

      // Create output directory
      const resultDir = join(workingDir, outputDir);
      await mkdir(resultDir, { recursive: true });

      try {
        // Run tests with timeout
        const { stdout, stderr } = await this.executeTestCommand(command, workingDir, framework, resultDir, timeout, env, securityOptions);

        // Save raw output
        await writeFile(join(resultDir, 'test_output.log'), stdout);
        if (stderr) {
          await writeFile(join(resultDir, 'test_errors.log'), stderr);
        }

        // Parse the test results using the appropriate parser
        try {
          const results = this.parseTestResults(framework, stdout, stderr);
          // Write parsed results to file
          await writeFile(join(resultDir, 'test_results.json'), JSON.stringify(results, null, 2));
          
          // Create a summary file
          const summaryContent = this.generateSummary(results);
          await writeFile(join(resultDir, 'summary.txt'), summaryContent);
        } catch (parseError) {
          debug('Error parsing test results:', parseError);
          // Still continue even if parsing fails
        }

        return {
          content: [
            {
              type: 'text',
              text: stdout + (stderr ? '\n' + stderr : ''),
            },
          ],
          isError: stdout.includes('failed') || stdout.includes('[E]') || stderr.length > 0,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        debug('Test execution failed:', errorMessage);
        throw new Error(`Test execution failed: ${errorMessage}`);
      }
    });
  }

  private generateSummary(results: ParsedResults): string {
    const { summary, framework, tests } = results;
    let content = `Test Framework: ${framework}\n`;
    content += `Total Tests: ${summary.total}\n`;
    content += `Passed: ${summary.passed}\n`;
    content += `Failed: ${summary.failed}\n`;
    
    if (summary.duration !== undefined) {
      content += `Duration: ${summary.duration}ms\n`;
    }
    
    content += '\n--- Test Results ---\n';
    
    for (const test of tests) {
      content += `${test.passed ? '✓' : '✗'} ${test.name}\n`;
    }
    
    if (summary.failed > 0) {
      content += '\n--- Failed Tests ---\n';
      for (const test of tests.filter(t => !t.passed)) {
        content += `✗ ${test.name}\n`;
        content += test.output.map(line => `  ${line}`).join('\n');
        content += '\n\n';
      }
    }
    
    return content;
  }

  private getFlutterEnv(): Record<string, string> {
    const home = homedir();
    const flutterRoot = '/opt/homebrew/Caskroom/flutter/3.27.2/flutter';
    const pubCache = `${home}/.pub-cache`;
    const flutterBin = `${flutterRoot}/bin`;
    
    return {
      HOME: home,
      FLUTTER_ROOT: flutterRoot,
      PUB_CACHE: pubCache,
      PATH: `${flutterBin}:${process.env.PATH || ''}`,
      FLUTTER_TEST: 'true'
    };
  }

  private verifyFlutterInstallation(spawnOptions: SpawnOptions): void {
    const flutterPath = spawnSync('which', ['flutter'], spawnOptions);
    if (flutterPath.status !== 0) {
      throw new Error('Flutter not found in PATH. Please ensure Flutter is installed and in your PATH.');
    }

    const flutterDoctor = spawnSync('flutter', ['doctor', '--version'], spawnOptions);
    if (flutterDoctor.status !== 0) {
      throw new Error('Flutter installation verification failed. Please run "flutter doctor" to check your setup.');
    }
  }

  private async executeTestCommand(
    command: string,
    workingDir: string,
    framework: Framework,
    resultDir: string,
    timeout: number,
    env?: Record<string, string>,
    securityOptions?: Partial<SecurityOptions>
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Test execution timed out'));
      }, timeout);

      // Split command into executable and args
      const parts = command.split(' ');
      const cmd = parts[0];
      const cmdArgs = parts.slice(1);

      debug('Executing command:', { cmd, cmdArgs, workingDir });

      // Sanitize environment variables for security
      const safeEnv = sanitizeEnvironmentVariables(env);

      const spawnOptions: SpawnOptions = {
        cwd: workingDir,
        env: { ...process.env, ...safeEnv },
        shell: true,
      };

      // Add framework-specific environment if needed
      if (framework === 'flutter') {
        spawnOptions.env = {
          ...spawnOptions.env,
          ...this.getFlutterEnv()
        };
        
        try {
          this.verifyFlutterInstallation(spawnOptions);
        } catch (error) {
          clearTimeout(timer);
          reject(error);
          return;
        }
      } else if (framework === 'rust') {
        // Ensure RUST_BACKTRACE is set for better error reporting
        spawnOptions.env = {
          ...spawnOptions.env,
          RUST_BACKTRACE: '1'
        };
      }

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
      });

      childProcess.on('error', (error: Error) => {
        debug('Process error:', error);
        clearTimeout(timer);
        reject(error);
      });

      childProcess.on('close', async (code: number | null) => {
        clearTimeout(timer);
        debug('Process closed with code:', code);
        resolve({ stdout, stderr });
      });
    });
  }

  private isValidTestRunArguments(args: unknown): args is TestRunArguments {
    if (typeof args !== 'object' || args === null) return false;
    const a = args as Record<string, unknown>;
    
    // Check basic required params
    const basicCheck = (
      typeof a.command === 'string' &&
      typeof a.workingDir === 'string' &&
      typeof a.framework === 'string' &&
      ['bats', 'pytest', 'flutter', 'jest', 'go', 'rust', 'generic'].includes(a.framework) &&
      (a.outputDir === undefined || typeof a.outputDir === 'string') &&
      (a.timeout === undefined || (typeof a.timeout === 'number' && a.timeout > 0)) &&
      (a.env === undefined || (typeof a.env === 'object' && a.env !== null &&
        Object.entries(a.env).every(([key, value]) => typeof key === 'string' && typeof value === 'string')))
    );
    
    if (!basicCheck) return false;
    
    // Check securityOptions if present
    if (a.securityOptions !== undefined) {
      if (typeof a.securityOptions !== 'object' || a.securityOptions === null) return false;
      
      const s = a.securityOptions as Record<string, unknown>;
      
      // Check security options types
      const securityCheck = (
        (s.allowSudo === undefined || typeof s.allowSudo === 'boolean') &&
        (s.allowSu === undefined || typeof s.allowSu === 'boolean') &&
        (s.allowShellExpansion === undefined || typeof s.allowShellExpansion === 'boolean') &&
        (s.allowPipeToFile === undefined || typeof s.allowPipeToFile === 'boolean')
      );
      
      if (!securityCheck) return false;
    }
    
    return true;
  }

  async run(): Promise<void> {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

const server = new TestRunnerServer();
server.run().catch(console.error);