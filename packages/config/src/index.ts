import { z } from "zod";

const nodeEnvironmentSchema = z.enum(["development", "test", "production"]);
const portSchema = z.coerce.number().int().min(1).max(65_535);

export const apiEnvSchema = z.object({
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).default("change-me-in-production"),
  BOOTSTRAP_ADMIN_USERNAME: z
    .string()
    .regex(/^[a-z0-9._-]{3,32}$/)
    .default("admin"),
  DATABASE_URL: z.url(),
  HOST: z.string().min(1).default("0.0.0.0"),
  NODE_ENV: nodeEnvironmentSchema.default("development"),
  PORT: portSchema.default(3000),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
});

export const workerEnvSchema = z.object({
  DATABASE_URL: z.url(),
  NODE_ENV: nodeEnvironmentSchema.default("development"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type Environment = Readonly<Record<string, string | undefined>>;

export const parseApiEnv = (environment: Environment): ApiEnv => apiEnvSchema.parse(environment);
export const parseWorkerEnv = (environment: Environment): WorkerEnv =>
  workerEnvSchema.parse(environment);
