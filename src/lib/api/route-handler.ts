import type { ZodType } from "zod";

import { logError, logInfo } from "@/lib/observability/logger";

export interface ApiRequestContext {
  requestId: string;
  route: string;
  method: string;
  startedAt: number;
}

interface AppErrorOptions {
  statusCode: number;
  code: string;
  details?: unknown;
  expose?: boolean;
}

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;
  expose: boolean;

  constructor(message: string, options: AppErrorOptions) {
    super(message);
    this.name = "AppError";
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.details = options.details;
    this.expose = options.expose ?? true;
  }
}

function normalizeError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError("Internal server error.", {
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
    expose: false,
  });
}

export function createRequestContext(
  request: Request,
  route: string,
): ApiRequestContext {
  return {
    requestId: request.headers.get("x-request-id") ?? crypto.randomUUID(),
    route,
    method: request.method,
    startedAt: Date.now(),
  };
}

function buildHeaders(
  context: ApiRequestContext,
  headers?: HeadersInit,
) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Request-ID", context.requestId);
  return responseHeaders;
}

export function jsonSuccess<T>(
  context: ApiRequestContext,
  data: T,
  init?: ResponseInit,
) {
  return Response.json(
    {
      ok: true,
      requestId: context.requestId,
      data,
      meta: {
        durationMs: Date.now() - context.startedAt,
      },
    },
    {
      ...init,
      headers: buildHeaders(context, init?.headers),
    },
  );
}

export function jsonError(context: ApiRequestContext, error: unknown) {
  const normalized = normalizeError(error);

  logError("api.error", normalized, {
    requestId: context.requestId,
    route: context.route,
    method: context.method,
    statusCode: normalized.statusCode,
    code: normalized.code,
  });

  return Response.json(
    {
      ok: false,
      requestId: context.requestId,
      error: {
        code: normalized.code,
        message: normalized.expose
          ? normalized.message
          : "Internal server error.",
        details: normalized.expose ? normalized.details : undefined,
      },
      meta: {
        durationMs: Date.now() - context.startedAt,
      },
    },
    {
      status: normalized.statusCode,
      headers: buildHeaders(context),
    },
  );
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    throw new AppError("Malformed JSON body.", {
      statusCode: 400,
      code: "INVALID_JSON",
      details: error instanceof Error ? error.message : undefined,
    });
  }

  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Invalid request payload.", {
      statusCode: 400,
      code: "INVALID_PAYLOAD",
      details: parsed.error.flatten(),
    });
  }

  return parsed.data;
}

export function createRouteHandler(
  route: string,
  handler: (request: Request, context: ApiRequestContext) => Promise<Response>,
) {
  return async (request: Request) => {
    const context = createRequestContext(request, route);

    logInfo("api.request", {
      requestId: context.requestId,
      route,
      method: request.method,
    });

    try {
      const response = await handler(request, context);
      response.headers.set("X-Request-ID", context.requestId);
      response.headers.set(
        "Cache-Control",
        response.headers.get("Cache-Control") ?? "no-store",
      );
      return response;
    } catch (error) {
      return jsonError(context, error);
    }
  };
}
