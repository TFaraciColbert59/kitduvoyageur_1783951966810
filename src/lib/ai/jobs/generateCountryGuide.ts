import 'server-only';
import { z } from 'zod';
import { askAI } from '@/lib/ai/askAI';
import { getServiceSupabase } from '@/lib/ai/serviceClient';
import { getCountryByCode } from '@/lib/countries';

export const PRACTICAL_SECTIONS = [
  'formalites',
  'transport',
  'budget',
  'sante',
  'securite',
  'meilleure_saison',
] as const;

export type PracticalSection = (typeof PRACTICAL_SECTIONS)[number];

export const SECTION_FRESHNESS_DAYS: Record<PracticalSection, number> = {
  formalites: 30,
  securite: 30,
  transport: 90,
  budget: 90,
  sante: 90,
  meilleure_saison: 365,
};

export interface GuideSource {
  title: string;
  url: string;
}

export interface PracticalSectionResult {
  country_code: string;
  section: PracticalSection;
  content_md: string;
  sources: GuideSource[];
  model_used: string;
  generated_at: string;
  stale_after: string;
  degraded: boolean;
}

const SECTION_CONFIG: Record<PracticalSection, { label: string; details: string }> = {
  formalites: {
    label: "Formalités d'entrée & Visa",
    details: "visa, passeport (validité minimale requise), démarches consulaires, vaccins ou formulaires obligatoires, et durée de séjour autorisée",
  },
  transport: {
    label: "Transports & Mobilité",
    details: "moyens de transport intérieurs (trains, bus, liaisons aériennes), location de véhicule, permis de conduire international et état des routes",
  },
  budget: {
    label: "Budget & Moyens de paiement",
    details: "fourchette de dépenses quotidiennes moyennes (repas, hébergement), monnaie locale, acceptation carte bancaire vs espèces, distributeurs et pourboires",
  },
  sante: {
    label: "Santé & Recommandations",
    details: "vaccinations recommandées, potabilité de l'eau du robinet, infrastructures de soins, risques sanitaires locaux (maladies vectorielles, altitude) et assurance",
  },
  securite: {
    label: "Sécurité & Terrain",
    details: "niveau général de vigilance, zones déconseillées ou sensibles, arnaques fréquentes, risques naturels ou faune, et numéros d'urgence locaux",
  },
  meilleure_saison: {
    label: "Climat & Meilleure saison",
    details: "périodes idéales pour les activités outdoor et trekking, saisons des pluies ou canicules, températures moyennes selon les saisons",
  },
};

export function buildSectionPrompt(
  section: PracticalSection,
  countryName: string,
  countryCode: string,
  currentYear = new Date().getFullYear()
): { system: string; prompt: string } {
  const config = SECTION_CONFIG[section];

  const system = `Tu rédiges la section "${config.label}" du guide pratique du pays ${countryName} (${countryCode}) pour des voyageurs francophones en ${currentYear}.
Utilise uniquement des informations vérifiables et récentes (${config.details}).
Si une information n'est pas trouvée avec certitude, écris explicitement "à vérifier auprès de l'ambassade" plutôt que d'inventer.
Format de sortie : JSON strict avec guillemets doubles valides : {"content_md": "...", "sources": [{"title": "...", "url": "..."}]}
Longueur : 80-150 mots. Pas de préambule, pas de markdown de titre (le titre est géré par l'UI).`;

  const prompt = `Rédige les informations pratiques actualisées pour ${countryName} (${countryCode}) sur la section : ${config.label}. Respecte scrupuleusement le format JSON strict attendu avec guillemets doubles valides.`;

  return { system, prompt };
}

const OutputSchema = z.object({
  content_md: z.string().min(20),
  sources: z
    .array(
      z.object({
        title: z.string().min(1),
        url: z.string().url().catch('https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/'),
      })
    )
    .default([]),
});

