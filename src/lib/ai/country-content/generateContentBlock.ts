import 'server-only';
import { z } from 'zod';
import { askAI } from '@/lib/ai/askAI';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { getCountryByCode } from '@/lib/countries';
import {
  ContentBlockType,
  BLOCK_TIERS,
  BLOCK_FRESHNESS_DAYS,
  ContentBlockRecord,
  ContentSource,
  FAQItemSchema,
  ItineraireItemSchema,
  PeriodeActiviteItemSchema,
  SpotItemSchema,
  DifficulteItemSchema,
} from './contentBlocksTypes';

// Configurations éditoriales ciblées pour les Tiers 2 & 3
const BLOCK_PROMPT_CONFIG: Record<
  Exclude<ContentBlockType, 'formalites' | 'securite_alertes' | 'recommandations_kit'>,
  { label: string; details: string; jsonType?: string }
> = {
  // Tier 2
  transport: {
    label: 'Transports & Mobilité',
    details: 'réseau intérieur (trains, bus, pistes), location de véhicule, permis international, état des routes et spécificités de mobilité pour marcheurs',
  },
  budget: {
    label: 'Budget & Moyens de paiement',
    details: 'fourchettes quotidiennes réelles (repas, nuitées, transport), monnaie officielle, acceptation espèces vs carte, distributeurs et pourboires',
  },
  sante: {
    label: 'Santé & Précautions',
    details: 'potabilité de l\'eau, filtration requise, pharmacie de rando recommandée, infrastructures de soins et risques sanitaires (altitude, faune, climat)',
  },
  etiquette: {
    label: 'Étiquette culturelle & Nature',
    details: 'règles de savoir-vivre, tenues appropriées, respect des lieux sacrés et principes "Leave No Trace" pour les espaces naturels',
  },
  // Tier 3
  vue_ensemble: {
    label: 'Vue d\'ensemble & Identité Outdoor',
    details: '2-3 paragraphes immersifs sur l\'identité géographique du pays, sa singularité géologique, sa nature préservée et sa vocation pour l\'aventure outdoor',
  },
  meilleure_periode_activite: {
    label: 'Meilleure période par activité',
    details: 'fenêtres météo distinctes par activité outdoor (trekking, haute montagne, sports d\'eau/côte, observation nature)',
    jsonType: 'periode_activite',
  },
  itineraires_suggeres: {
    label: 'Itinéraires outdoor suggérés',
    details: '2 ou 3 propositions d\'itinéraires outdoor concrètes (durée en jours, dénivelé approximatif, niveau, description vivante et étapes clés)',
    jsonType: 'itineraires',
  },
  spots_incontournables: {
    label: 'Spots d\'aventure incontournables',
    details: 'sélection qualitative de 3 à 5 spots naturels emblématiques (parcs naturels, massifs, vallées, fjords ou côtes sauvages) avec intérêt outdoor',
    jsonType: 'spots',
  },
  niveau_difficulte: {
    label: 'Niveau d\'engagement & Difficulté',
    details: 'évaluation de l\'engagement physique et technique selon les terrains (dénivelé, climat, isolement, secours) avec conseils de préparation',
    jsonType: 'difficulte',
  },
  faq: {
    label: 'Foire aux Questions Voyageur Outdoor',
    details: '5 à 7 questions-réponses très concrètes et spécifiques que se posent les marcheurs autonomes avant de partir dans ce pays',
    jsonType: 'faq',
  },
};

