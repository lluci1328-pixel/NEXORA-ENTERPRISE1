import { defineConfig } from "@prisma/internals";
import { config } from "dotenv";

config({ path: "../.env" });

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://localhost/nexora",
  },
});
