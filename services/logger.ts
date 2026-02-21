/**
 * Centralized logger for the application.
 * In development mode (import.meta.env.DEV), all logs are active.
 * In production mode, only warnings and errors are output to the console.
 */
export const logger = {
  log: (message: string, ...args: any[]) => {
    if (import.meta.env.DEV) {
      console.log(message, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(message, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(message, ...args);
  },
  debug: (message: string, ...args: any[]) => {
    if (import.meta.env.DEV) {
      console.debug(message, ...args);
    }
  }
};
