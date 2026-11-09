import { createHash, randomBytes } from "node:crypto";
export function nuovoToken() { return randomBytes(32).toString("base64url"); }
export function tokenValido(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value); }
export function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
