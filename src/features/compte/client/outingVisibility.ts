import type { StoredOutingVisibility } from '@/features/compte/domain/outingAudience';

/**
 * Écriture d'une audience de sortie avec le seul contrat serveur existant :
 * `PATCH /api/compte/sorties/[id]` (propriétaire vérifié par `requireUser`,
 * filtre `user_id` et RLS). Aucun endpoint en lot n'est inventé : le lot est
 * orchestré côté client, avec un résultat par sortie.
 */
export async function updateOutingVisibility(
  outingId: string,
  visibility: StoredOutingVisibility
): Promise<void> {
  const response = await fetch(
    `/api/compte/sorties/${encodeURIComponent(outingId)}`,
    {
      method: 'PATCH',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ visibility }),
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.error === 'string'
        ? payload.error
        : `La visibilité n’a pas pu être enregistrée (HTTP ${response.status}).`;
    throw new Error(message);
  }
}

export function outingVisibilityErrorMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return 'Connexion indisponible : la visibilité n’a pas été enregistrée.';
  }
  if (!(error instanceof Error) || !error.message.trim()) {
    return 'La visibilité de la sortie n’a pas pu être enregistrée.';
  }
  return error.message;
}
