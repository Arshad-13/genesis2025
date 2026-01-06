/**
 * Centralized logging utility with environment-based levels
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const currentLevel = import.meta.env.MODE === 'production' 
  ? LOG_LEVELS.WARN 
  : LOG_LEVELS.DEBUG;

const formatMessage = (level, context, message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  const prefix = `[${timestamp}] [${level}]${context ? ` [${context}]` : ''}`;
  return [prefix, message, ...args];
};

export const logger = {
  error: (context, message, ...args) => {
    if (currentLevel >= LOG_LEVELS.ERROR) {
      console.error(...formatMessage('ERROR', context, message, ...args));
    }
  },

  warn: (context, message, ...args) => {
    if (currentLevel >= LOG_LEVELS.WARN) {
      console.warn(...formatMessage('WARN', context, message, ...args));
    }
  },

  info: (context, message, ...args) => {
    if (currentLevel >= LOG_LEVELS.INFO) {
      console.info(...formatMessage('INFO', context, message, ...args));
    }
  },

  debug: (context, message, ...args) => {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
      console.log(...formatMessage('DEBUG', context, message, ...args));
    }
  },
};

export default logger;
