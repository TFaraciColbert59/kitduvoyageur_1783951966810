// src/features/pays/server/paysRecommendations.ts
// Recommandations contextualisées : sélection DÉTERMINISTE sur données réelles
// + synthèse IA courte (cache 30 j, fallback silencieux). Jamais d'invention.
import 'server-only';
import { fetchCountryByIso, fetchCountryContentByIso } from '@/lib/geodata';
import { createClient } from '@/lib/supabase/server';
import { askAI } from '@/lib/ai/askAI';
import { buildRecommendationPrompt } from '@/lib/ai/features/paysRecommendations';
import {
  DifficulteItemSchema,
  ItineraireItemSchema,
  SpotItemSchema,
} from '@/lib/ai/country-content/contentBlocksTypes';
import { buildRecommendations } from '../recommendations/recommendationEngine';
import { resolveCountryTrails } from './countryTrails';
import type { Recommendation, RecommendationProfile } from '../types';

export interface PaysRecommendationsResult {
  status: 'ok' | 'empty' | 'error';
  countryCode: string;
  profile: RecommendationProfile;
  synthesis: string | null;
  synthesisProvider: 'ai' | 'none';
  recommendations: Recommendation[];
}

async function fetchCountryBlockJson(iso: string): Promise<Record<string, unknown>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('country_content_blocks')
      .select('block_type, content_json')
      .eq('country_code', iso)
      .eq('degraded', false);
    if (error || !Array.isArray(data)) return {};
    const out: Record<string, unknown> = {};
    for (const row of data) {
      if (row?.block_type) out[String(row.block_type)] = row.content_json;
    }
    return out;
  } catch {
    return {};
  }
}

export async function getPaysRecommendations(
  rawIso: string,
  profile: RecommendationProfile
): Promise<PaysRecommendationsResult> {
  const iso = rawIso.trim().toUpperCase();
  const empty = (status: PaysRecommendationsResult['status']): PaysRecommendationsResult => ({
    status,
    countryCode: iso,
    profile,
    synthesis: null,
    synthesisProvider: 'none',
    recommendations: [],
  });

  try {
    const country = await fetchCountryByIso(iso);
    if (!country) return empty('error');

    const [content, blocks, trails] = await Promise.all([
      fetchCountryContentByIso(iso),
      fetchCountryBlockJson(iso),
      resolveCountryTrails(country, 6),
    ]);

    const spots = SpotItemSchema.array().safeParse(blocks.spots_incontournables);
    const itineraires = ItineraireItemSchema.array().safeParse(blocks.itineraires_suggeres);
    const difficulte = DifficulteItemSchema.array().safeParse(blocks.niveau_difficulte);

    const seasonLabel = content?.climat?.meilleure_periode_trek ?? null;

    const recommendations = buildRecommendations(
      {
        countryName: country.name,
        seasonLabel,
        spots: spots.success ? spots.data : [],
        itineraires: itineraires.success ? itineraires.data : [],
        difficulte: difficulte.success ? difficulte.data : [],
        trails,
      },
      profile
    );

    if (recommendations.length === 0) return empty('empty');

    // Synthèse IA courte — jamais bloquante (cache 30 j, fallback silencieux).
    let synthesis: string | null = null;
    let synthesisProvider: PaysRecommendationsResult['synthesisProvider'] = 'none';
    try {
      const { system, prompt } = buildRecommendationPrompt({
        countryName: country.name,
        level: profile.level,
        duration: profile.duration,
        month: profile.month,
        seasonLabel,
        spotTitles: recommendations.filter((r) => r.kind === 'spot').map((r) => r.title),
        itineraryTitles: recommendations.filter((r) => r.kind === 'itineraire').map((r) => r.title),
        trailTitles: recommendations.filter((r) => r.kind === 'trail').map((r) => r.title),
      });
      const response = await askAI({
        feature: 'pays-recommendations',
        tier: 'fast',
        system,
        prompt,
        maxTokens: 220,
      });
      if (!response.degraded && response.text.trim()) {
        synthesis = response.text.trim();
        synthesisProvider = 'ai';
      }
    } catch {
      // silencieux : on garde les recommandations déterministes
    }

    return {
      status: 'ok',
      countryCode: iso,
      profile,
      synthesis,
      synthesisProvider,
      recommendations,
    };
  } catch {
    return empty('error');
  }
}
