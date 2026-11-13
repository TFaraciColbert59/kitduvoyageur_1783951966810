/**
 * S2.37 — « Comprendre ma sortie ».
 *
 * Le bilan déterministe est TOUJOURS rendu : chiffres mesurés/calculés et
 * absences explicites. L'interprétation IA est un enrichissement facultatif,
 * demandé explicitement, et ne peut jamais introduire un chiffre : le texte
 * est refusé s'il contient un chiffre, car les métriques sont déjà affichées
 * et citées séparément. Une clé absente laisse donc le bilan intact.
 */

import {
  AI_ASSISTANT_CONTRACT_VERSION,
  formatDurationFr,
  formatNumberFr,
  formatPaceFr,
  hasValue,
  unavailable,
  type AiGeneration,
  type AssistantCompletionPort,
  type DataCitation,
} from '../contracts';
import { buildActivityFacts, type ActivityFacts, type HikeSessionRecord } from './activityFacts';

export interface DeterministicActivityReading {
  headline: string;
  facts: string[];
  missing: string[];
  citations: DataCitation[];
}

export interface PostActivityInsight {
  contractVersion: string;
  sessionId: string;
  /** Vue sans IA, toujours disponible, même si l'IA est éteinte. */
  deterministic: DeterministicActivityReading;
  ai: AiGeneration;
}

export const ACTIVITY_INSIGHT_SYSTEM_PROMPT =
  "Tu commentes une sortie outdoor déjà mesurée pour Le Kit du Voyageur. " +
  "Les chiffres sont affichés et cités séparément : tu ne dois écrire AUCUN chiffre, " +
  "ni en chiffres arabes, ni en toutes lettres. Tu ne supposes ni météo, ni fréquence " +
  "cardiaque, ni calories, ni rencontres. Tu ne donnes aucun conseil médical. " +
  "Tu écris en français, en deux courts paragraphes (120 mots maximum), en te limitant " +
  "aux faits fournis. Si un fait est absent, tu ne le remplaces pas : tu l'ignores.";

function joinFr(parts: Array<string | null>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' · ');
}

export function buildDeterministicActivityReading(facts: ActivityFacts): DeterministicActivityReading {
  const { metrics } = facts;
  const factsLines: string[] = [];
  if (hasValue(metrics.distanceKm)) {
    factsLines.push(`Distance mesurée : ${formatNumberFr(metrics.distanceKm.value, 2)} km.`);
  }
  if (hasValue(metrics.durationSeconds)) {
    factsLines.push(`Durée de la séance : ${formatDurationFr(metrics.durationSeconds.value)}.`);
  }
  if (hasValue(metrics.elapsedSeconds)) {
    factsLines.push(`Temps écoulé entre le départ et la fin : ${formatDurationFr(metrics.elapsedSeconds.value)}.`);
  }
  if (hasValue(metrics.elevationGainM)) {
    factsLines.push(`Dénivelé positif mesuré : ${formatNumberFr(metrics.elevationGainM.value, 0)} m.`);
  }
  if (hasValue(metrics.maxAltitudeM)) {
    factsLines.push(`Altitude maximale mesurée : ${formatNumberFr(metrics.maxAltitudeM.value, 0)} m.`);
  }
  if (hasValue(metrics.averageSpeedKmh)) {
    factsLines.push(`Vitesse moyenne calculée : ${formatNumberFr(metrics.averageSpeedKmh.value, 1)} km/h.`);
  }
  if (hasValue(metrics.averagePaceSecondsPerKm)) {
    factsLines.push(
      `Allure moyenne calculée sur la durée totale : ${formatPaceFr(metrics.averagePaceSecondsPerKm.value)}.`
    );
  }
  if (hasValue(metrics.poiCount)) {
    factsLines.push(`Points de passage enregistrés : ${formatNumberFr(metrics.poiCount.value, 0)}.`);
  }
  if (hasValue(metrics.weather)) {
    const weather = metrics.weather.value;
    const weatherLabel = joinFr([
      weather.condition,
      weather.temperatureC !== null ? `${formatNumberFr(weather.temperatureC, 0)} °C` : null,
      weather.windKmh !== null ? `${formatNumberFr(weather.windKmh, 0)} km/h de vent` : null,
      weather.precipitationProbability !== null
        ? `${formatNumberFr(weather.precipitationProbability, 0)} % de précipitation`
        : null,
    ]);
    if (weatherLabel) factsLines.push(`Météo enregistrée : ${weatherLabel}.`);
  }

  const missing = facts.missing.map((entry) => `${entry.label} : indisponible (${entry.source}).`);
  const title = facts.session.routeName ?? facts.session.title;
  const headline = title
    ? `Bilan de « ${title} »`
    : facts.session.region
      ? `Bilan de la sortie · ${facts.session.region}`
      : 'Bilan de la sortie';

  return {
    headline,
    facts: factsLines,
    missing,
    citations: facts.citations,
  };
}

