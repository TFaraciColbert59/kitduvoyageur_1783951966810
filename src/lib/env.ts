/**
 * Environment variable validation — runs at build time and server startup.
 * Warns if required variables are missing.
 */

const REQUIRED_SERVER = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];

const OPTIONAL_WITH_WARNINGS = [
  'GEMINI_API_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_GA_MEASUREMENT_ID',
  'STRIPE_SECRET_KEY',
];

export function validateEnv() {
  const missing: string[] = [];

  for (const key of REQUIRED_SERVER) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    console.warn(
      `[env] Missing required environment variables: ${missing.join(', ')}\n` +
        'Copy .env.example to .env and fill in the values.'
    );
  }

  for (const key of OPTIONAL_WITH_WARNINGS) {
    if (!process.env[key] || process.env[key]?.includes('your-')) {
      console.warn(`[env] Optional variable ${key} is not configured.`);
    }
  }

  return { missing, isValid: missing.length === 0 };
}

/**
 * Type-safe environment variable access.
 * Throws at runtime if a required variable is missing.
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
