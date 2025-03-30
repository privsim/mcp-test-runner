#!/bin/bash
# Cleanup script for test files

echo "Cleaning up test files..."

# Remove test files
rm -f simple.bats
rm -f simple.test.js
rm -f test.bats
rm -f test_sample.py
rm -f test-rust-parser.js
rm -f test-security.js
rm -f run-tests.sh
rm -f build-and-test.sh

# Remove test directories
rm -rf simple_rust/
rm -rf framework_tests/

# Remove test output
rm -rf test_reports/*

echo "Cleanup complete!"
