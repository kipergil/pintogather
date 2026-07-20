import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DIRECTUS_URL: z.string().url().default("http://localhost:8055"),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(1),
});

export const env = envSchema.parse({
  DIRECTUS_URL: process.env.DIRECTUS_URL ?? process.env.PUBLIC_URL,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
});
