import { ALL_COUNTRIES } from '@/lib/countries';
import type { CountryDetail } from '@/lib/countryDetails';
import type { AIRequest, AIResponse } from '../providers/types';

/**
 * Feature « country-guides » — Q&R pays (Chantier D).
 * Le cache EST le modèle économique : réponses pré-générées hors trafic,
 * TTL 30 jours → ~90 % de cache HIT = instantané, gratuit, sans quota.
 * La pré-génération (countryGuidesPregen) et la route d'ask utilisent le MÊME
 * buildGuidePrompt → mêmes clés de cache.
 */

export const COUNTRY_GUIDES_SPEC = {
  tier: 'heavy' as const,
  maxReasoningBudget: 2000,
  cacheTtlSeconds: 2_592_000, // 30 jours
  maxPerUserPerDay: 30,
};

/** Les ~25 questions fréquentes pré-générées pour chaque pays. */
export const COUNTRY_QUESTIONS: string[] = [
  "L'eau du robinet est-elle potable ?",
  'Faut-il un filtre à eau ou des pastilles purificatrices ?',
  'Quel est le niveau de sécurité pour les voyageurs ?',
  'Quelles sont les zones à éviter ?',
  'Faut-il un visa, et comment l\'obtenir ?',
  'Quelle est la meilleure saison pour voyager ?',
  'Quel est le climat par grande période ?',
  'Quel budget quotidien prévoir ?',
  'Quelles prises électriques et quelle tension ?',
  'Quelle est la monnaie locale et faut-il du liquide ?',
  'Comment fonctionne le pourboire ?',
  'Quels sont les numéros d\'urgence ?',
  'Quels vaccins sont recommandés ?',
  'Que mettre dans la trousse de secours ?',
  'Faut-il une assurance voyage spécifique ?',
  'Comment se déplacer sur place (transport local) ?',
  'Peut-on louer une voiture, et avec quel permis ?',
  'Quelle connectivité : carte SIM locale, eSIM, wifi ?',
  'Quelles formalités douanières à l\'entrée ?',
  'Quels sont les plats typiques et les précautions alimentaires ?',
  'Quelle langue parle-t-on et l\'anglais suffit-il ?',
  'Quelles sont les règles culturelles et religieuses à respecter ?',
  'Quels équipements outdoor sont indispensables selon la saison ?',
  'Y a-t-il des risques naturels (altitude, séismes, faune) ?',
  'Quels sont les incontournables pour un premier voyage ?',
];

export function isSupportedCountry(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return false;
  return ALL_COUNTRIES.some((c) => c.code.toUpperCase() === normalized && c.published !== false);
}

export function getCountryName(code: string): string {
  const country = ALL_COUNTRIES.find((c) => c.code.toUpperCase() === code.trim().toUpperCase());
  return country?.nom ?? code;
}

/** Faits déterministes du pays, injectés dans le prompt et le fallback. */
export function buildCountryContext(detail: Partial<CountryDetail>): string {
  const lines = [
    `Pays : ${detail.nom ?? 'inconnu'}`,
    `Région : ${detail.region ?? 'non renseignée'}`,
    `Capitale : ${detail.capitale ?? 'non renseignée'}`,
    `Langue(s) : ${detail.langue ?? 'non renseignée'}${detail.langue_sub ? ` (${detail.langue_sub})` : ''}`,
    `Monnaie : ${detail.monnaie_nom ?? 'non renseignée'}${detail.monnaie_code ? ` (${detail.monnaie_code})` : ''}`,
    `Meilleure saison : ${detail.saison_recommandee ?? 'non renseignée'}`,
    `Fuseau : ${detail.fuseau ?? 'non renseigné'}`,
  ];
  return lines.join('\n');
}

export function buildGuidePrompt(
  countryName: string,
  question: string,
  context: string
): { system: string; prompt: string } {
  const system =
    'Tu es un guide de voyage francophone expert, précis et prudent. Réponds en français, ' +
    'en 80 à 150 mots, en texte brut (pas de JSON, pas de markdown, pas de liste à puces). ' +
    "Si une information est incertaine ou changeante (visa, sécurité, prix), dis-le explicitement " +
    'et renvoie vers les sources officielles — n\'invente jamais un chiffre ou une règle.';

  const prompt = `Contexte factuel du pays :
${context}

Question du voyageur : ${question}

Réponds pour un voyageur qui prépare son kit et son itinéraire dans ce pays.`;

  return { system, prompt };
}

/** Fallback déterministe : faits du guide pays statique + mention sobre obligatoire. */
export function buildGuideFallback(detail: Partial<CountryDetail> | undefined, question: string): string {
  const intro = detail?.nom
    ? `Réponse standard pour ${detail.nom} — l'assistant est très sollicité en ce moment. Voici l'essentiel de la fiche pays :`
    : "Réponse standard — l'assistant est très sollicité en ce moment. Consultez la fiche pays pour le détail :";

  const facts = detail?.nom
    ? [
        `Capitale : ${detail.capitale ?? 'non renseignée'}`,
        `Langue(s) : ${detail.langue ?? 'non renseignée'}`,
        `Monnaie : ${detail.monnaie_nom ?? 'non renseignée'}${detail.monnaie_code ? ` (${detail.monnaie_code})` : ''}`,
        `Meilleure saison : ${detail.saison_recommandee ?? 'non renseignée'}`,
      ].join(' · ')
    : 'Climat, monnaie, santé et sécurité y sont détaillés.';

  return `${intro}\n${facts}\nPour votre question (« ${question.trim()} »), reportez-vous aux sources officielles et à la fiche pays complète.`;
}

export async function fallbackResponse(_req: AIRequest): Promise<AIResponse> {
  return {
    text: "Réponse standard — l'assistant est très sollicité en ce moment. Consultez la fiche pays pour les informations essentielles (climat, monnaie, santé, sécurité) et reformulez votre question dans quelques instants.",
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
