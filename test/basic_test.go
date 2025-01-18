package test

import "testing"

func TestAdd(t *testing.T) {
	result := 2 + 2
	if result != 4 {
		t.Errorf("Expected 2 + 2 to equal 4, got %d", result)
	}
}

func TestString(t *testing.T) {
	str := "hello"
	if len(str) != 5 {
		t.Errorf("Expected length of 'hello' to be 5, got %d", len(str))
	}
}

func TestWithOutput(t *testing.T) {
	t.Log("some test output")
	if true != true {
		t.Error("This should never fail")
	}
}

func TestSlice(t *testing.T) {
	slice := []int{1, 2, 3}
	if len(slice) != 3 {
		t.Errorf("Expected slice length to be 3, got %d", len(slice))
	}
}