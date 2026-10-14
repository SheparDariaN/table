import { boolean, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const canvases = pgTable("canvases", {
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  snapshot: jsonb("snapshot").notNull().default({}),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  disabled: boolean("disabled").notNull().default(false),
  id: uuid("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  username: text("username").notNull().unique(),
});

export const userRoles = pgTable(
  "user_roles",
  {
    role: text("role").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] })],
);

export const sessions = pgTable("sessions", {
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  csrfToken: text("csrf_token").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
  id: uuid("id").primaryKey(),
  revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
  tokenHash: text("token_hash").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const auditEvents = pgTable("audit_events", {
  action: text("action").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).defaultNow().notNull(),
  details: jsonb("details").notNull().default({}),
  id: uuid("id").primaryKey(),
  targetId: text("target_id").notNull(),
  targetType: text("target_type").notNull(),
});
