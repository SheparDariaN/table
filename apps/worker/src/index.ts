import { parseWorkerEnv } from "@arcane-table/config";
import type { PgBoss } from "pg-boss";

export type WorkerDefinition = Readonly<{
  connectionString: string;
  register: (boss: PgBoss) => Promise<void>;
}>;

export const createWorkerDefinition = (environment: NodeJS.ProcessEnv): WorkerDefinition => {
  const env = parseWorkerEnv(environment);
  return {
    connectionString: env.DATABASE_URL,
    register: async (_boss) => {
      // Jobs are intentionally registered by future feature packages.
    },
  };
};

const waitForShutdown = (): Promise<void> =>
  new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });

if (process.env.NODE_ENV !== "test") {
  createWorkerDefinition(process.env);
  await waitForShutdown();
}
