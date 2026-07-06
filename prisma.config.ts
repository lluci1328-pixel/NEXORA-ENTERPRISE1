import { defineConfig } from "prisma/config";

// Prisma 7 configuration. The connection URL lives here (for CLI commands)
// and in src/lib/db.ts (for the runtime driver adapter).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
