import { hash, verify } from "@node-rs/argon2";
import type { PasswordHasher } from "./auth-service.js";

const options = { memoryCost: 19456, parallelism: 1, timeCost: 2 } as const;

export const argon2Hasher: PasswordHasher = {
  hash: (password) => hash(password, options),
  verify: (passwordHash, password) => verify(passwordHash, password),
};