export function buildActivityInsight(
  facts: ActivityFacts,
  ai: AiGeneration = unavailable('not_requested', 'Interprétation IA non demandée.')
): PostActivityInsight {
  return {
    contractVersion: AI_ASSISTANT_CONTRACT_VERSION,
    sessionId: facts.session.id,
    deterministic: buildDeterministicActivityReading(facts),
    ai,
  };
}

/**
 * Le prompt ne contient ni coordonnées GPS, ni notes libres : seulement les
 * faits déjà affichés et leur provenance.
 */
export function buildPostActivityPrompt(facts: ActivityFacts): { system: string; prompt: string } {
  const factsBlock = facts.citations
    .map((entry) =>
      entry.value !== null
        ? `- ${entry.label} : ${entry.value} (${entry.status}, ${entry.source})`
        : `- ${entry.label} : indisponible (${entry.source})`
    )
    .join('\n');
  const missingBlock = facts.missing
    .map((entry) => `- ${entry.label} : absent (${entry.source})`)
    .join('\n');

  return {
    system: ACTIVITY_INSIGHT_SYSTEM_PROMPT,
    prompt:
      `Faits disponibles :\n${factsBlock || '- aucun fait chiffré disponible'}\n\n` +
      `Faits absents (ne pas inventer) :\n${missingBlock || '- aucun'}\n\n` +
      'Rédige le commentaire demandé, sans aucun chiffre.',
  };
}

/**
 * Refuse une réponse qui contient un chiffre (arabe), un tableau markdown ou
 * un contenu trop long. Le refus est visible : l'appelant rend l'état
 * « interprétation indisponible », jamais un texte douteux.
 */
export function sanitizeActivityNarrative(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 40 || cleaned.length > 1_200) return null;
  if (/\d/.test(cleaned)) return null;
  if (/[|#*_\[\]]/.test(cleaned)) return null;
  return cleaned;
}

export interface CreateActivityInsightOptions {
  session: HikeSessionRecord;
  includeAi: boolean;
  provider?: AssistantCompletionPort | null;
  now?: () => Date;
}

/** Orchestration sans I/O Supabase : la route fournit la ligne autorisée. */
export async function createActivityInsight(
  options: CreateActivityInsightOptions
): Promise<PostActivityInsight> {
  const facts = buildActivityFacts(options.session);
  const deterministic = buildDeterministicActivityReading(facts);

  if (!options.includeAi) {
    return {
      contractVersion: AI_ASSISTANT_CONTRACT_VERSION,
      sessionId: facts.session.id,
      deterministic,
      ai: unavailable('not_requested', 'Interprétation IA non demandée.'),
    };
  }

  const provider = options.provider;
  if (!provider || !provider.isAvailable()) {
    return {
      contractVersion: AI_ASSISTANT_CONTRACT_VERSION,
      sessionId: facts.session.id,
      deterministic,
      ai: unavailable(
        'provider_unconfigured',
        'Interprétation IA indisponible : aucun fournisseur configuré. Le bilan chiffré reste disponible.'
      ),
    };
  }

  const { system, prompt } = buildPostActivityPrompt(facts);
  try {
    const completion = await provider.complete({ system, prompt, maxTokens: 700 });
    const narrative = sanitizeActivityNarrative(completion.text);
    if (!narrative) {
      return {
        contractVersion: AI_ASSISTANT_CONTRACT_VERSION,
        sessionId: facts.session.id,
        deterministic,
        ai: unavailable(
          'invalid_response',
          'Interprétation IA écartée : la réponse ne respecte pas le contrat (chiffre ou format inattendu).'
        ),
      };
    }
    return {
      contractVersion: AI_ASSISTANT_CONTRACT_VERSION,
      sessionId: facts.session.id,
      deterministic,
      ai: {
        status: 'available',
        provider: completion.provider,
        model: completion.model,
        text: narrative,
        generatedAt: (options.now?.() ?? new Date()).toISOString(),
      },
    };
  } catch {
    return {
      contractVersion: AI_ASSISTANT_CONTRACT_VERSION,
      sessionId: facts.session.id,
      deterministic,
      ai: unavailable(
        'provider_unavailable',
        'Interprétation IA momentanément indisponible. Le bilan chiffré reste disponible.'
      ),
    };
  }
}
