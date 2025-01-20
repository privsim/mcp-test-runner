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
import { debug } from './utils.js';

const DEFAULT_TIMEOUT = 300000; // 5 minutes

interface TestRunArguments {
  command: string;
  workingDir: string;
  framework: Framework;
  outputDir?: string;
  timeout?: number;
  env?: Record<string, string>;
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
        const { stdout, stderr } = await this.executeTestCommand(command, workingDir, framework, resultDir, timeout, args.env);

        // Save raw output
        await writeFile(join(resultDir, 'test_output.log'), stdout);
        if (stderr) {
          await writeFile(join(resultDir, 'test_errors.log'), stderr);
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
    env?: Record<string, string>
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

      const spawnOptions: SpawnOptions = {
        cwd: workingDir,
        env: { ...process.env, ...(env || {}) },
        shell: true,
      };

      // Add Flutter-specific environment if needed
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