type LogMeta = Record<string, unknown>;

function log(level: "info" | "warn" | "error", context: string, message: string, meta?: LogMeta) {
  const entry = { level, context, message, ...meta };
  const output = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  output(JSON.stringify(entry));
}

export function logInfo(context: string, message: string, meta?: LogMeta): void {
  log("info", context, message, meta);
}

export function logWarn(context: string, message: string, meta?: LogMeta): void {
  log("warn", context, message, meta);
}

export function logError(context: string, message: string, error: unknown, meta?: LogMeta): void {
  const errorMeta = error instanceof Error ? { errorMessage: error.message } : { error };
  log("error", context, message, { ...meta, ...errorMeta });
}
