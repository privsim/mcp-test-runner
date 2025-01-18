def test_addition():
    assert 2 + 2 == 4

def test_string():
    assert "hello".upper() == "HELLO"

def test_list():
    my_list = [1, 2, 3]
    assert len(my_list) == 3

def test_with_output(capsys):
    print("some test output")
    assert True