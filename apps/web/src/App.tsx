import { type HealthStatus, healthStatusSchema } from "@arcane-table/protocol";
import { useEffect, useState } from "react";

type HealthState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ data: HealthStatus; kind: "ready" }>
  | Readonly<{ kind: "error"; message: string }>;

const fetchHealth = async (signal: AbortSignal): Promise<HealthStatus> => {
  const response = await fetch("/api/health", { signal });
  if (!response.ok) {
    throw new Error(`Health endpoint returned ${response.status}`);
  }
  return healthStatusSchema.parse(await response.json());
};

export const App = () => {
  const [health, setHealth] = useState<HealthState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void fetchHealth(controller.signal)
      .then((data) => setHealth({ data, kind: "ready" }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setHealth({
            kind: "error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">Runtime scaffold</p>
        <h1>Arcane Table</h1>
        {health.kind === "loading" && <p className="status pending">Checking API…</p>}
        {health.kind === "ready" && (
          <p className="status healthy">
            <span aria-hidden="true">●</span> {health.data.service} is {health.data.status}
          </p>
        )}
        {health.kind === "error" && (
          <p className="status unhealthy" role="alert">
            API unavailable: {health.message}
          </p>
        )}
      </section>
    </main>
  );
};
