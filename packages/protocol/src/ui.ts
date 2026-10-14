import { z } from "zod";

export const contractVersionSchema = z.literal("1");

export const roleSchema = z.enum(["admin", "gm", "player"]);
export type Role = z.infer<typeof roleSchema>;

export const apiErrorSchema = z.object({
  error: z.string().min(1),
  message: z.string().min(1),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const publicUserSchema = z.object({
  disabled: z.boolean(),
  id: z.uuid(),
  roles: z.array(roleSchema),
  username: z.string().min(1),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const sessionResponseSchema = z.object({
  authenticated: z.boolean(),
  contractVersion: contractVersionSchema,
  csrfToken: z.string().nullable(),
  user: publicUserSchema.nullable(),
});
export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export const loginRequestSchema = z.object({
  password: z.string().min(1).max(200),
  username: z.string().trim().min(3).max(32),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9._-]{3,32}$/);
const passwordSchema = z.string().min(12).max(200);

export const createUserRequestSchema = z.object({
  password: passwordSchema,
  roles: z.array(roleSchema).min(1),
  username: usernameSchema,
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const updateUserRequestSchema = z
  .object({
    disabled: z.boolean().optional(),
    password: passwordSchema.optional(),
    roles: z.array(roleSchema).min(1).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

export const userPageSchema = z.object({
  contractVersion: contractVersionSchema,
  items: z.array(publicUserSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});
export type UserPage = z.infer<typeof userPageSchema>;

export const auditEventSchema = z.object({
  action: z.string(),
  actorUsername: z.string().nullable(),
  createdAt: z.iso.datetime(),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  id: z.uuid(),
  targetId: z.string(),
  targetType: z.string(),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const auditPageSchema = z.object({
  contractVersion: contractVersionSchema,
  items: z.array(auditEventSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});
export type AuditPage = z.infer<typeof auditPageSchema>;

export const adminHealthSchema = z.object({
  contractVersion: contractVersionSchema,
  database: z.enum(["ok", "degraded"]),
  pluginCount: z.number().int().nonnegative(),
  service: z.literal("api"),
  sessionCount: z.number().int().nonnegative(),
  userCount: z.number().int().nonnegative(),
  version: z.string().min(1),
});
export type AdminHealth = z.infer<typeof adminHealthSchema>;

export const conversionDiagnosticSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.string().optional(),
  severity: z.enum(["warning", "error"]),
});

export const conversionResponseSchema = z.object({
  actor: z.record(z.string(), z.unknown()),
  report: z.object({
    diagnostics: z.array(conversionDiagnosticSchema),
    stats: z.object({
      attributes: z.number().int().nonnegative(),
      items: z.number().int().nonnegative(),
      repeatingRows: z.number().int().nonnegative(),
    }),
    target: z.literal("Foundry VTT v14 / dnd5e 6.0.6 / PC 2014"),
  }),
});
export type ConversionResponse = z.infer<typeof conversionResponseSchema>;

export const conversionRejectedSchema = apiErrorSchema.extend({
  diagnostics: z.array(conversionDiagnosticSchema),
  error: z.literal("CONVERSION_REJECTED"),
});
export type ConversionDiagnostic = z.infer<typeof conversionDiagnosticSchema>;
export type ConversionRejected = z.infer<typeof conversionRejectedSchema>;
