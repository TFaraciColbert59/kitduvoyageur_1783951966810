/**
 * Texte accessible de la carte d'un carnet. Il reprend l'état vide réel
 * (masquée, indisponible, absente) au lieu du message générique « aucun
 * tracé », qui serait faux pour un visiteur non autorisé.
 */
export function carnetMapSummary(
  pointCount: number,
  emptyTitle: string,
  emptyHint: string
): string {
  if (pointCount >= 2) {
    return `Tracé du carnet : ${pointCount} points géolocalisés.`;
  }
  return `${emptyTitle} ${emptyHint}`.trim();
}
