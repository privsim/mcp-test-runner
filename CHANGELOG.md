# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-03-28

### Added
- Support for Rust testing framework (cargo test)
- Generic framework for arbitrary command execution
- Security module to prevent dangerous command execution
- Command validation system to block risky operations
- Environment variable sanitization for improved security
- Configurable security options via server configuration
- Comprehensive test samples for new frameworks

### Fixed
- Improved error handling for test execution
- Enhanced results parsing and output formatting

### Security
- Added protection against sudo/su commands
- Blocked dangerous system commands
- Restricted filesystem access outside safe directories
- Prevented shell injection via pipes


## [0.1.1] - 2025-01-15

### Added
- Initial public release
- Support for Bats, Pytest, Flutter, Jest, and Go testing frameworks
- Structured test results output
- Comprehensive error handling
