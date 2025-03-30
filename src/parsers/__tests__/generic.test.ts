import { GenericParser } from '../generic.js';

describe('GenericParser', () => {
  const parser = new GenericParser();

  it('should parse successful output with sections', () => {
    const stdout = `
    === Running CI Pipeline ===
    
    Running step: Build
    Compiling project...
    Build successful!
    
    Running step: Linting
    Linting with eslint...
    Linting with prettier...
    All files pass linting rules!
    
    Running step: Tests
    All tests pass!
    
    === CI Pipeline Completed Successfully ===
    `;
    const stderr = '';

    const result = parser.parse(stdout, stderr);

    expect(result.framework).toBe('generic');
    expect(result.tests.length).toBeGreaterThan(1);
    expect(result.tests.some(t => t.name.includes('Running step: Build'))).toBeTruthy();
    expect(result.tests.every(t => t.passed)).toBeTruthy();
    expect(result.summary.failed).toBe(0);
    expect(result.summary.total).toBe(result.tests.length);
  });

  it('should identify failed sections', () => {
    const stdout = `
    === Running CI Pipeline ===
    
    Running step: Build
    Compiling project...
    Build successful!
    
    Running step: Linting
    Linting with eslint...
    ERROR: Found 2 linting errors in file.js
    
    Running step: Tests
    All tests pass!
    
    === CI Pipeline Failed ===
    `;
    const stderr = '';

    const result = parser.parse(stdout, stderr);

    expect(result.framework).toBe('generic');
    expect(result.tests.length).toBeGreaterThan(1);
    
    // Find the linting test
    const lintingTest = result.tests.find(t => t.name.includes('Linting'));
    expect(lintingTest).toBeDefined();
    expect(lintingTest?.passed).toBeFalsy();
    
    // Build should have passed
    const buildTest = result.tests.find(t => t.name.includes('Build'));
    expect(buildTest).toBeDefined();
    expect(buildTest?.passed).toBeTruthy();
    
    expect(result.summary.failed).toBeGreaterThan(0);
  });

  it('should handle GitHub Actions output', () => {
    const stdout = `
    [2024-03-28 10:15:32] Starting GitHub Actions workflow...
    [2024-03-28 10:15:33] Set up job
    [2024-03-28 10:15:35] Run actions/checkout@v3
    [2024-03-28 10:15:40] Run npm install
    [2024-03-28 10:16:01] Run npm test
    
    > project@1.0.0 test
    > jest
    
    PASS  src/utils.test.js
    FAIL  src/app.test.js
      ● App › renders without crashing
      
        expect(received).toBe(expected)
        
        Expected: true
        Received: false
      
    Test Suites: 1 failed, 1 passed, 2 total
    Tests:       1 failed, 3 passed, 4 total
    
    [2024-03-28 10:16:30] Error: Process completed with exit code 1.
    `;
    const stderr = '';

    const result = parser.parse(stdout, stderr);

    expect(result.framework).toBe('generic');
    expect(result.tests.length).toBeGreaterThan(1);
    expect(result.tests.some(t => t.name.includes('FAIL'))).toBeTruthy();
    expect(result.summary.failed).toBeGreaterThan(0);
  });

  it('should handle Docker output', () => {
    const stdout = `
    Building image...
    Step 1/10 : FROM node:16
     ---> a5a50c3e0805
    Step 2/10 : WORKDIR /app
     ---> Using cache
     ---> 9c40b8d12fb3
    Step 3/10 : COPY package*.json ./
     ---> Using cache
     ---> 8a0ef1b2a93c
    Step 4/10 : RUN npm install
     ---> Using cache
     ---> 7e82faa9e5e6
    Step 5/10 : COPY . .
     ---> 123abc456def
    Step 6/10 : RUN npm test
     ---> Running in abcdef123456
    
    > project@1.0.0 test
    > jest
    
    PASS  src/utils.test.js
    PASS  src/app.test.js
    
    Test Suites: 2 passed, 2 total
    Tests:       4 passed, 4 total
    
     ---> 789ghi101112
    Step 7/10 : RUN npm run build
     ---> Running in 567jkl890123
    
    > project@1.0.0 build
    > webpack
    
    asset bundle.js 1.2 MB [emitted]
    
     ---> 345mno678901
    Successfully built 345mno678901
    Successfully tagged myapp:latest
    `;
    const stderr = '';

    const result = parser.parse(stdout, stderr);

    expect(result.framework).toBe('generic');
    expect(result.tests.length).toBeGreaterThan(1);
    expect(result.summary.failed).toBe(0);
    expect(result.summary.total).toBe(result.tests.length);
  });

  it('should handle simple output without sections', () => {
    const stdout = `Script started
    No sections or defined output structure here
    Just a simple script execution
    Everything went well
    Script completed successfully`;
    const stderr = '';

    const result = parser.parse(stdout, stderr);

    expect(result.framework).toBe('generic');
    expect(result.tests.length).toBe(1);
    expect(result.tests[0].name).toBe('Complete Test Run');
    expect(result.tests[0].passed).toBeTruthy();
  });

  it('should handle stderr as failure', () => {
    const stdout = `Script started
    Running some tasks`;
    const stderr = `Error: something went wrong!`;

    const result = parser.parse(stdout, stderr);

    expect(result.framework).toBe('generic');
    expect(result.tests.length).toBeGreaterThan(0);
    expect(result.summary.failed).toBeGreaterThan(0);
    expect(result.tests.some(t => t.output.some(line => line.includes('Error')))).toBeTruthy();
  });
});
