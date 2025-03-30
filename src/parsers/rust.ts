import { ParsedResults, TestParser, TestResult } from './types.js';
import { debug } from '../utils.js';

export class RustParser implements TestParser {
  parse(stdout: string, stderr: string): ParsedResults {
    debug('Parsing Rust test results');
    
    const combinedOutput = `${stdout}\n${stderr}`.trim();
    const tests: TestResult[] = [];
    
    // Track tests and results
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let duration = 0;
    
    try {
      // Regular expressions for parsing cargo test output
      const testResultRegex = /test (.*) \.\.\. (ok|FAILED|ignored)/g;
      const summaryRegex = /test result: (.*)\. (\d+) passed; (\d+) failed; (\d+) ignored/;
      const durationRegex = /finished in ([0-9.]+)s/;
      
      // Check if we have a compilation error first
      if (stderr.includes('error: could not compile') || stderr.includes('error[E')) {
        let errorLines = stderr.split('\n').filter(line => 
          line.includes('error:') || line.includes('error[')
        );
        
        tests.push({
          name: 'Compilation Error',
          passed: false,
          output: errorLines.length > 0 ? errorLines : ['Compilation error'],
          rawOutput: stderr
        });
        
        totalTests = 1;
        passedTests = 0;
        failedTests = 1;
      }
      // Parse normal test output
      else {
        // Extract individual test results
        let match;
        while ((match = testResultRegex.exec(combinedOutput)) !== null) {
          const testName = match[1];
          const testResult = match[2];
          const passed = testResult === 'ok';
          const ignored = testResult === 'ignored';
          
          if (!ignored) {
            // For failed tests, try to extract the error message
            let testOutput: string[] = [match[0]];
            let rawOutput = match[0];
            
            if (testResult === 'FAILED') {
              // Extract the error details for failed tests
              const failureBlockPattern = `---- ${testName} ----`;
              const failureSectionIndex = combinedOutput.indexOf(failureBlockPattern);
              
              if (failureSectionIndex >= 0) {
                // Find the end of this failure block
                let endIndex = combinedOutput.indexOf('\n\n', failureSectionIndex + failureBlockPattern.length);
                if (endIndex === -1) {
                  endIndex = combinedOutput.length;
                }
                
                // Extract the relevant section
                const failureBlock = combinedOutput.substring(
                  failureSectionIndex, 
                  endIndex
                );
                
                // Add each line of the failure as output
                const failureLines = failureBlock.split('\n')
                  .map(line => line.trim())
                  .filter(line => line.length > 0);
                
                testOutput = [...failureLines];
                rawOutput = failureBlock;
              }
            }
            
            tests.push({
              name: testName,
              passed,
              output: testOutput,
              rawOutput
            });
          }
        }
        
        // Extract summary information
        const summaryMatch = combinedOutput.match(summaryRegex);
        if (summaryMatch) {
          const result = summaryMatch[1]; // "ok" or "FAILED"
          passedTests = parseInt(summaryMatch[2], 10);
          failedTests = parseInt(summaryMatch[3], 10);
          const ignoredTests = parseInt(summaryMatch[4], 10);
          totalTests = passedTests + failedTests;
        } else {
          // If no summary found, calculate from test results
          totalTests = tests.length;
          passedTests = tests.filter(t => t.passed).length;
          failedTests = tests.filter(t => !t.passed).length;
        }
        
        // Extract duration information
        const durationMatch = combinedOutput.match(durationRegex);
        if (durationMatch) {
          duration = parseFloat(durationMatch[1]) * 1000; // Convert to ms
        }
      }
      
      // Handle empty test results
      if (tests.length === 0 && stderr) {
        tests.push({
          name: 'Test Execution Error',
          passed: false,
          output: stderr.split('\n'),
          rawOutput: stderr
        });
        
        totalTests = 1;
        passedTests = 0;
        failedTests = 1;
      }
      
      return {
        framework: 'rust',
        tests,
        summary: {
          total: totalTests,
          passed: passedTests,
          failed: failedTests,
          duration
        },
        rawOutput: combinedOutput
      };
    } catch (error) {
      debug('Error parsing Rust output:', error);
      // Fix the type error: Split the error message and create a proper string array
      const errorMessage = (error as Error).message;
      const errorLines = errorMessage.split('\n');
      
      return {
        framework: 'rust',
        tests: [{
          name: 'Parser Error',
          passed: false,
          output: errorLines,
          rawOutput: (error as Error).stack
        }],
        summary: {
          total: 1,
          passed: 0,
          failed: 1
        },
        rawOutput: combinedOutput
      };
    }
  }
}