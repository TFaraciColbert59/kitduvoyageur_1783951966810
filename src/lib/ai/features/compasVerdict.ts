import type { AIRequest, AIResponse } from '../providers/types';

/**
 * Feature « compas-verdict » — l'IA EXPLIQUE le verdict du Compas.
 *
 * Le niveau et les signaux viennent du moteur ; le modèle ne fait que les
 * reformuler pour un humain. Sa réponse est relue par
 * `features/compas/engine/verdictExplain.checkExplanation` : un nombre absent
 * des faits, un score ou une réassurance la font écarter.
 *
 * tier `fast`, raisonnement coupé. Cache d'un jour (plan 1.7) : les faits
 * (niveau, signaux, météo, étapes) sont toute la demande, donc la clé ; une
 * réponse n'est reprise que pour exactement les mêmes faits.
 */

export const COMPAS_VERDICT_SPEC = {
  tier: 'fast' as const,
  maxReasoningBudget: 0,
  cacheTtlSeconds: 86_400,
  // Relevé le 14 oct. 2026 (décision de Tony : « utilise l'IA au maximum »).
  maxPerUserPerDay: 120,
};

/**
 * `locale` : langue de l'interface du lecteur (PLAN-100 6.2). Seule la valeur exacte `'en'`
 * change la consigne ; sinon, la consigne française d'avant au caractère près.
 */
type VerdictLocale = 'fr' | 'en' | 'es' | 'de' | 'it';

const VERDICT_SYSTEM: Record<'es' | 'de' | 'it', string[]> = {
  es: [
    'Explicas en español, a una persona que prepara una salida a la montaña, el veredicto calculado por una aplicación. Los hechos pueden estar escritos en francés.',
    'Reglas imperativas:',
    '1. Dos frases cortas, 350 caracteres como máximo, texto simple sin lista, sin título ni markdown.',
    '2. Usas ÚNICAMENTE los hechos facilitados. Ningún número, lugar, horario, consejo cifrado o equipo que no figure en ellos.',
    '3. Nunca cambias el nivel decidido; no das ninguna puntuación ni nota.',
    '4. No tranquilices más allá de los hechos: nunca «sin peligro», «ningún riesgo», «totalmente seguro».',
    '5. Di lo que no se pudo comprobar cuando los hechos lo mencionen.',
  ],
  de: [
    'Du erklärst auf Deutsch einer Person, die einen Bergausflug vorbereitet, das von einer Anwendung berechnete Urteil. Die Fakten können auf Französisch geschrieben sein.',
    'Verbindliche Regeln:',
    '1. Zwei kurze Sätze, höchstens 350 Zeichen, einfacher Text ohne Liste, ohne Titel und ohne Markdown.',
    '2. Du verwendest NUR die gelieferten Fakten. Keine Zahl, kein Ort, keine Uhrzeit, kein bezifferter Rat und keine Ausrüstung, die nicht darin steht.',
    '3. Du änderst nie die festgelegte Stufe; Du gibst keine Punktzahl und keine Note.',
    '4. Beruhige nicht über die Fakten hinaus: niemals „ungefährlich“, „kein Risiko“, „völlig sicher“.',
    '5. Sage, was nicht geprüft werden konnte, wenn die Fakten es erwähnen.',
  ],
  it: [
    'Spieghi in italiano, a una persona che prepara un’uscita in montagna, il verdetto calcolato da un’applicazione. I fatti possono essere scritti in francese.',
    'Regole imperative:',
    '1. Due frasi brevi, al massimo 350 caratteri, testo semplice senza elenco, senza titolo né markdown.',
    '2. Usi SOLO i fatti forniti. Nessun numero, luogo, orario, consiglio quantificato o attrezzatura che non vi figuri.',
    '3. Non cambi mai il livello deciso; non dai alcun punteggio né voto.',
    '4. Non rassicurare oltre i fatti: mai «senza pericolo», «nessun rischio», «del tutto sicuro».',
    '5. Di’ ciò che non si è potuto verificare quando i fatti lo menzionano.',
  ],
};

export function buildCompasVerdictSystem(locale?: VerdictLocale): string {
  if (locale === 'es' || locale === 'de' || locale === 'it') return VERDICT_SYSTEM[locale].join('\n');
  if (locale === 'en')
    return [
      'You explain in English, to a person preparing a mountain outing, the verdict computed by an application. The facts may be written in French.',
      'Mandatory rules:',
      '1. Two short sentences, 350 characters at most, plain text with no list, no title and no markdown.',
      '2. Use ONLY the facts provided. No number, place, time, quantified advice or equipment that is not in them.',
      '3. Never change the decided level; give no score and no rating.',
      '4. Do not reassure beyond the facts: never "no risk", "completely safe", "nothing to worry about".',
      '5. Say what could not be checked when the facts mention it.',
    ].join('\n');
  return [
    'Tu expliques en francais, a une personne qui prepare une sortie en montagne, le verdict calcule par une application.',
    'Regles imperatives :',
    '1. Deux phrases courtes, 350 caracteres au plus, texte simple sans liste, sans titre ni markdown.',
    '2. Tu n utilises QUE les faits fournis. Aucun nombre, lieu, horaire, conseil chiffre ou equipement qui n y figure pas.',
    '3. Tu ne changes jamais le niveau decide ; tu ne donnes aucun score ni aucune note.',
    '4. Tu ne rassures pas au-dela des faits : jamais « sans danger », « aucun risque », « en toute securite ».',
    '5. Tu dis ce qui n a pas pu etre verifie quand les faits le mentionnent.',
  ].join('\n');
}

export function buildCompasVerdictPrompt(facts: string, locale?: VerdictLocale): string {
  if (locale === 'es') return `Hechos (única fuente autorizada):\n${facts}\n\nExplica este veredicto.`;
  if (locale === 'de') return `Fakten (einzige erlaubte Quelle):\n${facts}\n\nErkläre dieses Urteil.`;
  if (locale === 'it') return `Fatti (unica fonte autorizzata):\n${facts}\n\nSpiega questo verdetto.`;
  if (locale === 'en') return `Facts (only allowed source):\n${facts}\n\nExplain this verdict.`;
  return `Faits (seule source autorisee) :\n${facts}\n\nExplique ce verdict.`;
}

export async function fallbackResponse(_req: AIRequest): Promise<AIResponse> {
  // Jamais affiché comme une explication : l'action détecte `degraded`.
  return {
    text: 'Explication indisponible.',
    model: 'fallback-deterministe',
    degraded: true,
    cached: false,
    provider: 'fallback',
  };
}
