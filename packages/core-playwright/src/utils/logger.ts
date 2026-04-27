import log4js, { type Logger } from 'log4js';

const DEFAULT_LOG_LEVEL = 'info';
const LOG_PATTERN = '%d{yyyy-MM-dd hh:mm:ss.SSS} [%p] %c - %m';

let configured = false;

/**
 * Configures log4js once for the core framework.
 */
function configureLogger(): void {
  if (configured) {
    return;
  }

  log4js.configure({
    appenders: {
      out: { type: 'stdout', layout: { type: 'pattern', pattern: LOG_PATTERN } },
    },
    categories: {
      default: {
        appenders: ['out'],
        level: process.env.CORE_LOG_LEVEL ?? DEFAULT_LOG_LEVEL,
      },
    },
  });

  configured = true;
}

/**
 * Creates or returns a named logger instance.
 */
export function getLogger(category: string): Logger {
  configureLogger();
  return log4js.getLogger(category);
}
