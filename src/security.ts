export interface SecurityOptions {
  allowSudo: boolean;
  allowSu: boolean;
  allowShellExpansion: boolean;
  allowPipeToFile: boolean;
  blockedCommands: string[];
  blockedPatterns: RegExp[];
}

export const DEFAULT_SECURITY_OPTIONS: SecurityOptions = {
  allowSudo: false,
  allowSu: false,
  allowShellExpansion: true,
  allowPipeToFile: false,
  blockedCommands: [
    'rm -rf /',
    'rm -rf /*',
    '> /dev/sda',
    'mkfs',
    'dd if=/dev/zero',
    'chmod 777 /',
    ':(){:|:&};:',
    'eval',
    'exec',
  ],
  blockedPatterns: [
    // These patterns will be checked conditionally based on security options
    /\bsu\b/,
    /\s>\s*\/(?!tmp|var\/tmp|dev\/null)/,  // Block writing to system dirs but allow /tmp, /var/tmp, /dev/null
    /\|\s*sh$/,
    /\|\s*bash$/,
    /\bcurl\s+.*\s*\|\s*sh/,
    /\bwget\s+.*\s*\|\s*sh/,
  ],
};

export function validateCommand(command: string, options: Partial<SecurityOptions> = {}): { isValid: boolean; reason?: string } {
  const securityOpts: SecurityOptions = { ...DEFAULT_SECURITY_OPTIONS, ...options };
  
  // Check for sudo if not allowed
  if (!securityOpts.allowSudo && command.includes('sudo')) {
    return { isValid: false, reason: 'Command contains sudo, which is not allowed by default' };
  }
  
  // Check for su if not allowed
  if (!securityOpts.allowSu && /\bsu\b/.test(command)) {
    return { isValid: false, reason: 'Command contains su, which is not allowed by default' };
  }
  
  // Check for shell expansion if not allowed
  if (!securityOpts.allowShellExpansion && 
      (command.includes('$(') || command.includes('`') || command.includes('${'))) {
    return { isValid: false, reason: 'Command contains shell expansion, which is not allowed' };
  }
  
  // Check for redirecting output to files if not allowed
  // Fixed to properly respect allowPipeToFile option
  if (!securityOpts.allowPipeToFile) {
    // Check for redirects to system directories, but always allow /tmp
    if (/\s>\s*\/(?!tmp|var\/tmp|dev\/null)/.test(command)) {
      return { isValid: false, reason: 'Command contains file redirects to system directories, which are not allowed by default' };
    }
  }
  
  // Always allow redirects to /tmp
  if (/\s>\s*\/tmp\//.test(command)) {
    return { isValid: true };
  }
  
  // Check for explicitly blocked commands
  for (const blockedCmd of securityOpts.blockedCommands) {
    if (command.includes(blockedCmd)) {
      return { isValid: false, reason: `Command contains blocked pattern: ${blockedCmd}` };
    }
  }
  
  // Check for blocked patterns that aren't handled by options
  const dangerousPatterns = [
    /\|\s*sh$/,
    /\|\s*bash$/,
    /\bcurl\s+.*\s*\|\s*sh/,
    /\bwget\s+.*\s*\|\s*sh/,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return { isValid: false, reason: `Command matches blocked pattern: ${pattern}` };
    }
  }
  
  return { isValid: true };
}

export function sanitizeEnvironmentVariables(env: Record<string, string> = {}): Record<string, string> {
  const sanitizedEnv: Record<string, string> = {};
  
  // List of potentially dangerous environment variables to filter out
  const blockedEnvVars = [
    'LD_PRELOAD',
    'LD_LIBRARY_PATH',
    'DYLD_INSERT_LIBRARIES',
    'DYLD_LIBRARY_PATH',
    'DYLD_FRAMEWORK_PATH',
    'PATH', // Don't allow overriding PATH completely, but we'll handle it specially
  ];
  
  // Copy safe environment variables
  for (const [key, value] of Object.entries(env)) {
    if (!blockedEnvVars.includes(key)) {
      sanitizedEnv[key] = value;
    }
  }
  
  // Special handling for PATH - don't replace but append
  if (env.PATH) {
    sanitizedEnv.PATH = `${process.env.PATH || ''}:${env.PATH}`;
  }
  
  return sanitizedEnv;
}