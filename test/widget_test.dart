import 'package:flutter_test/flutter_test.dart';

void main() {
  test('basic addition test', () {
    expect(2 + 2, equals(4));
  });

  test('string test', () {
    expect('hello'.toUpperCase(), equals('HELLO'));
  });

  test('list test', () {
    final list = [1, 2, 3];
    expect(list.length, equals(3));
  });

  test('test with output', () {
    print('some test output');
    expect(true, isTrue);
  });
}
