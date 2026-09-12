import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';

/**
 * Enfilage best-effort du job d'enrichissement d'activité (`activity-enrichment`).
 *
 * Insère une ligne `ai_jobs { user_id, feature, payload: { tripId } }` via le
 * client service. Toute indisponibilité (service absent, erreur d'insertion)
 * est journalisée et n'interrompt jamais la création de l'activité : le socle
 * déterministe reste servi même sans enrichissement.
 */
export async function enqueueActivityEnrichment(tripId: string, userId: string): Promise<void> {
  const service = getServiceSupabase();
  if (!service) {
    console.error(
      '[LKDV activity-enrichment] client service indisponible — job non enfilé:',
      tripId
    );
    return;
  }

  try {
    const { error } = await service.from('ai_jobs').insert({
      user_id: userId,
      feature: 'activity-enrichment',
      payload: { tripId },
    });
    if (error) {
      console.error(
        '[LKDV activity-enrichment] insertion ai_jobs en échec:',
        error.message,
        tripId
      );
    }
  } catch (error) {
    console.error('[LKDV activity-enrichment] enfilage en erreur inattendue:', error, tripId);
  }
}
