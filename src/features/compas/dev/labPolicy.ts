/**
 * Garde de la page de laboratoire `/dev/compas` : elle montre des données d'ESSAI, donc elle ne
 * s'ouvre qu'en développement (`next dev`). Production, prévisualisation, build et tests : introuvable.
 */
export function canOpenCompasLab(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'development';
}
