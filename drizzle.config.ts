import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Use Supabase's *direct* (session) connection string for migrations.
    url: process.env.DATABASE_URL!,
  },
  strict: true,
});
