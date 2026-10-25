import 'server-only';
import { ALL_COUNTRIES } from '@/lib/countries';
import { getCompleteCountryDetail } from '@/lib/countryDetails';
import { askAI } from './askAI';
import { getCached, setCached } from './responseStore';
import {
  COUNTRY_GUIDES_SPEC,
  COUNTRY_QUESTIONS,
  buildGuidePrompt,
  buildCountryContext,
  getCountryName,
} from './features/countryGuides';

/**
 * Pré-génération du cache « country-guides » (Chantier D) — SERVEUR ONLY.
 * Tourne HORS TRAFIC (cron / script CLI) : pays × ~25 questions → askAI →
 * cache 30 j. En exploitation, ~90 % des requêtes utilisateurs = cache HIT.
 *
 * Tolérant aux pannes : une question dégradée n'est pas écrite (retry au
 * prochain run), un pays inconnu est compté et ignoré, JAMAIS de throw.
 * NB : le script CLI autonome (scripts/ai/pregen-country-guides.mjs) ne peut
 * pas importer ce module server-only — il duplique la boucle minimale avec un
 * fetch OpenRouter direct + RPC set_ai_cache (service role).
 */

const ALL_CODES = ALL_COUNTRIES
  .filter((c) => c.published !== false)
  .map((c) => c.code.toUpperCase());

export interface PregenOptions {
  /** Codes ISO-2 explicites. Absent → tous les pays du référentiel. */
  countries?: string[];
  /** Garde-fous de quota : limite de pays par run (protège le budget :free). */
  limitCountries?: number;
  offset?: number;
  /** Limite de questions par pays (tests / runs partiels). */
  maxQuestions?: number;
  /** Force la régénération même si le cache est encore valide. */
  force?: boolean;
}

export interface PregenResult {
  generated: number;
  skipped: number;
  failed: number;
  invalidCountries: string[];
}

export async function generateForCountries(options: PregenOptions = {}): Promise<PregenResult> {
  const { countries, limitCountries, offset = 0, maxQuestions, force = false } = options;

  const questionBudget = maxQuestions ?? COUNTRY_QUESTIONS.length;

  const requested = countries?.length
    ? countries.map((c) => c.trim().toUpperCase())
    : ALL_CODES;
  const countryCodes = Array.from(new Set(requested)).slice(
    offset,
    limitCountries ? offset + limitCountries : undefined
  );

  const result: PregenResult = { generated: 0, skipped: 0, failed: 0, invalidCountries: [] };

  for (const code of countryCodes) {
    const countryName = getCountryName(code);
    if (countryName === code.trim().toUpperCase()) {
      result.invalidCountries.push(code);
      continue;
    }

    const detail = getCompleteCountryDetail(code);
    const context = buildCountryContext(detail);

    for (const question of COUNTRY_QUESTIONS.slice(0, questionBudget)) {
      try {
        const { system, prompt } = buildGuidePrompt(countryName, question, context);

        if (!force) {
          const existing = await getCached('country-guides', prompt);
          if (existing) {
            result.skipped += 1;
            continue;
          }
        }

        const response = await askAI({
          feature: 'country-guides',
          tier: COUNTRY_GUIDES_SPEC.tier,
          system,
          prompt,
          maxTokens: 512,
          reasoningBudget: COUNTRY_GUIDES_SPEC.maxReasoningBudget,
          cacheTtlSeconds: 0, // la pré-génération écrit elle-même le cache
        });

        if (response.degraded) {
          result.failed += 1; // pas d'écriture : retry au prochain run
          continue;
        }

        await setCached('country-guides', prompt, response, COUNTRY_GUIDES_SPEC.cacheTtlSeconds);
        result.generated += 1;
      } catch (err) {
        result.failed += 1;
        console.error('[ai/countryGuidesPregen] question en échec:', err instanceof Error ? err.message : err);
      }
    }
  }

  return result;
}
