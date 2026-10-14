import { z } from "zod";

export const healthStatusSchema = z.object({
  service: z.string().min(1),
  status: z.enum(["ok", "degraded"]),
  timestamp: z.iso.datetime(),
  version: z.string().min(1),
});

const commandMetadataSchema = z.object({
  commandId: z.uuid(),
  issuedAt: z.iso.datetime(),
});

const pointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const canvasCommandSchema = z.discriminatedUnion("type", [
  commandMetadataSchema.extend({
    canvasId: z.uuid(),
    name: z.string().trim().min(1).max(120),
    type: z.literal("canvas.create"),
  }),
  commandMetadataSchema.extend({
    canvasId: z.uuid(),
    position: pointSchema,
    tokenId: z.uuid(),
    type: z.literal("token.move"),
  }),
]);

const eventMetadataSchema = z.object({
  eventId: z.uuid(),
  occurredAt: z.iso.datetime(),
  sequence: z.number().int().nonnegative(),
});

export const canvasEventSchema = z.discriminatedUnion("type", [
  eventMetadataSchema.extend({
    canvasId: z.uuid(),
    name: z.string().min(1),
    type: z.literal("canvas.created"),
  }),
  eventMetadataSchema.extend({
    canvasId: z.uuid(),
    position: pointSchema,
    tokenId: z.uuid(),
    type: z.literal("token.moved"),
  }),
]);

export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type CanvasCommand = z.infer<typeof canvasCommandSchema>;
export type CanvasEvent = z.infer<typeof canvasEventSchema>;

export {
  adminHealthSchema,
  apiErrorSchema,
  auditEventSchema,
  auditPageSchema,
  contractVersionSchema,
  conversionDiagnosticSchema,
  conversionRejectedSchema,
  conversionResponseSchema,
  createUserRequestSchema,
  loginRequestSchema,
  publicUserSchema,
  roleSchema,
  sessionResponseSchema,
  updateUserRequestSchema,
  userPageSchema,
} from "./ui.js";
export type {
  AdminHealth,
  ApiError,
  AuditEvent,
  AuditPage,
  ConversionDiagnostic,
  ConversionRejected,
  ConversionResponse,
  CreateUserRequest,
  LoginRequest,
  PublicUser,
  Role,
  SessionResponse,
  UpdateUserRequest,
  UserPage,
} from "./ui.js";
