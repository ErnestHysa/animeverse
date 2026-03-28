/**
 * Production-ready logger utility
 * Logs are only output in development or when explicitly enabled
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'log';

const isDevelopment = process.env.NODE_ENV === 'development';
const isLoggingEnabled = process.env.NEXT_PUBLIC_ENABLE_LOGGING === 'true' || isDevelopment;

// Determine the minimum log level
const logLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL || 'info') as LogLevel;

const levelPriority: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  log: 3,
  debug: 4,
};

function shouldLog(level: LogLevel): boolean {
  if (!isLoggingEnabled) {
    return false;
  }
  return levelPriority[level] <= (levelPriority[logLevel] || 2);
}

const logger = {
  error: (...args: unknown[]) => {
    if (shouldLog('error')) {
      console.error('[App]', ...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (shouldLog('warn')) {
      console.warn('[App]', ...args);
    }
  },
  info: (...args: unknown[]) => {
    if (shouldLog('info')) {
      console.info('[App]', ...args);
    }
  },
  log: (...args: unknown[]) => {
    if (shouldLog('log')) {
      console.log('[App]', ...args);
    }
  },
  debug: (...args: unknown[]) => {
    if (shouldLog('debug')) {
      console.debug('[App]', ...args);
    }
  },
};

export default logger;

/**
 * Create a scoped logger with a prefix
 */
export function createScopedLogger(scope: string) {
  return {
    error: (...args: unknown[]) => logger.error(`[${scope}]`, ...args),
    warn: (...args: unknown[]) => logger.warn(`[${scope}]`, ...args),
    info: (...args: unknown[]) => logger.info(`[${scope}]`, ...args),
    log: (...args: unknown[]) => logger.log(`[${scope}]`, ...args),
    debug: (...args: unknown[]) => logger.debug(`[${scope}]`, ...args),
  };
}
