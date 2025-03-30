#[cfg(test)]
mod tests {
    #[test]
    fn test_addition() {
        assert_eq!(2 + 2, 4);
    }

    #[test]
    fn test_string() {
        let s = "hello";
        assert_eq!(s.to_uppercase(), "HELLO");
    }

    #[test]
    fn test_vector() {
        let v = vec![1, 2, 3];
        assert_eq!(v.len(), 3);
    }

    #[test]
    fn test_with_output() {
        println!("some test output");
        assert!(true);
    }
}