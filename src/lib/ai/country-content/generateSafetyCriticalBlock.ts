import 'server-only';
import { askAI } from '@/lib/ai/askAI';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { getCountryByCode } from '@/lib/countries';
import {
  ContentBlockType,
  BLOCK_FRESHNESS_DAYS,
  ContentBlockRecord,
  ContentSource,
} from './contentBlocksTypes';
import { parseContentBlockResponse } from './generateContentBlock';

export type SafetyCriticalBlockType = 'formalites' | 'securite_alertes';

const SAFETY_PROMPTS: Record<SafetyCriticalBlockType, { label: string; details: string }> = {
  formalites: {
    label: 'Formalités d\'entrée & Visas',
    details: 'conditions d\'entrée pour ressortissants français/UE (passeport validité requise, visa, e-visa, dispense, taxe de séjour ou formulaire d\'arrivée requis)',
  },
  securite_alertes: {
    label: 'Sécurité & Alertes en cours',
    details: 'niveau de vigilance officiel, zones déconseillées ou à vigilance renforcée, risques naturels récents (séismes, moussons, feux, crues), urgences consulaires et numéros de secours locaux',
  },
};

export function buildSafetyPrompt(
  blockType: SafetyCriticalBlockType,
  countryName: string,
  countryCode: string,
  currentYear = new Date().getFullYear()
): { system: string; prompt: string } {
  const cfg = SAFETY_PROMPTS[blockType];

  const system = `Tu es l'analyste consulaire et sûreté voyage pour "Le Kit du Voyageur" (LKDV).
Tu rédiges le bloc "${cfg.label}" pour le pays ${countryName} (${countryCode}) en ${currentYear}.
Obligation absolue : Renseignements officiels vérifiés et actuels (${cfg.details}).
Tu dois t'appuyer sur les sources de référence comme France Diplomatie (Conseils aux voyageurs), les ambassades et les ministères de l'intérieur.
Format de sortie OBLIGATOIRE : JSON strict valide avec guillemets doubles.
Format attendu :
{
  "content_md": "Texte synthétique et percutant rédigé en français avec mise en gras des points critiques **...** (80 à 180 mots). Indiquer la date de dernière vérification ou fraîcheur des consignes. Pas de titre H1/H2.",
  "content_json": null,
  "sources": [
    {"title": "France Diplomatie - Conseils aux voyageurs", "url": "https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/conseils-par-pays-destination/"}
  ]
}`;

  const prompt = `Consulte les données officielles et d'actualité pour ${countryName} (${countryCode}) sur le bloc : ${cfg.label}. Fournis des informations précises, fiables et sourcées avec URL réelles.`;

  return { system, prompt };
}

/**
 * Génère un bloc Tier 1 (Safety-Critical).
 * Ce bloc a TOUJOURS `needs_human_review = true` et `reviewed_at = null` à sa génération,
 * ce qui empêche sa lecture publique via la RLS tant qu'un relecteur humain ne l'a pas validé.
 */
