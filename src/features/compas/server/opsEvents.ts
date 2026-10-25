import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';

/**
 * Journal des préparations (rapport quotidien, `ops_daily_report`) : une ligne
 * par issue, écrite par le serveur avec la clé de service. Aucune donnée de la
 * personne ni du voyage : l'heure et le genre d'issue, rien d'autre.
 */
export type PreparationEventKind = 'ok' | 'pending' | 'already' | 'limited' | 'failed';

/** Le genre d'une issue de préparation. */
export function preparationEventKind(res: {
  success: boolean;
  summary?: unknown;
  pending?: unknown;
  already?: unknown;
  retryInS?: unknown;
}): PreparationEventKind {
  if (res.success) return res.pending ? 'pending' : 'ok';
  if (res.already) return 'already';
  if (typeof res.retryInS === 'number') return 'limited';
  return 'failed';
}

/** Écrit l'issue ; un échec n'empêche jamais la préparation (journal seulement). */
export async function recordPreparationEvent(kind: PreparationEventKind): Promise<void> {
  try {
    const client = getServiceSupabase();
    if (!client) return;
    const { error } = await client.from('ops_preparation_events').insert({ kind });
    if (error) console.warn('[compas] journal des préparations', error.code);
  } catch (err) {
    console.warn('[compas] journal des préparations', err instanceof Error ? err.message : 'erreur');
  }
}
