export const roles = ["admin", "gm", "player"] as const;
export type Role = (typeof roles)[number];
