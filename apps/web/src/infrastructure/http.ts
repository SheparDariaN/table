import { apiErrorSchema, conversionRejectedSchema } from "@arcane-table/protocol";
import type { ZodType } from "zod";

export type ApiFailure = Readonly<{
  diagnostics?: readonly {
    code: string;
    message: string;
    path?: string | undefined;
    severity: "error" | "warning";
  }[];
  error: string;
  message: string;
  ok: false;
  status: number;
}>;

export type ApiResult<T> = ApiFailure | Readonly<{ data: T; ok: true }>;

let csrfToken: string | null = null;

export const setCsrfToken = (token: string | null): void => {
  csrfToken = token;
};

export const apiRequest = async <T>(
  path: string,
  schema: ZodType<T>,
  init: RequestInit = {},
): Promise<ApiResult<T>> => {
  const headers = new Headers(init.headers);
  const method = init.method ?? "GET";
  if (method !== "GET" && method !== "HEAD" && csrfToken !== null)
    headers.set("x-csrf-token", csrfToken);
  if (init.body !== undefined && !headers.has("content-type"))
    headers.set("content-type", "application/json");
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, credentials: "include", headers });
  } catch (error: unknown) {
    return {
      error: "NETWORK",
      message: error instanceof Error ? error.message : "Network unavailable.",
      ok: false,
      status: 0,
    };
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const rejected = conversionRejectedSchema.safeParse(payload);
    if (rejected.success) {
      return {
        diagnostics: rejected.data.diagnostics,
        error: rejected.data.error,
        message: rejected.data.message,
        ok: false,
        status: response.status,
      };
    }
    const parsed = apiErrorSchema.safeParse(payload);
    return parsed.success
      ? {
          error: parsed.data.error,
          message: parsed.data.message,
          ok: false,
          status: response.status,
        }
      : { error: "REQUEST_FAILED", message: "Request failed.", ok: false, status: response.status };
  }
  const parsed = schema.safeParse(payload);
  return parsed.success
    ? { data: parsed.data, ok: true }
    : {
        error: "INVALID_RESPONSE",
        message: "The server response did not match the contract.",
        ok: false,
        status: response.status,
      };
};
