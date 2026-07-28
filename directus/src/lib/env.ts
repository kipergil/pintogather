import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DIRECTUS_URL: z.string().url().default("http://localhost:8055"),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string().min(1),
  /** Display name — drives the "<APP_NAME> Service" policy/role name and other bootstrap-tooling copy. Rename-and-reapply-safe: see permissions/apply.ts's findRoleByName lookup. */
  APP_NAME: z.string().min(1).default("PinGather"),
  /** Public origin the app is actually served from — used to build links in invitation/notification emails (flows/definitions.ts). Update if the production domain changes. */
  APP_BASE_URL: z.string().url().default("https://pingather.vercel.app"),
  /** Email for the dedicated, non-human directus_users row the Express server's static DIRECTUS_SERVICE_TOKEN lives on. */
  SERVICE_ACCOUNT_EMAIL: z.string().email().default("service@pingather.dev"),
});

export const env = envSchema.parse({
  DIRECTUS_URL: process.env.DIRECTUS_URL ?? process.env.PUBLIC_URL,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  APP_NAME: process.env.APP_NAME || undefined,
  APP_BASE_URL: process.env.APP_BASE_URL || undefined,
  SERVICE_ACCOUNT_EMAIL: process.env.SERVICE_ACCOUNT_EMAIL || undefined,
});
