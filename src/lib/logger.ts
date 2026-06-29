const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : (import.meta as any).env?.DEV;

export const logger = {
  info: (module: string, message: string, data?: any) => {
    if (isDev) {
      if (data !== undefined) {
        console.log(`[${module}] ✅ ${message}`, data);
      } else {
        console.log(`[${module}] ✅ ${message}`);
      }
    }
  },
  warn: (module: string, message: string, data?: any) => {
    if (isDev) {
      if (data !== undefined) {
        console.warn(`[${module}] ⚠️ ${message}`, data);
      } else {
        console.warn(`[${module}] ⚠️ ${message}`);
      }
    }
  },
  error: (module: string, message: string, err?: any) => {
    if (err !== undefined) {
      console.error(`[${module}] ❌ ERROR: ${message}`, err);
    } else {
      console.error(`[${module}] ❌ ERROR: ${message}`);
    }
  }
};
