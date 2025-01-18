test('basic addition test', () => {
  expect(2 + 2).toBe(4);
});

test('string test', () => {
  expect('hello'.toUpperCase()).toBe('HELLO');
});

test('list test', () => {
  const list = [1, 2, 3];
  expect(list.length).toBe(3);
});

test('test with output', () => {
  console.log('some test output');
  expect(true).toBe(true);
});