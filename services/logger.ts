/**
 * Centralized logger for the application.
 * In development mode (import.meta.env.DEV), all logs are active.
 * In production mode, only warnings and errors are output to the console.
 */
export const logger = {
  log: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
  debug: (...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.debug(...args);
    }
  },
  /**
   * Trigger haptic feedback if supported by the device.
   */
  triggerHaptic: (pattern: number | number[] | 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') => {
    if (typeof window === 'undefined' || !window.navigator?.vibrate) return;
    
    let vPattern: number | number[];
    switch (pattern) {
      case 'light': vPattern = 5; break;
      case 'medium': vPattern = 10; break;
      case 'heavy': vPattern = 20; break;
      case 'success': vPattern = [10, 30, 10]; break;
      case 'error': vPattern = [50, 100, 50]; break;
      default: vPattern = pattern;
    }
    
    try {
      window.navigator.vibrate(vPattern);
    } catch (e) {
      // Ignore vibration errors
    }
  }
};
