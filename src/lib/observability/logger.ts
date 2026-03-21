type LogLevel = "info" | "warn" | "error";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function writeLog(level: LogLevel, event: string, metadata: Record<string, unknown>) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...metadata,
  });

  if (level === "error") {
    console.error(payload);
    return;
  }

  if (level === "warn") {
    console.warn(payload);
    return;
  }

  console.info(payload);
}

export function logInfo(event: string, metadata: Record<string, unknown> = {}) {
  writeLog("info", event, metadata);
}

export function logWarn(event: string, metadata: Record<string, unknown> = {}) {
  writeLog("warn", event, metadata);
}

export function logError(
  event: string,
  error: unknown,
  metadata: Record<string, unknown> = {},
) {
  writeLog("error", event, {
    ...metadata,
    error: serializeError(error),
  });
}
