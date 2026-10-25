// src/features/discovery/providers/klook/klookTypes.ts
// Modèle affilié générique pour Klook. Aucun objet brut Travelpayouts/Klook
// n'atteint l'UI. Ce fichier ne contient AUCUN secret et peut être importé
// côté client (type uniquement).

export type KlookProvider = 'klook';

export interface KlookBlock {
  provider: KlookProvider;
  countryCode: string;
  /** Destination affichée (nom du pays). */
  destination: string;
  title: string;
  description: string;
  ctaLabel: string;
  /** URL HTTPS validée contre l'allowlist Klook / Travelpayouts. */
  url: string;
  /** `true` si l'URL est un lien d'affiliation Travelpayouts généré. */
  isAffiliate: boolean;
  /** Attributs `rel` calculés (sponsored + noopener pour l'affiliation). */
  rel: string;
}

export interface KlookLinkConfig {
  url: string;
  title?: string;
  description?: string;
}
