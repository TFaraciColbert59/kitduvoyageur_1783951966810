/**
 * disclosureRegion.ts — Texte de la mention d'affiliation selon la RÉGION de la personne
 * (PLAN-100 6.4 « Mentions légales et d'affiliation par région »). Pur et déterministe.
 *
 * - France (`fr`) et Union européenne (`eu`) : la mention française existante (pratiques
 *   commerciales, contrôle DGCCRF ; Code de la consommation L121-2 et L121-3) et sa traduction.
 * - États-Unis (`us`) : la même mention, précédée d'une note qui dit en clair le lien financier
 *   (« material connection », vocabulaire des guides de la FTC sur les recommandations).
 * - Royaume-Uni (`uk`) : la même mention, signalée comme publicité dès l'étiquette visible
 *   (« Ad », attente de la CMA et de l'ASA pour les liens d'affiliation).
 * - Ailleurs, ou région inconnue (`default`) : la mention actuelle, sans note.
 *
 * Ces formulations sont prudentes et restent À VALIDER PAR UN JURISTE avant toute ouverture
 * hors de France (docs/compas/AFFILIATION-REGIONS.md). Ce module ne rend aucune langue
 * disponible : la langue servie reste décidée par `isLocaleEnabled`.
 *
 * La région vient d'un code ISO 3166-1 (`US`, deux majuscules) ou d'une balise de langue
 * (`en-GB`, `fr`) : c'est la convention choisie par la personne, jamais sa nationalité.
 */

import type { Locale } from '@/lib/i18n/locale';
import { regionOf } from '@/lib/i18n/region';
import { translations } from '@/lib/i18n/translations';

export type DisclosureRegime = 'fr' | 'eu' | 'us' | 'uk' | 'default';

/** États membres de l'Union européenne hors France (ISO 3166-1 alpha-2). */
const EU = new Set(
  'AT BE BG CY CZ DE DK EE ES FI GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK'.split(' ')
);

/** Région d'un code ISO (`US`) ou d'une balise (`en-US`, `fr`), ou `null`. */
function regionFrom(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  return regionOf(raw);
}

/** Le régime de mention d'une région ou d'une balise de langue. */
export function disclosureRegimeFor(value: string | null | undefined): DisclosureRegime {
  const region = regionFrom(value);
  if (!region) return 'default';
  if (region === 'FR') return 'fr';
  if (region === 'US') return 'us';
  if (region === 'GB') return 'uk';
  if (EU.has(region)) return 'eu';
  return 'default';
}

export interface AffiliateDisclosureCopy {
  regime: DisclosureRegime;
  /** Nom accessible de la note (`aria-label`). */
  ariaLabel: string;
  /** Étiquette visible de la version compacte (toujours lue sans ouvrir le détail). */
  summary: string;
  /** Texte réservé aux lecteurs d'écran, sur le bouton d'ouverture du détail. */
  showDetail: string;
  /** Version complète : titre, corps, phrase mise en avant. */
  title: string;
  body: string;
  emphasis: string;
  /** Version compacte : texte du détail. */
  compact: string;
  /** Note régionale, lue AVANT le texte (États-Unis, Royaume-Uni) ; `null` sinon. */
  note: string | null;
}

/**
 * Texte de la mention pour une langue et une région. Sans région, celle de la langue
 * (`fr` → France, `en` → États-Unis, `de` → Allemagne).
 */
export function affiliateDisclosureCopy(
  locale: Locale = 'fr',
  region?: string | null
): AffiliateDisclosureCopy {
  const regime = disclosureRegimeFor(region ?? locale);
  const d = (translations[locale] ?? translations.fr).affiliation.disclosure;
  const regional = regime === 'us' ? d.us : regime === 'uk' ? d.uk : null;
  return {
    regime,
    ariaLabel: d.ariaLabel,
    summary: regional?.summary ?? d.summary,
    showDetail: d.showDetail,
    title: d.title,
    body: d.body,
    emphasis: d.emphasis,
    compact: d.compact,
    note: regional?.note ?? null,
  };
}
