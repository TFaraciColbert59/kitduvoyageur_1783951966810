/** Formatage compact partagé par les cartes Kit et Inventaire du drawer. */

/** Poids en grammes → « 4,2 kg » ; jamais de poids inventé quand la donnée manque. */
export function formatWeight(grams: number | null | undefined): string {
  if (typeof grams !== 'number' || !Number.isFinite(grams) || grams <= 0) {
    return 'Poids non renseigné';
  }
  const kg = Math.round((grams / 1000) * 10) / 10;
  return `${String(kg).replace('.', ',')} kg`;
}

/** Montant en euros → « 12,50 € » ; `null` quand le montant n'est pas réel. */
export function formatEuro(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return `${value.toFixed(2).replace('.', ',')} €`;
}

/** Nom lisible d'une ligne d'historique (action + date), sans donnée inventée. */
export function formatHistoryLine(entry: {
  action?: string | null;
  created_at?: string | null;
}): string | null {
  const action = typeof entry.action === 'string' ? entry.action.trim() : '';
  const date = typeof entry.created_at === 'string' ? entry.created_at : '';
  const parsed = date ? new Date(date) : null;
  const day = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString('fr-FR') : '';
  const parts = [action, day].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}
