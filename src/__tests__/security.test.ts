import { validateCommand, sanitizeEnvironmentVariables } from '../security.js';

describe('Security Module', () => {
  describe('validateCommand', () => {
    it('should allow safe commands', () => {
      const safeCommands = [
        'echo "Hello World"',
        'npm test',
        'cargo test',
        'pytest tests/',
        'go test ./...',
        'act -j build',
        'docker-compose up',
        'ls -la',
        'cat file.txt | grep pattern',
      ];
      
      for (const cmd of safeCommands) {
        const result = validateCommand(cmd);
        expect(result.isValid).toBeTruthy();
      }
    });
    
    it('should block sudo commands by default', () => {
      const result = validateCommand('sudo npm install -g package');
      expect(result.isValid).toBeFalsy();
      expect(result.reason).toContain('sudo');
    });
    
    it('should allow sudo when explicitly enabled', () => {
      const result = validateCommand('sudo docker-compose up', { allowSudo: true });
      expect(result.isValid).toBeTruthy();
    });
    
    it('should block su commands by default', () => {
      const result = validateCommand('su -c "npm install"');
      expect(result.isValid).toBeFalsy();
      expect(result.reason).toContain('su');
    });
    
    it('should block dangerous commands', () => {
      const dangerousCommands = [
        'rm -rf /',
        'rm -rf /*',
        '> /dev/sda',
        'mkfs /dev/sda',
        'dd if=/dev/zero of=/dev/sda',
        'chmod 777 /',
        ':(){:|:&};:', // Fork bomb
      ];
      
      for (const cmd of dangerousCommands) {
        const result = validateCommand(cmd);
        expect(result.isValid).toBeFalsy();
      }
    });
    
    it('should block file redirects to system directories by default', () => {
      const result = validateCommand('echo "malicious" > /etc/passwd');
      expect(result.isValid).toBeFalsy();
    });
    
    it('should allow file redirects to /tmp', () => {
      const result = validateCommand('echo "output" > /tmp/test-output.txt');
      expect(result.isValid).toBeTruthy();
    });
    
    it('should block curl piped to shell', () => {
      const result = validateCommand('curl https://example.com/script.sh | sh');
      expect(result.isValid).toBeFalsy();
    });
  });
  
  describe('sanitizeEnvironmentVariables', () => {
    it('should pass through safe environment variables', () => {
      const env = {
        NODE_ENV: 'test',
        TEST_VAR: 'value',
        HOME: '/home/user'
      };
      
      const sanitized = sanitizeEnvironmentVariables(env);
      expect(sanitized.NODE_ENV).toBe('test');
      expect(sanitized.TEST_VAR).toBe('value');
      expect(sanitized.HOME).toBe('/home/user');
    });
    
    it('should filter out dangerous environment variables', () => {
      const env = {
        NODE_ENV: 'test',
        LD_PRELOAD: '/path/to/malicious.so',
        LD_LIBRARY_PATH: '/bad/path'
      };
      
      const sanitized = sanitizeEnvironmentVariables(env);
      expect(sanitized.NODE_ENV).toBe('test');
      expect(sanitized.LD_PRELOAD).toBeUndefined();
      expect(sanitized.LD_LIBRARY_PATH).toBeUndefined();
    });
    
    it('should handle PATH appropriately', () => {
      const originalPath = process.env.PATH;
      const env = {
        PATH: '/malicious/path'
      };
      
      const sanitized = sanitizeEnvironmentVariables(env);
      expect(sanitized.PATH).toBe(`${originalPath || ''}:/malicious/path`);
    });
    
    it('should handle empty environment', () => {
      const sanitized = sanitizeEnvironmentVariables();
      expect(sanitized).toEqual({});
    });
  });
});
