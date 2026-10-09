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

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;

export function appErrorRow(scope: string, err: unknown): AppErrorRow {
  const e = (err && typeof err === 'object' ? err : null) as { name?: unknown; code?: unknown; message?: unknown } | null;
  const code =
    typeof e?.code === 'string' || typeof e?.code === 'number'
      ? String(e.code).slice(0, 40)
      : typeof e?.name === 'string'
        ? e.name.slice(0, 40)
        : null;
  const raw =
    err instanceof Error ? err.message : typeof err === 'string' ? err : typeof e?.message === 'string' ? e.message : 'erreur';
  const message = redactString(raw).replace(UUID, '[id]').replace(IPV4, '[ip]').slice(0, 300) || 'erreur';
  return { scope: scope.slice(0, 60), code, message };
}

/** Journal Vercel (inchangé) + ligne `app_errors`. Ne lève jamais. */
export async function reportServerError(scope: string, err: unknown): Promise<void> {
  console.error(`[${scope}]`, err);
  try {
    const client = getServiceSupabase();
    if (!client) return;
    const { error } = await client.from('app_errors').insert(appErrorRow(scope, err));
    if (error) console.warn('[app_errors]', error.code);
  } catch {
    // Journal seulement : une erreur d'enregistrement ne s'ajoute jamais à l'erreur d'origine.
  }
}
