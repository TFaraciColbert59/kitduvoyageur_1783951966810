import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Environnement des tests E2E.
 *
 * Règles :
 * - aucune valeur n'est journalisée (clé seulement, jamais le secret) ;
 * - les tests ne visent jamais la production (garde-fou : lancement refusé) ;
 * - les identifiants viennent de variables d'environnement ou d'un fichier local
 *   ignoré par git (`.env.local`, `.env.test.local`), jamais du dépôt.
 */

let loaded = false;

function parseEnvFile(file: string): void {
  for (const rawLine of readFileSync(file, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match as unknown as [string, string, string];
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/** Charge `.env.local` puis `.env.test.local` (sans écraser l'environnement réel). */
export function loadEnvFiles(): void {
  if (loaded) return;
  loaded = true;
  for (const name of ['.env.local', '.env.test.local']) {
    const file = path.resolve(process.cwd(), name);
    if (existsSync(file)) parseEnvFile(file);
  }
}

export const PRODUCTION_HOSTS = ['lekitduvoyageur.fr', 'www.lekitduvoyageur.fr', 'crm.lekitduvoyageur.fr'];

/** Interdit de lancer la suite contre la production pendant le chantier (garde-fous § 1). */
export function assertNotProduction(url: string): void {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`CRM_BASE_URL invalide : ${url}`);
  }
  if (PRODUCTION_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    throw new Error(
      `Refus : les tests CRM ne visent pas la production (${host}). Utiliser localhost ou un aperçu Vercel de la branche.`
    );
  }
}

export function baseURL(): string {
  loadEnvFiles();
  const url = process.env.CRM_BASE_URL ?? 'http://localhost:4100';
  assertNotProduction(url);
  return url;
}

export type TestCredentials = { email: string; password: string; totpSecret: string };

/** Identifiants du compte de test `is_demo` (07_VERIFICATION § 2). */
export function credentials(): TestCredentials | null {
  loadEnvFiles();
  const email = process.env.CRM_TEST_EMAIL;
  const password = process.env.CRM_TEST_PASSWORD;
  const totpSecret = process.env.CRM_TEST_TOTP_SECRET;
  if (!email || !password || !totpSecret) return null;
  return { email, password, totpSecret };
}

export const NO_CREDENTIALS_MOTIF =
  'Identifiants de test absents : définir CRM_TEST_EMAIL, CRM_TEST_PASSWORD et CRM_TEST_TOTP_SECRET (compte is_demo, jamais un compte réel) — voir crm/tests/README.md.';

/** Le middleware a besoin de Supabase : sans URL publique, l'application ne démarre pas. */
export function hasSupabaseEnv(): boolean {
  loadEnvFiles();
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export const NO_SUPABASE_MOTIF =
  'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY absents : le middleware ne peut pas démarrer — voir crm/tests/README.md.';
