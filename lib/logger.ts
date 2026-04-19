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
 * Log level filtering — in production suppress debug/info
 */
const LOG_LEVEL =
  typeof process !== "undefined" && process.env.NODE_ENV === "production"
    ? "warn"
    : "debug";
const LEVELS: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
function shouldLog(level: string): boolean {
  return LEVELS[level] >= LEVELS[LOG_LEVEL];
}

/**
 * Default logger that wraps console methods with level filtering
 */
const logger: Logger = {
  log: (...args: unknown[]) => { if (shouldLog("info")) console.log(...args); },
  warn: (...args: unknown[]) => { if (shouldLog("warn")) console.warn(...args); },
  error: (...args: unknown[]) => console.error(...args),
  info: (...args: unknown[]) => { if (shouldLog("info")) console.info(...args); },
  debug: (...args: unknown[]) => { if (shouldLog("debug")) console.debug(...args); },
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
      if (shouldLog("warn")) console.warn(prefix, ...args);
    },
    info: (...args: unknown[]) => {
      if (shouldLog("info")) console.info(prefix, ...args);
    },
  };
}
