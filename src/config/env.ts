import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string(),

  JWT_SECRET: z.string(),
  REFRESH_JWT_SECRECT: z.string(),

  COOKIE_SECRET: z.string(),

  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error(
    "❌ Invalid or missing environment variables:",
    _env.error.format(),
  );
  process.exit(1);
}

export const env = _env.data;
