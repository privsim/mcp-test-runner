import type { Framework } from '../parsers/index.js';

const mockOutputs = {
  bats: {
    success: `
ok 1 basic addition works
ok 2 check current working directory
ok 3 verify environment variable
ok 4 test with output
`,
    failure: `
ok 1 basic addition works
not ok 2 failed test
# (in test file test/basic.bats, line 9)
#   \`[ "$result" -eq 5 ]\' failed
`,
    with_output: `
ok 1 test with output
some test output
`
  },
  
  pytest: {
    success: `
test_basic.py::test_addition PASSED [ 25%]
test_basic.py::test_string PASSED  [ 50%]
test_basic.py::test_list PASSED    [ 75%]
test_basic.py::test_with_output PASSED [100%]
`,
    failure: `
test_basic.py::test_addition PASSED
test_basic.py::test_failing FAILED
    def test_failing():
>       assert 1 == 2
E       assert 1 == 2
`,
    with_output: `
test_basic.py::test_with_output PASSED
some test output
`
  },
  
  go: {
    success: `
=== RUN   TestAdd
--- PASS: TestAdd (0.00s)
=== RUN   TestString
--- PASS: TestString (0.00s)
=== RUN   TestSlice
--- PASS: TestSlice (0.00s)
PASS
`,
    failure: `
=== RUN   TestAdd
--- PASS: TestAdd (0.00s)
=== RUN   TestFailing
--- FAIL: TestFailing (0.00s)
    basic_test.go:15: Expected 2 + 2 to equal 5
FAIL
`,
    with_output: `
=== RUN   TestWithOutput
some test output
--- PASS: TestWithOutput (0.00s)
PASS
`
  },
  
  jest: {
    success: `
✓ basic addition test (2ms)
✓ string test (1ms)
✓ list test (1ms)
`,
    failure: `
✓ basic addition test (2ms)
✕ failing test (1ms)
  Expected: 5
  Received: 4
`,
    with_output: `
✓ test with output (1ms)
  console.log
    some test output
`
  },

  flutter: {
    success: `
00:01 +1: test one
00:02 +2: test two
00:03 +3: All tests passed!
`,
    failure: `
00:01 +1: loading test/widget_test.dart
00:01 -2: failing test
  Expected: true
  Actual: false
`,
    with_output: `
00:01 +1: test with output
  log output: some test output
`
  }
};

export const getMockOutput = (framework: Framework, type: 'success' | 'failure' | 'with_output'): string => {
  return mockOutputs[framework]?.[type] ?? '';
};