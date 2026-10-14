import { pluginsForSlot } from "@arcane-table/plugin-sdk";
import { healthStatusSchema } from "@arcane-table/protocol";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { sessionQuery } from "../../application/session.js";
import { apiRequest } from "../../infrastructure/http.js";
import { corePlugins } from "../../plugins/registry.js";
import { ErrorState, LoadingState } from "../../presentation/states.js";
import { Badge } from "../../presentation/ui.js";

export const DashboardPage = (): ReactNode => {
  const session = useQuery(sessionQuery);
  const health = useQuery({
    queryFn: async () => {
      const result = await apiRequest("/health", healthStatusSchema);
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    queryKey: ["health"],
  });
  const user = session.data?.user;
  if (user === undefined || user === null) return <LoadingState label="Loading dashboard" />;
  const widgets = pluginsForSlot(corePlugins, "dashboard.widgets");
  return (
    <article className="panel">
      <p className="eyebrow">Dashboard</p>
      <h1>Welcome, {user.username}</h1>
      <p>
        {user.roles.map((role) => (
          <Badge key={role}>{role}</Badge>
        ))}
      </p>
      {health.isPending ? <LoadingState label="Checking API" /> : null}
      {health.isError ? (
        <ErrorState message="API health is unavailable." onRetry={() => void health.refetch()} />
      ) : null}
      {health.data === undefined ? null : (
        <p>
          API {health.data.status}, version {health.data.version}
        </p>
      )}
      <section>
        <h2>Quick actions</h2>
        <div className="actions">
          <a className="button" href="/worlds">
            Worlds
          </a>
          {user.roles.includes("player") ? null : (
            <a className="button" href="/tools/converter">
              Converter
            </a>
          )}
        </div>
      </section>
      <p>
        Widget slot:{" "}
        {widgets.length === 0
          ? "open for future plugins"
          : widgets.map((plugin) => plugin.id).join(", ")}
      </p>
    </article>
  );
};
