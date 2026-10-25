// src/features/discovery/providers/klook/klookAdapter.ts
import 'server-only';
import { getDiscoveryProvider } from '../../config';
import { KLOOK_LINKS } from './klookData';
import { KLOOK_BRAND_FALLBACK_URL, validateKlookUrl } from './klookLinks';
import type { KlookBlock } from './klookTypes';

export interface GetKlookBlockParams {
  countryCode: string;
  /** Nom affiché de la destination (ex. `Islande`). */
  destination: string;
}

/**
 * Construit le bloc Klook éditorial (mode sans product feed).
 *
 * - Lien par pays (`KLOOK_LINKS`) sinon `KLOOK_AFFILIATE_URL` (env serveur),
 *   sinon racine officielle Klook (non affilié).
 * - Un lien configuré mais NON conforme à l'allowlist ⇒ `null` (jamais d'URL
 *   arbitraire, jamais de fallback silencieux vers un lien invalide).
 * - Aucun appel réseau : le bloc est un simple lien statique.
 */
export function getKlookBlock(params: GetKlookBlockParams): KlookBlock | null {
  // Le CTA Klook éditorial ne s'affiche qu'en mode `klook` (pas en mode viator).
  if (getDiscoveryProvider() !== 'klook') return null;

  const code = params.countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;

  const perCountry = KLOOK_LINKS[code];
  const configured = (perCountry?.url || process.env.KLOOK_AFFILIATE_URL || '').trim();

  let validated;
  if (configured) {
    validated = validateKlookUrl(configured);
    if (!validated) return null; // config invalide → pas de bloc
  } else {
    validated = validateKlookUrl(KLOOK_BRAND_FALLBACK_URL);
    if (!validated) return null;
  }

  const destination = params.destination?.trim() || code;

  return {
    provider: 'klook',
    countryCode: code,
    destination,
    title: perCountry?.title || `Activités à ${destination}`,
    description:
      perCountry?.description ||
      `Découvrez et réservez des expériences locales à ${destination} avec notre partenaire Klook.`,
    ctaLabel: 'Voir les activités sur Klook',
    url: validated.url,
    isAffiliate: validated.isAffiliate,
    // `noreferrer` volontairement ABSENT : il supprimerait le Referer nécessaire
    // à l'attribution Travelpayouts (sous la Referrer-Policy du projet).
    rel: validated.isAffiliate ? 'sponsored noopener' : 'noopener',
  };
}
