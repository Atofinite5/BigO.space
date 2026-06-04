// logger.ts — thin wrapper so electron/ code can log consistently.
// In production the app uses electron-log; this shim keeps the import simple.

import log from 'electron-log'

export const logger = {
  info: (...args: unknown[]) => log.info(...args),
  warn: (...args: unknown[]) => log.warn(...args),
  error: (...args: unknown[]) => log.error(...args),
  debug: (...args: unknown[]) => log.debug(...args),
}
