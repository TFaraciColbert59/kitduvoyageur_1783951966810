import 'server-only';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import {
  ContentBlockType,
  ContentBlockRecord,
  CONTENT_BLOCK_TYPES,
} from './contentBlocksTypes';
import { generateContentBlock } from './generateContentBlock';
import {
  generateSafetyCriticalBlock,
  SafetyCriticalBlockType,
} from './generateSafetyCriticalBlock';
import { generateCountryKitRecommendation } from './recommendCountryKits';

export interface CountryGenerationReport {
  country_code: string;
  total_blocks: number;
  success_count: number;
  degraded_count: number;
  blocks: Partial<Record<ContentBlockType, ContentBlockRecord>>;
}

const DELAY_MS = 800;
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Génère l'ensemble des 13 blocs des 4 tiers pour un pays donné.
 */
export async function generateCountryFullContent(
  rawCountryCode: string,
  options: { force?: boolean } = {}
): Promise<CountryGenerationReport> {
  const countryCode = rawCountryCode.trim().toUpperCase();
  const report: CountryGenerationReport = {
    country_code: countryCode,
    total_blocks: CONTENT_BLOCK_TYPES.length,
    success_count: 0,
    degraded_count: 0,
    blocks: {},
  };

  // 1. Tier 1 — Safety-Critical (formalites, securite_alertes)
  const tier1Types: SafetyCriticalBlockType[] = ['formalites', 'securite_alertes'];
  for (const bType of tier1Types) {
    try {
      const record = await generateSafetyCriticalBlock(countryCode, bType, options);
      report.blocks[bType] = record;
      if (record.degraded) report.degraded_count++;
      else report.success_count++;
    } catch (err) {
      console.error(`[generateCountryFullContent] Erreur Tier 1 (${countryCode}/${bType}):`, err);
      report.degraded_count++;
    }
    await sleep(DELAY_MS);
  }

  // 2. Tier 2 & Tier 3 (transport, budget, sante, etiquette, vue_ensemble, etc.)
  const tiers2And3: Exclude<ContentBlockType, SafetyCriticalBlockType | 'recommandations_kit'>[] = [
    'transport',
    'budget',
    'sante',
    'etiquette',
    'vue_ensemble',
    'meilleure_periode_activite',
    'itineraires_suggeres',
    'spots_incontournables',
    'niveau_difficulte',
    'faq',
  ];

  for (const bType of tiers2And3) {
    try {
      const record = await generateContentBlock(countryCode, bType, options);
      report.blocks[bType] = record;
      if (record.degraded) report.degraded_count++;
      else report.success_count++;
    } catch (err) {
      console.error(`[generateCountryFullContent] Erreur Tier 2/3 (${countryCode}/${bType}):`, err);
      report.degraded_count++;
    }
    await sleep(DELAY_MS);
  }

  // 3. Tier 4 — Recommandations Kits réels
  try {
    const kitRecord = await generateCountryKitRecommendation(countryCode, options);
    report.blocks.recommandations_kit = kitRecord;
    if (kitRecord.degraded) report.degraded_count++;
    else report.success_count++;
  } catch (err) {
    console.error(`[generateCountryFullContent] Erreur Tier 4 (${countryCode}):`, err);
    report.degraded_count++;
  }

  return report;
}

/**
 * Génère le contenu complet pour une liste de pays par lots.
 */
export async function batchGenerateCountries(
  countryCodes: string[],
  options: { force?: boolean } = {}
): Promise<CountryGenerationReport[]> {
  const reports: CountryGenerationReport[] = [];

  for (const code of countryCodes) {
    const rep = await generateCountryFullContent(code, options);
    reports.push(rep);
    await sleep(1500); // Pause inter-pays pour soulager les quotas
  }

  return reports;
}

/**
 * Recherche et régénère les blocs périmés (stale_after < NOW()).
 * Utilisé par les routes cron.
 */
export async function refreshStaleBlocks(options: {
  limit?: number;
  tier?: 1 | 2 | 3 | 4;
  blockType?: ContentBlockType;
} = {}): Promise<{ refreshed: number; errors: number }> {
  const supabase = getServiceSupabase();
  if (!supabase) return { refreshed: 0, errors: 0 };

  const limit = options.limit ?? 20;
  let query = supabase
    .from('country_content_blocks')
    .select('country_code, block_type, tier')
    .lt('stale_after', new Date().toISOString())
    .order('stale_after', { ascending: true })
    .limit(limit);

  if (options.tier) {
    query = query.eq('tier', options.tier);
  }
  if (options.blockType) {
    query = query.eq('block_type', options.blockType);
  }

  const { data: staleList, error } = await query;
  if (error || !staleList || staleList.length === 0) {
    return { refreshed: 0, errors: 0 };
  }

  let refreshed = 0;
  let errors = 0;

  for (const item of staleList) {
    try {
      const bType = item.block_type as ContentBlockType;
      if (bType === 'formalites' || bType === 'securite_alertes') {
        await generateSafetyCriticalBlock(item.country_code, bType, { force: true });
      } else if (bType === 'recommandations_kit') {
        await generateCountryKitRecommendation(item.country_code, { force: true });
      } else {
        await generateContentBlock(item.country_code, bType, { force: true });
      }
      refreshed++;
    } catch {
      errors++;
    }
    await sleep(DELAY_MS);
  }

  return { refreshed, errors };
}
