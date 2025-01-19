export const debug = (...args: any[]): void => {
  // Only output debug messages in development mode
  if (process.env.NODE_ENV === 'development') {
    console.error('[DEBUG]', ...args);
  }
};