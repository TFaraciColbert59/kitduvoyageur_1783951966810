// Chargement de l'environnement du seed. La clé service_role n'est jamais
// journalisée ni exportée vers un rapport : seuls des booléens sont exposés.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../../..');

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const fileEnv = {
  ...parseEnvFile(path.join(ROOT, '.env')),
  ...parseEnvFile(path.join(ROOT, '.env.local')),
};

const merged = { ...fileEnv, ...process.env };

function required(name) {
  const value = merged[name];
  if (!value) {
    throw new Error(
      `Variable ${name} absente. Ajoute-la dans ${path.join(ROOT, '.env.local')} (jamais dans le chat).`
    );
  }
  return value;
}

export const config = {
  root: ROOT,
  url: required('NEXT_PUBLIC_SUPABASE_URL'),
  anonKey: merged.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  serviceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  anonKeyPresent: Boolean(merged.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  serviceKeyPresent: Boolean(merged.SUPABASE_SERVICE_ROLE_KEY),
  demoEmail: merged.DEMO_LOGIN_EMAIL || merged.AUDIT_EMAIL || 'demo@lkdv.app',
  demoPassword: merged.DEMO_LOGIN_PASSWORD || merged.AUDIT_PASSWORD || 'LkdvDemo!2026',
  seedBatch: merged.SEED_BATCH || 'world-v1',
  seedEpoch: merged.SEED_EPOCH || null,
  skipMedia: merged.SEED_SKIP_MEDIA === '1',
  dryRun: merged.SEED_DRY_RUN === '1',
  seedDir: path.join(ROOT, 'scripts/seed/world'),
  cacheDir: path.join(ROOT, 'scripts/seed/world/.cache'),
  manifestDir: path.join(ROOT, 'scripts/seed/world/.manifest'),
};

export function describeEnv() {
  return {
    url: config.url.replace(/^https?:\/\//, '').split('.')[0],
    serviceKey: config.serviceKeyPresent ? 'présente' : 'absente',
    anonKey: config.anonKeyPresent ? 'présente' : 'absente',
    demoEmail: config.demoEmail,
    batch: config.seedBatch,
    skipMedia: config.skipMedia,
  };
}
