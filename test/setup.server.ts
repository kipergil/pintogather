/**
 * Server-suite setup. Every external credential the app reads at import
 * time gets a deterministic dummy value, so a test run never depends on a
 * developer's local .env and never reaches a real Stripe/Clerk/Directus.
 * Anything that would actually call out is mocked per-test instead.
 */
process.env.NODE_ENV = "test";
process.env.DIRECTUS_URL ??= "http://directus.test";
process.env.DIRECTUS_TOKEN ??= "test-directus-token";
process.env.CLERK_SECRET_KEY ??= "sk_test_dummy";
process.env.CLERK_PUBLISHABLE_KEY ??= "pk_test_dummy";
process.env.VITE_CLERK_PUBLISHABLE_KEY ??= "pk_test_dummy";
process.env.STRIPE_SECRET_KEY ??= "sk_test_dummy";
process.env.SESSION_SECRET ??= "test-session-secret";
process.env.ANTHROPIC_API_KEY ??= "sk-ant-test-dummy";
