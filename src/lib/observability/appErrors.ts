import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { redactString } from './logger';

/**
 * Erreurs serveur (plan 2.9), à 0 € : une ligne par erreur dans `app_errors`,
 * écrite avec la clé de service, lue par le rapport quotidien. Rien de la
 * personne : le lieu du code (`scope`), un code, un message rédigé (e-mails,
 * jetons, identifiants, adresses IP retirés) et tronqué à 300 caractères.
 */
export interface AppErrorRow {
  scope: string;
  code: string | null;
  message: string;
}

// Les bornes sont des « pas de chiffre hexadécimal / de chiffre autour » et non
// `\b` : `trip_<uuid>` ou `ip_203.0.113.7` n'ont pas de frontière de mot.
const UUID = /(?<![0-9a-f])[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![0-9a-f])/gi;
const IPV4 = /(?<!\d)\d{1,3}(?:\.\d{1,3}){3}(?!\d)/g;
// Suite de chiffres hexadécimaux et de « : » ; jugée ensuite par `isIpv6Run`.
const COLON_RUN = /(?<![0-9a-f:])[0-9a-f:]{2,}(?![0-9a-f:])/gi;
// Caractères de contrôle (sauf tabulation et retours à la ligne) : Postgres refuse \u0000.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
// Moitié de paire de substitution : sérialisée en JSON, elle fait refuser la ligne.
const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g;

/** Plus longue attente de l'enregistrement : la réponse d'erreur ne l'attend pas davantage. */
const INSERT_TIMEOUT_MS = 2000;

/**
 * Une adresse IPv6 a 7 « : » en forme complète, ou un « :: » en forme abrégée.
 * Une heure (`12:30`, `12:30:45`) n'a ni l'un ni l'autre et reste lisible.
 */
function isIpv6Run(run: string): boolean {
  if (!/[0-9a-f]/i.test(run)) return false;
  const colons = run.split(':').length - 1;
  return run.includes('::') ? colons >= 2 : colons >= 7;
}

/** Sans caractère de contrôle ni demi-paire de substitution. */
function strip(text: string): string {
  return text.replace(CONTROL, '').replace(LONE_SURROGATE, '');
}

/** Tronque par points de code : jamais au milieu d'une paire de substitution. */
function clip(text: string, max: number): string {
  return Array.from(text).slice(0, max).join('');
}

export function appErrorRow(scope: string, err: unknown): AppErrorRow {
  const e = (err && typeof err === 'object' ? err : null) as { name?: unknown; code?: unknown; message?: unknown } | null;
  const code =
    typeof e?.code === 'string' || typeof e?.code === 'number'
      ? clip(strip(String(e.code)), 40)
      : typeof e?.name === 'string'
        ? clip(strip(e.name), 40)
        : null;
  const raw =
    err instanceof Error ? err.message : typeof err === 'string' ? err : typeof e?.message === 'string' ? e.message : 'erreur';
  // Nettoyer AVANT de rédiger : un caractère de contrôle glissé dans une adresse ne la soustrait pas.
  const redacted = redactString(strip(raw))
    .replace(UUID, '[id]')
    .replace(IPV4, '[ip]')
    .replace(COLON_RUN, (run) => (isIpv6Run(run) ? '[ip]' : run));
  const message = clip(redacted, 300) || 'erreur';
  return { scope: clip(strip(scope), 60), code, message };
}

/**
 * Journal Vercel (inchangé) + ligne `app_errors`. Ne lève jamais et n'attend
 * l'enregistrement que 2 s : une base lente ne retarde pas la réponse d'erreur.
 */
export async function reportServerError(scope: string, err: unknown): Promise<void> {
  console.error(`[${scope}]`, err);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const client = getServiceSupabase();
    if (!client) return;
    const insert = Promise.resolve(client.from('app_errors').insert(appErrorRow(scope, err)));
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), INSERT_TIMEOUT_MS);
    });
    const outcome = await Promise.race([insert, timeout]);
    if (outcome === 'timeout') {
      console.warn('[app_errors] délai dépassé');
      return;
    }
    if (outcome.error) console.warn('[app_errors]', outcome.error.code);
  } catch {
    // Journal seulement : une erreur d'enregistrement ne s'ajoute jamais à l'erreur d'origine.
  } finally {
    if (timer) clearTimeout(timer);
  }
}
