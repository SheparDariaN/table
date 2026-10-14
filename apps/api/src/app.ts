import { convert, validate } from "@arcane-table/converter-core";
import { healthStatusSchema } from "@arcane-table/protocol";
import Fastify, { type FastifyInstance } from "fastify";

export type AppOptions = Readonly<{
  readiness?: () => Promise<boolean>;
}>;

const status = (serviceStatus: "ok" | "degraded") =>
  healthStatusSchema.parse({
    service: "api",
    status: serviceStatus,
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  });

export const createApp = ({ readiness = async () => true }: AppOptions = {}): FastifyInstance => {
  const app = Fastify({
    bodyLimit: 5 * 1024 * 1024,
    logger: true,
  });

  app.get("/health", async () => status("ok"));
  app.get("/ready", async (_request, reply) => {
    const ready = await readiness();
    return reply.code(ready ? 200 : 503).send(status(ready ? "ok" : "degraded"));
  });
  app.post<{ Querystring: { readonly strict?: string } }>(
    "/v1/conversions/roll20-foundry",
    async (request, reply) => {
      const mode = request.query.strict === "true" ? "strict" : "lenient";
      const validation = validate(request.body, { mode });
      if (!validation.valid) {
        return reply.code(422).send({
          error: "CONVERSION_REJECTED",
          diagnostics: validation.diagnostics,
        });
      }
      return reply.code(200).send(convert(request.body, { mode }));
    },
  );

  return app;
};
