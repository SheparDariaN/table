import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyReply } from "fastify";

export const sessionCookie = "arcane_session";

export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const createSecret = (): string => randomBytes(32).toString("base64url");

export const secretsMatch = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const sendError = (
  reply: FastifyReply,
  status: number,
  error: string,
  message: string,
): FastifyReply => reply.code(status).send({ error, message });

export type RateLimiter = Readonly<{
  allow: (key: string) => boolean;
}>;

export const createRateLimiter = (
  limit: number,
  windowMs: number,
  now: () => number,
): RateLimiter => {
  const attempts = new Map<string, readonly number[]>();
  return {
    allow: (key) => {
      const current = now();
      const recent = (attempts.get(key) ?? []).filter((time) => current - time < windowMs);
      if (recent.length >= limit) {
        attempts.set(key, recent);
        return false;
      }
      attempts.set(key, [...recent, current]);
      return true;
    },
  };
};