export function buildContentPrompt(
  blockType: ContentBlockType,
  countryName: string,
  countryCode: string,
  currentYear = new Date().getFullYear()
): { system: string; prompt: string } {
  const cfg = BLOCK_PROMPT_CONFIG[blockType as keyof typeof BLOCK_PROMPT_CONFIG];
  if (!cfg) {
    throw new Error(`[buildContentPrompt] Type de bloc non géré par ce builder: ${blockType}`);
  }

  let jsonInstruction = '';
  if (cfg.jsonType === 'faq') {
    jsonInstruction = `Dans content_json, fournis un tableau de 5 à 7 objets : [{"question": "...", "reponse": "..."}].`;
  } else if (cfg.jsonType === 'itineraires') {
    jsonInstruction = `Dans content_json, fournis un tableau de 2 ou 3 objets : [{"nom": "...", "duree_jours": 4, "denivele_positif_m": 1200, "difficulte": "Modéré", "description": "...", "etapes": ["Jour 1 : ...", "Jour 2 : ..."]}].`;
  } else if (cfg.jsonType === 'periode_activite') {
    jsonInstruction = `Dans content_json, fournis un tableau de 3 à 4 activités : [{"activite": "Trek & Randonnée", "mois_favorables": "Mai à Octobre", "conditions": "...", "points_vigilance": "..."}].`;
  } else if (cfg.jsonType === 'spots') {
    jsonInstruction = `Dans content_json, fournis un tableau de 3 à 5 spots : [{"nom": "...", "localisation": "...", "type_outdoor": "Trek / Parc naturel", "description": "..."}].`;
  } else if (cfg.jsonType === 'difficulte') {
    jsonInstruction = `Dans content_json, fournis un tableau : [{"activite": "Randonnée côtière", "niveau": "Modéré", "facteurs": "Sentiers rocailleux et dénivelés côtiers", "conseils": "Chaussures avec bonne adhérence"}].`;
  } else {
    jsonInstruction = `content_json peut être null.`;
  }

  const system = `Tu es l'expert éditorial et guide de terrain outdoor pour "Le Kit du Voyageur" (LKDV).
Tu rédiges le bloc "${cfg.label}" pour le pays ${countryName} (${countryCode}) en ${currentYear}.
Angle : voyageur autonome, randonnée, bivouac et aventure outdoor. Informations factuelles, vérifiées et récentes (${cfg.details}).
Format de sortie OBLIGATOIRE : JSON strict valide avec guillemets doubles.
Format attendu :
{
  "content_md": "Texte synthétique et engageant rédigé en français avec mise en valeur en gras **...** (80 à 180 mots). Pas de préambule, pas de titre H1/H2.",
  "content_json": ${cfg.jsonType ? '[...]' : 'null'},
  "sources": [{"title": "Nom de la source officielle ou guide", "url": "https://..."}]
}
${jsonInstruction}`;

  const prompt = `Rédige le contenu pour ${countryName} (${countryCode}) sur le bloc : ${cfg.label}. Respecte scrupuleusement le format JSON strict attendu.`;

  return { system, prompt };
}

export function parseContentBlockResponse(
  rawText: string,
  blockType: ContentBlockType
): { content_md: string; content_json: any; sources: ContentSource[] } | null {
  try {
    let clean = rawText.trim();
    const match = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      clean = match[1].trim();
    } else {
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.slice(firstBrace, lastBrace + 1);
      }
    }

    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(clean);
    } catch {
      // Tentative de réparation basique
      const repaired = clean
        .replace(/:\s*'([^']*)'/g, ': "$1"')
        .replace(/['"]\s*([,\}])/g, '"$1')
        .replace(/'\s*\n\s*}/g, '"\n}');
      try {
        parsedJson = JSON.parse(repaired);
      } catch {
        // Extraction regex du content_md si le JSON racine est irrécupérable
        const mdMatch = clean.match(/"content_md"\s*:\s*"([\s\S]*?)(?<!\\)"/);
        if (mdMatch && mdMatch[1].trim().length >= 20) {
          const unescaped = mdMatch[1]
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .trim();
          return { content_md: unescaped, content_json: null, sources: [] };
        }
      }
    }

    if (!parsedJson || typeof parsedJson.content_md !== 'string' || parsedJson.content_md.trim().length < 20) {
      return null;
    }

    const content_md = parsedJson.content_md.trim();
    let content_json = parsedJson.content_json || null;
    const rawSources = Array.isArray(parsedJson.sources) ? parsedJson.sources : [];

    const sources: ContentSource[] = rawSources
      .filter((s: any) => s && typeof s.title === 'string')
      .map((s: any) => ({
        title: s.title.trim(),
        url: typeof s.url === 'string' && s.url.startsWith('http') ? s.url : 'https://www.diplomatie.gouv.fr',
      }));

    // Validation légère des structures JSON selon le bloc
    if (content_json && Array.isArray(content_json)) {
      if (blockType === 'faq') {
        content_json = content_json.filter((item: any) => FAQItemSchema.safeParse(item).success);
      } else if (blockType === 'itineraires_suggeres') {
        content_json = content_json.filter((item: any) => ItineraireItemSchema.safeParse(item).success);
      } else if (blockType === 'meilleure_periode_activite') {
        content_json = content_json.filter((item: any) => PeriodeActiviteItemSchema.safeParse(item).success);
      } else if (blockType === 'spots_incontournables') {
        content_json = content_json.filter((item: any) => SpotItemSchema.safeParse(item).success);
      } else if (blockType === 'niveau_difficulte') {
        content_json = content_json.filter((item: any) => DifficulteItemSchema.safeParse(item).success);
      }
    }

    return { content_md, content_json, sources };
  } catch {
    return null;
  }
}

