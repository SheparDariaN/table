import { sessionResponseSchema, type SessionResponse } from "@arcane-table/protocol";
import { queryOptions } from "@tanstack/react-query";
import { apiRequest, setCsrfToken } from "../infrastructure/http.js";

export const sessionQuery = queryOptions({
  queryFn: async (): Promise<SessionResponse> => {
    const result = await apiRequest("/v1/auth/session", sessionResponseSchema);
    if (!result.ok) throw new Error(result.message);
    setCsrfToken(result.data.csrfToken);
    return result.data;
  },
  queryKey: ["session"],
});
