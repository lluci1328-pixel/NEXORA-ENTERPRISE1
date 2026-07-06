import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { Role } from "./constants";
import { ROLE_RANK } from "./constants";

const SESSION_COOKIE = "nexora_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  isPlatformOwner: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      isPlatformOwner: Boolean(payload.isPlatformOwner),
    };
  } catch {
    return null;
  }
}

/** Current user with all memberships, or null when unauthenticated. */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    include: { memberships: { include: { business: true } } },
  });
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Tenancy gate. Resolves the user's role for the given business and throws
 * unless authenticated + member (platform owners implicitly have OWNER role
 * everywhere). Every business-scoped page and API route goes through this.
 */
export async function requireBusinessAccess(businessSlug: string, minRole: Role = "SUPPORT") {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Not authenticated", 401);

  const business = await prisma.business.findUnique({ where: { slug: businessSlug } });
  if (!business) throw new AuthError("Business not found", 404);

  let role: Role | null = null;
  if (user.isPlatformOwner) {
    role = "OWNER";
  } else {
    const membership = user.memberships.find((m) => m.businessId === business.id);
    role = (membership?.role as Role) ?? null;
  }

  if (!role) throw new AuthError("You do not have access to this business", 403);
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw new AuthError("Insufficient permissions for this action", 403);
  }

  return { user, business, role };
}

/** Businesses visible to the current user (all of them for platform owners). */
export async function getAccessibleBusinesses() {
  const user = await getCurrentUser();
  if (!user) return [];
  if (user.isPlatformOwner) {
    return prisma.business.findMany({ orderBy: { name: "asc" } });
  }
  return prisma.business.findMany({
    where: { memberships: { some: { userId: user.id } } },
    orderBy: { name: "asc" },
  });
}