export async function generateContentBlock(
  rawCountryCode: string,
  blockType: ContentBlockType,
  options: { force?: boolean } = {}
): Promise<ContentBlockRecord> {
  const countryCode = rawCountryCode.trim().toUpperCase();
  const tier = BLOCK_TIERS[blockType];
  const freshnessDays = BLOCK_FRESHNESS_DAYS[blockType];
  const supabase = getServiceSupabase();

  if (!supabase) {
    throw new Error('[generateContentBlock] Client service Supabase indisponible');
  }

  // 1. Résolution du nom de pays
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

  // 2. Vérification cache existant
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

  // 3. Journalisation du job
  const { data: jobEntry } = await supabase
    .from('ai_jobs')
    .insert({
      feature: 'country-practical-guide',
      payload: { country_code: countryCode, block_type: blockType, tier },
      status: 'processing',
    })
    .select('id')
    .single();
  const jobId = jobEntry?.id;

  // 4. Construction et appel IA
  const { system, prompt } = buildContentPrompt(blockType, countryName, countryCode);
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
    });
    responseText = aiRes.text;
    modelUsed = aiRes.model || modelUsed;
    isDegraded = aiRes.degraded;
  } catch (err) {
    console.error(`[generateContentBlock] askAI en échec (${countryCode} - ${blockType}):`, err);
    isDegraded = true;
  }

  // 5. Parsing du bloc
  const parsed = parseContentBlockResponse(responseText, blockType);
  let contentMd = '';
  let contentJson: any = null;
  let sources: ContentSource[] = [];

  if (parsed && !isDegraded) {
    contentMd = parsed.content_md;
    contentJson = parsed.content_json;
    sources = parsed.sources;
  } else {
    isDegraded = true;
    contentMd = `Contenu pour ${countryName} (${blockType}) en cours de consolidation auprès des sources terrain.`;
    contentJson = null;
    sources = [];
  }

  const generatedAt = new Date().toISOString();
  const staleAfter = new Date(Date.now() + freshnessDays * 86400 * 1000).toISOString();

  // Tier 1 requiert une review humaine, Tier 2 et 3 sont auto-publiés
  const needsHumanReview = tier === 1;
  const reviewedAt = tier === 1 ? null : generatedAt;

  const payloadToUpsert = {
    country_code: countryCode,
    block_type: blockType,
    tier,
    content_md: contentMd,
    content_json: contentJson,
    sources,
    model_used: modelUsed,
    generated_at: generatedAt,
    stale_after: staleAfter,
    degraded: isDegraded,
    needs_human_review: needsHumanReview,
    reviewed_at: reviewedAt,
  };

  const { data: saved, error: upsertErr } = await supabase
    .from('country_content_blocks')
    .upsert(payloadToUpsert, { onConflict: 'country_code,block_type' })
    .select('*')
    .single();

  if (upsertErr) {
    console.error(`[generateContentBlock] Upsert en échec (${countryCode} - ${blockType}):`, upsertErr.message);
  }

  if (jobId) {
    await supabase
      .from('ai_jobs')
      .update({
        status: isDegraded ? 'failed' : 'done',
        result: { degraded: isDegraded, model: modelUsed, sources_count: sources.length },
        processed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }

  return (saved || payloadToUpsert) as ContentBlockRecord;
}

export async function generateCountryTiers2And3(
  countryCode: string,
  options: { force?: boolean } = {}
): Promise<{
  country_code: string;
  results: Partial<Record<ContentBlockType, ContentBlockRecord>>;
  successCount: number;
  degradedCount: number;
}> {
  const targetBlocks: ContentBlockType[] = [
    // Tier 2
    'transport',
    'budget',
    'sante',
    'etiquette',
    // Tier 3
    'vue_ensemble',
    'meilleure_periode_activite',
    'itineraires_suggeres',
    'spots_incontournables',
    'niveau_difficulte',
    'faq',
  ];

  const results: Partial<Record<ContentBlockType, ContentBlockRecord>> = {};
  let successCount = 0;
  let degradedCount = 0;

  for (const bType of targetBlocks) {
    const res = await generateContentBlock(countryCode, bType, options);
    results[bType] = res;
    if (res.degraded) {
      degradedCount++;
    } else {
      successCount++;
    }
    // Espacement poli pour OpenRouter rate limit
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  return { country_code: countryCode, results, successCount, degradedCount };
}