export function parseSectionResponse(rawText: string): { content_md: string; sources: GuideSource[] } | null {
  try {
    let clean = rawText.trim();
    // Nettoyage des blocs de code markdown (```json ... ``` ou ``` ... ```)
    const match = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      clean = match[1].trim();
    } else {
      // Tenter d'extraire le premier objet JSON équilibré
      const firstBrace = clean.indexOf('{');
      const lastBrace = clean.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        clean = clean.slice(firstBrace, lastBrace + 1);
      }
    }

    // 1. Essai direct JSON.parse
    try {
      const json = JSON.parse(clean);
      const parsed = OutputSchema.safeParse(json);
      if (parsed.success) {
        return {
          content_md: parsed.data.content_md.trim(),
          sources: parsed.data.sources,
        };
      }
    } catch {
      // Si échec (ex. guillemet mal fermé ou apostrophe ' au lieu de "), tentative de réparation
      const repaired = clean
        .replace(/:\s*'([^']*)'/g, ': "$1"')
        .replace(/['"]\s*([,\}])/g, '"$1')
        .replace(/'\s*\n\s*}/g, '"\n}');

      try {
        const json2 = JSON.parse(repaired);
        const parsed2 = OutputSchema.safeParse(json2);
        if (parsed2.success) {
          return {
            content_md: parsed2.data.content_md.trim(),
            sources: parsed2.data.sources,
          };
        }
      } catch {
        // 2. Extraction par regex du content_md si le JSON est corrompu mais le contenu présent
        const contentMatch = clean.match(/"content_md"\s*:\s*"([\s\S]*?)(?<!\\)"/);
        if (contentMatch && contentMatch[1].trim().length >= 20) {
          const unescaped = contentMatch[1]
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\\\/g, '\\')
            .trim();
          return {
            content_md: unescaped,
            sources: [],
          };
        }
      }
    }
  } catch {
    // Fallback défensif
  }
  return null;
}

