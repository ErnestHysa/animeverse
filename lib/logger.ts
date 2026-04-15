/**
 * Logger Utility
 * Provides both a default console logger and scoped logger factories
 */

interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

interface ScopedLogger {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
}

/**
 * Default logger that wraps console methods
 */
const logger: Logger = {
  log: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
  info: (...args: unknown[]) => console.info(...args),
  debug: (...args: unknown[]) => console.debug(...args),
};

export default logger;

/**
 * Create a scoped logger with a prefix tag
 */
export function createScopedLogger(scope: string): ScopedLogger {
  const prefix = `[${scope}]`;

  return {
    error: (...args: unknown[]) => {
      console.error(prefix, ...args);
    },
    warn: (...args: unknown[]) => {
      console.warn(prefix, ...args);
    },
    info: (...args: unknown[]) => {
      console.info(prefix, ...args);
    },
  };
}
