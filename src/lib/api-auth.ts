import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "./db";

/**
 * API-key authentication for machine callers (n8n, external systems).
 * Keys are sent as `Authorization: Bearer nxk_...` and stored hashed —
 * a database leak never exposes usable credentials.
 */

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): { raw: string; prefix: string; hashed: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const raw =
    "nxk_" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  return { raw, prefix: raw.slice(0, 12), hashed: hashApiKey(raw) };
}

export class ApiAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** Validates the bearer key and returns the business it is scoped to. */
export async function requireApiKey(req: NextRequest, scope?: string) {
  const header = req.headers.get("authorization") ?? "";
  const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!raw) throw new ApiAuthError("Missing Authorization bearer token");

  const apiKey = await prisma.apiKey.findUnique({
    where: { hashedKey: hashApiKey(raw) },
    include: { business: true },
  });
  if (!apiKey || apiKey.revokedAt) throw new ApiAuthError("Invalid or revoked API key");

  if (scope) {
    const scopes: string[] = JSON.parse(apiKey.scopesJson || "[]");
    if (!scopes.includes(scope) && !scopes.includes("*")) {
      throw new ApiAuthError(`API key is missing required scope: ${scope}`, 403);
    }
  }

  // Fire-and-forget usage timestamp; never block the request on it.
  prisma.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { apiKey, business: apiKey.business };
}