export async function generateSectionGuide(
  rawCountryCode: string,
  section: PracticalSection,
  options: { force?: boolean } = {}
): Promise<PracticalSectionResult> {
  const countryCode = rawCountryCode.trim().toUpperCase();
  const supabase = getServiceSupabase();

  if (!supabase) {
    throw new Error('[generateCountryGuide] Client service Supabase indisponible');
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
    if (geoCountry?.name) {
      countryName = geoCountry.name;
    }
  }

  // 2. Vérifier si une version non-périmée existe déjà en cache
  if (!options.force) {
    const { data: existing } = await supabase
      .from('country_practical_guides')
      .select('*')
      .eq('country_code', countryCode)
      .eq('section', section)
      .maybeSingle();

    if (existing && !existing.degraded) {
      const isFresh = new Date(existing.stale_after).getTime() > Date.now();
      if (isFresh) {
        return existing as PracticalSectionResult;
      }
    }
  }

  // 3. Traçabilité : enregistrement du job dans ai_jobs
  const { data: jobEntry } = await supabase
    .from('ai_jobs')
    .insert({
      feature: 'country-practical-guide',
      payload: { country_code: countryCode, section },
      status: 'processing',
    })
    .select('id')
    .single();

  const jobId = jobEntry?.id;

  // 4. Génération IA via askAI (mode fast obligatoire)
  const { system, prompt } = buildSectionPrompt(section, countryName, countryCode);

  let responseText = '';
  let modelUsed = 'nvidia/nemotron-3.5-lightning:free';
  let isDegraded = false;

  try {
    const aiRes = await askAI({
      feature: 'country-practical-guide',
      tier: 'fast',
      system,
      prompt,
      maxTokens: 768,
      cacheTtlSeconds: SECTION_FRESHNESS_DAYS[section] * 86400,
    });

    responseText = aiRes.text;
    modelUsed = aiRes.model || modelUsed;
    isDegraded = aiRes.degraded;
  } catch (err) {
    console.error(`[generateCountryGuide] Erreur askAI (${countryCode} - ${section}):`, err);
    isDegraded = true;
  }

  // 5. Parsing défensif du résultat JSON
  const parsed = parseSectionResponse(responseText);
  let contentMd = '';
  let sources: GuideSource[] = [];

  if (parsed && !isDegraded) {
    contentMd = parsed.content_md;
    sources = parsed.sources;
  } else {
    isDegraded = true;
    contentMd = `Informations pratiques pour ${countryName} en cours d'actualisation. Merci de consulter les services consulaires et sources officielles.`;
    sources = [];
  }

  const generatedAt = new Date().toISOString();
  const staleAfter = new Date(
    Date.now() + SECTION_FRESHNESS_DAYS[section] * 86400 * 1000
  ).toISOString();

  // 6. Upsert dans country_practical_guides
  const payloadToUpsert = {
    country_code: countryCode,
    section,
    content_md: contentMd,
    sources,
    model_used: modelUsed,
    generated_at: generatedAt,
    stale_after: staleAfter,
    degraded: isDegraded,
  };

  const { data: saved, error: upsertErr } = await supabase
    .from('country_practical_guides')
    .upsert(payloadToUpsert, { onConflict: 'country_code,section' })
    .select('*')
    .single();

  if (upsertErr) {
    console.error(`[generateCountryGuide] Échec upsert (${countryCode} - ${section}):`, upsertErr.message);
  }

  // 7. Mise à jour de l'état du job dans ai_jobs
  if (jobId) {
    await supabase
      .from('ai_jobs')
      .update({
        status: isDegraded ? 'failed' : 'done',
        result: {
          degraded: isDegraded,
          model: modelUsed,
          sources_count: sources.length,
        },
        processed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }

  return (saved || payloadToUpsert) as PracticalSectionResult;
}

export async function generateCountryFullGuide(
  rawCountryCode: string,
  options: { force?: boolean } = {}
): Promise<{
  country_code: string;
  results: Record<PracticalSection, PracticalSectionResult>;
  successCount: number;
  degradedCount: number;
}> {
  const countryCode = rawCountryCode.trim().toUpperCase();
  const results = {} as Record<PracticalSection, PracticalSectionResult>;
  let successCount = 0;
  let degradedCount = 0;

  for (const section of PRACTICAL_SECTIONS) {
    const res = await generateSectionGuide(countryCode, section, options);
    results[section] = res;
    if (res.degraded) {
      degradedCount++;
    } else {
      successCount++;
    }
    // Espacement poli pour respecter les limites de débit OpenRouter
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  return {
    country_code: countryCode,
    results,
    successCount,
    degradedCount,
  };
}

export interface RefreshPracticalGuidesOptions {
  countries?: string[];
  limitCountries?: number;
  force?: boolean;
}

export interface RefreshPracticalGuidesResult {
  processedCountries: string[];
  refreshedSections: number;
  skippedSections: number;
  degradedSections: number;
}

export async function refreshStalePracticalGuides(
  options: RefreshPracticalGuidesOptions = {}
): Promise<RefreshPracticalGuidesResult> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error('[refreshStalePracticalGuides] Client service Supabase indisponible');
  }

  const limitCountries = Math.min(options.limitCountries ?? 10, 10);
  let targetCountries: string[] = [];

  if (options.countries && options.countries.length > 0) {
    targetCountries = options.countries
      .map((c) => c.trim().toUpperCase())
      .slice(0, limitCountries);
  } else {
    // 1. Chercher les pays ayant des sections expirées ou dégradées
    const now = new Date().toISOString();
    const { data: staleRows } = await supabase
      .from('country_practical_guides')
      .select('country_code')
      .or(`stale_after.lt.${now},degraded.eq.true`)
      .limit(50);

    const staleCountryCodes = new Set<string>(
      (staleRows || []).map((r: { country_code: string }) => r.country_code)
    );

    // 2. Chercher les pays de countries_geo n'ayant pas encore toutes leurs sections
    if (staleCountryCodes.size < limitCountries) {
      const { data: geoCountries } = await supabase
        .from('countries_geo')
        .select('iso_a2')
        .not('iso_a2', 'is', null)
        .limit(200);

      const allGeoCodes = (geoCountries || [])
        .map((g: { iso_a2: string }) => g.iso_a2)
        .filter(Boolean);

      for (const code of allGeoCodes) {
        if (staleCountryCodes.size >= limitCountries) break;
        staleCountryCodes.add(code);
      }
    }

    targetCountries = Array.from(staleCountryCodes).slice(0, limitCountries);
  }

  const result: RefreshPracticalGuidesResult = {
    processedCountries: targetCountries,
    refreshedSections: 0,
    skippedSections: 0,
    degradedSections: 0,
  };

  for (const countryCode of targetCountries) {
    for (const section of PRACTICAL_SECTIONS) {
      if (!options.force) {
        const { data: existing } = await supabase
          .from('country_practical_guides')
          .select('stale_after, degraded')
          .eq('country_code', countryCode)
          .eq('section', section)
          .maybeSingle();

        if (existing && !existing.degraded) {
          const isFresh = new Date(existing.stale_after).getTime() > Date.now();
          if (isFresh) {
            result.skippedSections++;
            continue;
          }
        }
      }

      const secRes = await generateSectionGuide(countryCode, section, {
        force: options.force,
      });

      if (secRes.degraded) {
        result.degradedSections++;
      } else {
        result.refreshedSections++;
      }

      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }

  return result;
}

