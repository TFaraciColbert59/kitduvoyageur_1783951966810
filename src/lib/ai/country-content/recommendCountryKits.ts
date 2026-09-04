import 'server-only';
import { askAI } from '@/lib/ai/askAI';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { getCountryByCode } from '@/lib/countries';
import {
  ContentBlockRecord,
  KitRecommendationItem,
  KitRecommendationItemSchema,
  BLOCK_FRESHNESS_DAYS,
} from './contentBlocksTypes';

interface RealKitRow {
  id: string;
  slug: string;
  nom: string;
  description: string;
  destination: string;
  activite: string;
  saison: string;
  prix_cents: number;
  poids_total_g: number;
  kit_items?: Array<{ nom: string; categorie: string; essentiel: boolean }>;
}

export async function generateCountryKitRecommendation(
  rawCountryCode: string,
  options: { force?: boolean } = {}
): Promise<ContentBlockRecord> {
  const countryCode = rawCountryCode.trim().toUpperCase();
  const freshnessDays = BLOCK_FRESHNESS_DAYS.recommandations_kit;
  const supabase = getServiceSupabase();

  if (!supabase) {
    throw new Error('[generateCountryKitRecommendation] Client service Supabase indisponible');
  }

  // 1. Pays
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

  // 2. Cache
  if (!options.force) {
    const { data: existing } = await supabase
      .from('country_content_blocks')
      .select('*')
      .eq('country_code', countryCode)
      .eq('block_type', 'recommandations_kit')
      .maybeSingle();

    if (existing && !existing.degraded) {
      const isFresh = new Date(existing.stale_after).getTime() > Date.now();
      if (isFresh) {
        return existing as ContentBlockRecord;
      }
    }
  }

  // 3. Récupération des VRAIS kits depuis public.kits
  const { data: kitsData, error: kitsErr } = await supabase
    .from('kits')
    .select(`
      id,
      slug,
      nom,
      description,
      destination,
      activite,
      saison,
      prix_cents,
      poids_total_g,
      kit_items ( nom, categorie, essentiel )
    `)
    .limit(10);

  if (kitsErr || !kitsData || kitsData.length === 0) {
    console.error('[generateCountryKitRecommendation] Aucun kit disponible en base:', kitsErr?.message);
    const fallbackBlock: ContentBlockRecord = {
      country_code: countryCode,
      block_type: 'recommandations_kit',
      tier: 4,
      content_md: `Consultez notre configurateur sur-mesure pour équiper votre voyage en ${countryName}.`,
      content_json: null,
      sources: [],
      model_used: 'fallback-deterministe',
      generated_at: new Date().toISOString(),
      stale_after: new Date(Date.now() + freshnessDays * 86400 * 1000).toISOString(),
      degraded: true,
      needs_human_review: false,
      reviewed_at: new Date().toISOString(),
      reviewed_by: null,
    };
    return fallbackBlock;
  }

  const realKits = kitsData as unknown as RealKitRow[];

  // Synthèse du catalogue réel pour le prompt
  const kitsSummary = realKits.map((k) => ({
    id: k.id,
    slug: k.slug,
    nom: k.nom,
    prix_eur: Math.round(k.prix_cents / 100),
    poids_g: k.poids_total_g,
    activite: k.activite,
    saison: k.saison,
    items_principaux: (k.kit_items || [])
      .filter((it) => it.essentiel)
      .map((it) => it.nom)
      .slice(0, 5),
  }));

  const system = `Tu es l'ingénieur équipement et bivouac de "Le Kit du Voyageur" (LKDV).
Tu dois recommander les kits de notre catalogue réel les plus pertinents pour un voyage outdoor en ${countryName} (${countryCode}).
RÈGLE ABSOLUE ANTI-HALLUCINATION :
- Tu ne dois JAMAIS inventer un kit ou un produit.
- Tu DOIS choisir UNIQUEMENT parmi les kits fournis ci-dessous dans la liste "CATALOGUE_LKDV_REEL".
- Tu rédiges un argumentaire technique précis justifiant pourquoi cet équipement est parfait pour la géographie et les conditions météo de ${countryName}.

CATALOGUE_LKDV_REEL :
${JSON.stringify(kitsSummary, null, 2)}

Format de sortie OBLIGATOIRE : JSON strict valide :
{
  "content_md": "Synthèse engageante (60 à 100 mots) sur les impératifs matériels pour ${countryName} (chaleur, humidité, roche, portage, autonomie). Ne pas mentionner de faux produits.",
  "content_json": [
    {
      "kit_id": "UUID_REEL_COPIE_DU_CATALOGUE",
      "kit_slug": "SLUG_REEL_COPIE_DU_CATALOGUE",
      "kit_nom": "NOM_REEL",
      "prix_eur": 123,
      "poids_g": 3500,
      "argumentaire": "Explication de 25 à 45 mots démontrant la pertinence pour le terrain de ce pays.",
      "equipements_clefs": ["Nom réel 1", "Nom réel 2", "Nom réel 3"]
    }
  ],
  "sources": []
}`;

  const prompt = `Sélectionne 1 ou 2 kits idéaux dans le catalogue réel pour ${countryName} et explique pourquoi ils conviennent aux randonneurs et voyageurs dans cette destination.`;

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
    console.error(`[generateCountryKitRecommendation] askAI en échec (${countryCode}):`, err);
    isDegraded = true;
  }

  let contentMd = '';
  let contentJson: KitRecommendationItem[] | null = null;

  if (!isDegraded && responseText) {
    try {
      let clean = responseText.trim();
      const match = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) clean = match[1].trim();
      const parsed = JSON.parse(clean);

      if (parsed && typeof parsed.content_md === 'string') {
        contentMd = parsed.content_md;
      }

      if (Array.isArray(parsed.content_json)) {
        // Validation stricte : chaque kit recommandé DOIT exister dans notre catalogue réel
        const validRecommendations: KitRecommendationItem[] = [];
        for (const item of parsed.content_json) {
          const validated = KitRecommendationItemSchema.safeParse(item);
          if (validated.success) {
            const matchingRealKit = realKits.find(
              (rk) => rk.slug === validated.data.kit_slug || rk.id === validated.data.kit_id
            );
            if (matchingRealKit) {
              validRecommendations.push({
                kit_id: matchingRealKit.id,
                kit_slug: matchingRealKit.slug,
                kit_nom: matchingRealKit.nom,
                prix_eur: Math.round(matchingRealKit.prix_cents / 100),
                poids_g: matchingRealKit.poids_total_g,
                argumentaire: validated.data.argumentaire,
                equipements_clefs: validated.data.equipements_clefs,
              });
            }
          }
        }
        if (validRecommendations.length > 0) {
          contentJson = validRecommendations;
        }
      }
    } catch {
      isDegraded = true;
    }
  }

  if (!contentJson || contentJson.length === 0) {
    // Fallback déterministe utilisant le premier kit réel
    const fallbackKit = realKits[0];
    contentMd = `Pour explorer ${countryName} en toute autonomie, un équipement fiable et éprouvé est indispensable. Découvrez notre sélection pour préparer votre sac.`;
    contentJson = [
      {
        kit_id: fallbackKit.id,
        kit_slug: fallbackKit.slug,
        kit_nom: fallbackKit.nom,
        prix_eur: Math.round(fallbackKit.prix_cents / 100),
        poids_g: fallbackKit.poids_total_g,
        argumentaire: `Sélection polyvalente optimisée pour les itinéraires de randonnée et bivouac en autonomie modérée.`,
        equipements_clefs: (fallbackKit.kit_items || [])
          .filter((it) => it.essentiel)
          .slice(0, 3)
          .map((it) => it.nom),
      },
    ];
  }

  const generatedAt = new Date().toISOString();
  const staleAfter = new Date(Date.now() + freshnessDays * 86400 * 1000).toISOString();

  const payloadToUpsert = {
    country_code: countryCode,
    block_type: 'recommandations_kit' as const,
    tier: 4 as const,
    content_md: contentMd,
    content_json: contentJson,
    sources: [],
    model_used: modelUsed,
    generated_at: generatedAt,
    stale_after: staleAfter,
    degraded: isDegraded,
    needs_human_review: false,
    reviewed_at: generatedAt,
    reviewed_by: null,
  };

  const { data: saved, error: upsertErr } = await supabase
    .from('country_content_blocks')
    .upsert(payloadToUpsert, { onConflict: 'country_code,block_type' })
    .select('*')
    .single();

  if (upsertErr) {
    console.error(`[generateCountryKitRecommendation] Upsert en échec (${countryCode}):`, upsertErr.message);
  }

  return (saved || payloadToUpsert) as ContentBlockRecord;
}
