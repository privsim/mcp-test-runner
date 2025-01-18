#!/usr/bin/env bats

@test "basic addition works" {
  result="$(( 2 + 2 ))"
  [ "$result" -eq 4 ]
}

@test "check current working directory" {
  run pwd
  [ "$status" -eq 0 ]
  [[ "$output" == *"test-runner"* ]]
}

@test "verify environment variable" {
  [ -n "$PATH" ]
}

@test "test with output" {
  echo "some test output"
  [ true ]
}