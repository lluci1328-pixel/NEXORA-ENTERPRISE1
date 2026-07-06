import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Prisma client singleton — survives Next.js hot reloads in development.
// Prisma 7 uses driver adapters; swap this for @prisma/adapter-pg on
// PostgreSQL in production without touching any query code.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