export async function generateSafetyCriticalBlock(
  rawCountryCode: string,
  blockType: SafetyCriticalBlockType,
  options: { force?: boolean } = {}
): Promise<ContentBlockRecord> {
  const countryCode = rawCountryCode.trim().toUpperCase();
  const freshnessDays = BLOCK_FRESHNESS_DAYS[blockType];
  const supabase = getServiceSupabase();

  if (!supabase) {
    throw new Error('[generateSafetyCriticalBlock] Client service Supabase indisponible');
  }

  // 1. Résolution du nom du pays
  const localCountry = getCountryByCode(countryCode);
  let countryName: string = localCountry?.nom || countryCode;
  if (countryName === countryCode) {
    const { data: geoCountry } = await supabase
      .from('countries_geo')
      .select('name')
      .eq('iso_a2', countryCode)
      .maybeSingle();
    if (geoCountry?.name) countryName = geoCountry.name;
  }

  // 2. Vérification cache frais
  if (!options.force) {
    const { data: existing } = await supabase
      .from('country_content_blocks')
      .select('*')
      .eq('country_code', countryCode)
      .eq('block_type', blockType)
      .maybeSingle();

    if (existing && !existing.degraded) {
      const isFresh = new Date(existing.stale_after).getTime() > Date.now();
      if (isFresh) {
        return existing as ContentBlockRecord;
      }
    }
  }

  // 3. Journalisation job
  const { data: jobEntry } = await supabase
    .from('ai_jobs')
    .insert({
      feature: 'country-practical-guide',
      payload: { country_code: countryCode, block_type: blockType, tier: 1 },
      status: 'processing',
    })
    .select('id')
    .single();
  const jobId = jobEntry?.id;

  // 4. Appel IA avec plugin web actif pour recherche d'actualité fraîche
  const { system, prompt } = buildSafetyPrompt(blockType, countryName, countryCode);
  let responseText = '';
  let modelUsed = 'nvidia/nemotron-3.5-lightning:free';
  let isDegraded = false;

  try {
    const aiRes = await askAI({
      feature: 'country-practical-guide',
      tier: 'fast',
      system,
      prompt,
      maxTokens: 1024,
      cacheTtlSeconds: freshnessDays * 86400,
      plugins: [{ id: 'web', max_results: 5 }],
    });
    responseText = aiRes.text;
    modelUsed = aiRes.model || modelUsed;
    isDegraded = aiRes.degraded;
  } catch (err) {
    console.error(`[generateSafetyCriticalBlock] askAI en échec (${countryCode} - ${blockType}):`, err);
    isDegraded = true;
  }

  // 5. Parsing & extraction des sources
  const parsed = parseContentBlockResponse(responseText, blockType);
  let contentMd = '';
  let sources: ContentSource[] = [];

  if (parsed && !isDegraded) {
    contentMd = parsed.content_md;
    sources = parsed.sources;
  } else {
    isDegraded = true;
    contentMd = `Informations officielles de sécurité pour ${countryName} en cours d'actualisation. Veuillez consulter directement France Diplomatie.`;
    sources = [
      {
        title: 'France Diplomatie - Conseils aux voyageurs',
        url: 'https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/',
      },
    ];
  }

  const generatedAt = new Date().toISOString();
  const staleAfter = new Date(Date.now() + freshnessDays * 86400 * 1000).toISOString();

  const payloadToUpsert = {
    country_code: countryCode,
    block_type: blockType,
    tier: 1,
    content_md: contentMd,
    content_json: null,
    sources,
    model_used: modelUsed,
    generated_at: generatedAt,
    stale_after: staleAfter,
    degraded: isDegraded,
    // Garde-fou de sécurité : TOUJOURS review humaine obligatoire pour le Tier 1
    needs_human_review: true,
    reviewed_at: null,
    reviewed_by: null,
  };

  const { data: saved, error: upsertErr } = await supabase
    .from('country_content_blocks')
    .upsert(payloadToUpsert, { onConflict: 'country_code,block_type' })
    .select('*')
    .single();

  if (upsertErr) {
    console.error(`[generateSafetyCriticalBlock] Upsert en échec (${countryCode} - ${blockType}):`, upsertErr.message);
  }

  if (jobId) {
    await supabase
      .from('ai_jobs')
      .update({
        status: isDegraded ? 'failed' : 'done',
        result: {
          degraded: isDegraded,
          model: modelUsed,
          sources_count: sources.length,
          needs_human_review: true,
        },
        processed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }

  return (saved || payloadToUpsert) as ContentBlockRecord;
}

/**
 * Validation et approbation humaine d'un bloc Tier 1.
 * Pose `reviewed_at = now()`, débloquant instantanément la visibilité publique via RLS.
 */
export async function reviewContentBlock(
  blockId: string,
  reviewerId: string,
  updates: { content_md?: string; notes?: string } = {}
): Promise<{ success: boolean; block?: ContentBlockRecord; error?: string }> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return { success: false, error: 'Client Supabase indisponible' };
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reviewerId);
  const reviewedBy = isUuid ? reviewerId : null;

  const updateData: Record<string, any> = {
    needs_human_review: false,
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewedBy,
  };

  if (updates.content_md) {
    updateData.content_md = updates.content_md.trim();
  }

  const { data, error } = await supabase
    .from('country_content_blocks')
    .update(updateData)
    .eq('id', blockId)
    .select('*')
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, block: data as ContentBlockRecord };
}

/**
 * Liste des blocs en attente de relecture humaine (filtrable par pays).
 */
export async function getPendingReviews(countryCode?: string): Promise<ContentBlockRecord[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];

  let query = supabase
    .from('country_content_blocks')
    .select('*')
    .eq('needs_human_review', true)
    .is('reviewed_at', null)
    .order('generated_at', { ascending: false });

  if (countryCode) {
    query = query.eq('country_code', countryCode.toUpperCase());
  }

  const { data, error } = await query;
  if (error) {
    console.error('[getPendingReviews] Erreur:', error.message);
    return [];
  }

  return (data || []) as ContentBlockRecord[];
}
