#!/bin/bash
set -e

echo "======================="
echo "Running tests for all frameworks"
echo "======================="

PROJECT_DIR="/Users/lclose/Documents/Cline/MCP/test-runner"
cd $PROJECT_DIR

# First, build the test-runner
echo "Building test-runner..."
npm run build

echo -e "\n======================="
echo "Running Bats tests"
echo "======================="
node build/index.js <<EOF
{
  "request": {
    "params": {
      "name": "run_tests",
      "arguments": {
        "command": "bats test/basic.bats",
        "workingDir": "$PROJECT_DIR",
        "framework": "bats"
      }
    },
    "type": "call_tool"
  }
}
EOF

echo -e "\n======================="
echo "Running Jest tests"
echo "======================="
node build/index.js <<EOF
{
  "request": {
    "params": {
      "name": "run_tests",
      "arguments": {
        "command": "npx jest test/basic.test.js",
        "workingDir": "$PROJECT_DIR",
        "framework": "jest"
      }
    },
    "type": "call_tool"
  }
}
EOF

echo -e "\n======================="
echo "Running Pytest tests"
echo "======================="
node build/index.js <<EOF
{
  "request": {
    "params": {
      "name": "run_tests",
      "arguments": {
        "command": "python -m pytest test/test_basic.py -v",
        "workingDir": "$PROJECT_DIR",
        "framework": "pytest"
      }
    },
    "type": "call_tool"
  }
}
EOF

echo -e "\n======================="
echo "Running Go tests"
echo "======================="
node build/index.js <<EOF
{
  "request": {
    "params": {
      "name": "run_tests",
      "arguments": {
        "command": "go test test/basic_test.go -v",
        "workingDir": "$PROJECT_DIR",
        "framework": "go"
      }
    },
    "type": "call_tool"
  }
}
EOF

echo -e "\n======================="
echo "Running Rust tests"
echo "======================="
node build/index.js <<EOF
{
  "request": {
    "params": {
      "name": "run_tests",
      "arguments": {
        "command": "rustc -o test/rust_test test/basic_test.rs && ./test/rust_test",
        "workingDir": "$PROJECT_DIR",
        "framework": "rust"
      }
    },
    "type": "call_tool"
  }
}
EOF

echo -e "\n======================="
echo "Done running all tests"
echo "======================="
