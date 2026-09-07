import type { Provenance } from '../schemas/autoGen.schema';

/**
 * Règle Z-R1 : Aucune valeur fabriquée ne porte une provenance officielle.
 * Une provenance déclarée 'official' ou 'community' doit obligatoirement
 * posséder un sourceRef résoluble (URL https/http ou référence à un jeu de données public versionné).
 */
export function isResolubleProvenance(provenance?: Provenance | null): boolean {
  if (!provenance) return false;
  if (provenance.source === 'estimated' || provenance.source === 'computed' || provenance.source === 'suggested') {
    return true;
  }
  if (provenance.source === 'official' || provenance.source === 'community' || provenance.source === 'measured') {
    const ref = provenance.sourceRef?.trim();
    if (!ref) return false;
    // URL directe vérifiable
    if (/^https?:\/\//i.test(ref)) return true;
    // Référence versionnée légitime (ex: relation OSM #ID, décret officiel avec numéro, etc.)
    if (/^(OpenStreetMap relation #\d+|Légifrance|Décret|Arrêté|Loi|Code de)/i.test(ref)) return true;
    return false;
  }
  return false;
}
