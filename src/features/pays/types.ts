// src/features/pays/types.ts
import type { ContentBlockType } from '@/lib/ai/country-content/contentBlocksTypes';

/** Les 4 sections prioritaires de la page Pays. */
export type PaysSectionId = 'presentation' | 'destinations' | 'activites' | 'culture';

export interface PaysSectionDef {
  id: PaysSectionId;
  label: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Blocs IA pays affichés dans cette section (source `country_content_blocks`). */
  blockTypes: ContentBlockType[];
  /** Fournisseur partenaire éventuel (cartes externes). */
  partner?: 'viator';
}

export interface SectionBlockSource {
  title: string;
  url: string;
}

export interface SectionBlock {
  type: ContentBlockType;
  /** Libellé affiché (sinon libellé par défaut du type). */
  label?: string;
  /** Origine du bloc : blocs IA (country_content_blocks) ou éditorial Supabase. */
  source?: 'ai' | 'editorial';
  contentMd: string;
  contentJson: unknown;
  sources: SectionBlockSource[];
  generatedAt: string | null;
  reviewedAt: string | null;
  staleAfter: string | null;
}

export interface SectionContent {
  sectionId: PaysSectionId;
  blocks: SectionBlock[];
  hasContent: boolean;
}

/** Sentier réel du pays (bbox). */
export interface PaysTrail {
  id: string;
  name: string;
  distanceKm: number | null;
  durationHours: number | null;
  difficulty: string | null;
  elevationGain: number | null;
  latitude: number | null;
  longitude: number | null;
}

export type RecommendationLevel = 'facile' | 'modere' | 'expert';
export type RecommendationDuration = 'weekend' | 'semaine' | 'expedition';

export interface RecommendationProfile {
  level: RecommendationLevel;
  duration: RecommendationDuration;
  /** Mois courant (1–12). */
  month: number;
}

export interface Recommendation {
  kind: 'spot' | 'itineraire' | 'trail' | 'season';
  title: string;
  reason: string;
  meta?: string;
}
