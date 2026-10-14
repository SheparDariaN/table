export type ConnectionState = "connecting" | "forbidden" | "live" | "offline" | "reconnecting";

export const connectionFromQuery = (
  status: "error" | "pending" | "success",
  authenticated: boolean,
  online: boolean,
): ConnectionState => {
  if (!online) return "offline";
  if (status === "pending") return "connecting";
  if (status === "error") return "reconnecting";
  return authenticated ? "live" : "forbidden";
};
