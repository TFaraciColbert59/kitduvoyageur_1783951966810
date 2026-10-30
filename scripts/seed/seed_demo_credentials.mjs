/**
 * Read operator-provided credentials without logging them.
 * @param {{ SEED_DEMO_EMAIL?: string, SEED_DEMO_PASSWORD?: string }} [env]
 */
export function readSeedDemoCredentials(env = process.env) {
  const email = env.SEED_DEMO_EMAIL?.trim();
  const password = env.SEED_DEMO_PASSWORD;
  if (!email || !password?.trim()) {
    throw new Error('SEED_DEMO_EMAIL et SEED_DEMO_PASSWORD sont requis');
  }
  return { email, password };
}
