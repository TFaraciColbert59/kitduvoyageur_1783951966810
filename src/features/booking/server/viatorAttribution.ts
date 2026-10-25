import 'server-only';

import {
  BOOKING_PROVIDER_ERROR_CODES,
  BookingProviderError,
} from './bookingProviderErrors';

/**
 * W4 / D-08 — attribution des réservations Viator.
 *
 * La commission ne se joue pas sur la qualité de l'URL mais sur son
 * impossibilité à être falsifiée. Une campagne contenant `&` permet d'ajouter
 * un paramètre arbitraire ; un `pid` mal formé fait perdre la commission sans
 * le faire.visible ; un hôte libre transforme le lien de sortie en redirection
 * ouverte. Le helper REFUSE donc ces cas au lieu de les assainir : une erreur
 * explicite est préférable à une URL silencieusement malformée qui attribue la
 * vente au mauvais partenaire.
 *
 * `medium=api` est toujours posé : Viator ne reverse pas de commission sur un
 * lien présenté comme organique, et un `medium` fourni par l'appelant ne doit
 * pas pouvoir nous en priver.
 */

/** Liste fermée. Jamais un suffixe large : ce sont des liens de sortie. */
const VIATOR_ATTRIBUTION_HOSTS = new Set(['viator.com', 'www.viator.com']);

/** Un partner id est exactement 9 chiffres. Ni plus, ni moins. */
const PID_PATTERN = /^\d{9}$/;

/** Jetons de campagne : alphanumériques et tirets, bornés. */
const CAMPAIGN_PATTERN = /^[a-zA-Z0-9-]{1,64}$/;
const MCID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

const MAX_BASE_LENGTH = 300;

export interface ViatorAttribution {
  pid: string;
  mcid?: string | null;
  campaign?: string | null;
}

function refuse(message: string): never {
  throw new BookingProviderError({
    code: BOOKING_PROVIDER_ERROR_CODES.validation,
    provider: 'viator',
    // Le message nomme le champ, jamais la valeur rejetée : une valeur
    // rejetée peut contenir une charge utile d'injection.
    message,
  });
}

function isValidCampaign(value: string): boolean {
  return CAMPAIGN_PATTERN.test(value);
}

/**
 * Construit l'URL d'attribution, ou REFUSE.
 * Ordre des paramètres garanti : pid, mcid, campaign, medium.
 */
export function buildViatorAttributionUrl(base: string, attribution: ViatorAttribution): string {
  if (typeof base !== 'string' || base.length === 0 || base.length > MAX_BASE_LENGTH) {
    return refuse('Base d attribution Viator absente ou trop longue.');
  }

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return refuse('Base d attribution Viator invalide.');
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    return refuse('La base d attribution Viator doit etre une URL HTTPS sans identifiants.');
  }
  if (!VIATOR_ATTRIBUTION_HOSTS.has(url.hostname.toLowerCase())) {
    return refuse('Hote d attribution Viator hors allowlist.');
  }

  const pid = typeof attribution.pid === 'string' ? attribution.pid.trim() : '';
  if (!PID_PATTERN.test(pid)) {
    return refuse('VIATOR_PID doit etre exactement 9 chiffres.');
  }

  const mcid = typeof attribution.mcid === 'string' ? attribution.mcid.trim() : '';
  if (mcid && !MCID_PATTERN.test(mcid)) {
    return refuse('VIATOR_MCID contient des caracteres non autorises.');
  }

  const campaign = typeof attribution.campaign === 'string' ? attribution.campaign.trim() : '';
  if (campaign && !isValidCampaign(campaign)) {
    return refuse('VIATOR_CAMPAIGN contient des caracteres non autorises.');
  }

  // Purge puis réinsertion : l'ordre est déterministe et un paramètre
  // préexistant ne peut pas survives.
  url.searchParams.delete('pid');
  url.searchParams.delete('mcid');
  url.searchParams.delete('campaign');
  url.searchParams.delete('medium');

  url.searchParams.set('pid', pid);
  if (mcid) url.searchParams.set('mcid', mcid);
  if (campaign) url.searchParams.set('campaign', campaign);
  url.searchParams.set('medium', 'api');

  return url.toString();
}

export type ViatorAttributionEnv = Record<string, string | undefined>;

/**
 * Lecture des variables d'environnement. ABSENCE = aucune attribution, pas une
 * attribution fantôme : sans pid, on ne fabrique pas de lien qui pretendrait
 * rapporter une commission.
 */
export function resolveViatorAttribution(
  env: ViatorAttributionEnv = process.env
): ViatorAttribution | null {
  const pid = (env.VIATOR_PID ?? '').trim();
  if (!PID_PATTERN.test(pid)) return null;
  return {
    pid,
    mcid: (env.VIATOR_MCID ?? '').trim() || null,
    campaign: (env.VIATOR_CAMPAIGN ?? '').trim() || null,
  };
}

/**
 * Applique l'attribution à une base si elle est exploitable.
 * Une configuration absente laisse la base intacte : c'est un état légitime,
 * pas une erreur. Une configuration INVALIDE, elle, est refusée.
 */
export function applyViatorAttribution(
  base: string,
  env: ViatorAttributionEnv = process.env
): string {
  const attribution = resolveViatorAttribution(env);
  if (!attribution) return base;
  return buildViatorAttributionUrl(base, attribution);
}