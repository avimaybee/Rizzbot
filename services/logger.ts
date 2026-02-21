/**
 * Centralized logging utility.
 * Suppresses debug/log in production, but always shows warn/error.
 */

const isDev = import.meta.env.DEV;

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (isDev) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },

  log: (message: string, ...args: any[]) => {
    if (isDev) {
      console.log(`[LOG] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },

  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  }
};
