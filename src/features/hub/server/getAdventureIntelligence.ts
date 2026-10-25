import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getHubAdventureData, type HubAdventureData } from './getHubAdventureData';
import { currentAdventureFeatureFlags } from '@/features/adventure-intelligence/server/featureFlags';
import {
  createSupabaseTerrainReportsClient,
  listNearbyTerrainReports,
} from '@/features/adventure-intelligence/server/terrainReports';
import {
  buildHubCockpitInput,
  gateHubTerrainReports,
  type HubDecisionRow,
  type HubPlanRow,
  type HubPredictionRow,
} from '@/features/adventure-intelligence/domain/cockpitMounting';
import type { CockpitInput } from '@/features/adventure-intelligence/domain/cockpit';
import type { TerrainLiveReport } from '@/features/terrain-live/lib/terrainDisplay';
import { hubSectionHref, hubSectionRegistry, type HubAdventureRef } from '../registry/hubSectionRegistry';
import type { ActiveAdventureData } from '../context/adventureSchema';
import type { AdventureNature, HubSectionId } from '../engine/hubProfileEngine';

/**
 * A10 (10.11) — Chargeur serveur du montage Adventure Intelligence du hub.
 *
 * Une seule source de vérité : l'aventure active (`getHubAdventureData`, déjà
 * cachée par requête) enrichie des lignes RÉELLES — dernier `adventure_plans`
 * accessible (RLS propriétaire/collaborateur), prédictions `route_predictions`
 * du plan, décisions `proposed`, et conditions Terrain Live proches via le
 * module serveur A5 existant. Zéro fixture, zéro valeur inventée : une donnée
 * absente reste absente ; toute erreur retombe sur un état vide gracieux.
 */

/** Rayon de proximité Terrain Live montré dans le hub (mètres). */
export const HUB_TERRAIN_RADIUS_M = 5000;

export interface HubAdventureQuickLink {
  id: string;
  label: string;
  icon: string;
}

export interface HubAdventureIntelligenceData {
  /** Entrée cockpit réelle (`offline` résolu côté client). */
  cockpit: Omit<CockpitInput, 'offline'>;
  /** Liens rapides réels du registre pour la nature active (jamais inventés). */
  sections: HubAdventureQuickLink[];
  sectionHrefs: Record<string, string>;
  /** Flag `terrain_live` — faux par défaut (aucun flag de domaine activé). */
  terrainEnabled: boolean;
  terrainReports: TerrainLiveReport[];
}

interface QuickLinkConfig {
  id: HubSectionId;
  icon: string;
}

const QUICK_LINKS_BY_NATURE: Record<AdventureNature, QuickLinkConfig[]> = {
  sortie: [
    { id: 'itinerary', icon: 'navigation' },
    { id: 'safety', icon: 'shield-alert' },
    { id: 'checklist', icon: 'check-square' },
    { id: 'journal', icon: 'book-open' },
  ],
  possession: [
    { id: 'kit', icon: 'backpack' },
    { id: 'preparation', icon: 'flask-conical' },
    { id: 'depart', icon: 'footprints' },
    { id: 'oublis', icon: 'clipboard-list' },
  ],
  collectif: [
    { id: 'groupe', icon: 'users' },
    { id: 'invitations', icon: 'mail-plus' },
  ],
};

function emptyIntelligence(): HubAdventureIntelligenceData {
  return {
    cockpit: {
      plan: null,
      prediction: null,
      liveReports: [],
      decisionsRequired: [],
      recalcReasons: [],
    },
    sections: [],
    sectionHrefs: {},
    terrainEnabled: false,
    terrainReports: [],
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function planRowFrom(raw: Record<string, unknown>): HubPlanRow {
  return {
    id: String(raw.id),
    title: stringOrNull(raw.title),
    status: typeof raw.status === 'string' && raw.status.length > 0 ? raw.status : 'draft',
    confidence: raw.confidence ?? null,
    updatedAt: stringOrNull(raw.updated_at),
  };
}

function predictionRowFrom(raw: Record<string, unknown>): HubPredictionRow {
  return {
    strategy: typeof raw.strategy === 'string' ? raw.strategy : '',
    etaP50: stringOrNull(raw.eta_p50),
    etaP90: stringOrNull(raw.eta_p90),
    paceP25: numberOrNull(raw.pace_p25_min_per_km),
    paceP50: numberOrNull(raw.pace_p50_min_per_km),
    paceP75: numberOrNull(raw.pace_p75_min_per_km),
    turnaroundTime: stringOrNull(raw.turnaround_time),
    personalDifficulty: numberOrNull(raw.personal_difficulty),
  };
}

function decisionRowFrom(raw: Record<string, unknown>): HubDecisionRow {
  return {
    id: String(raw.id),
    proposal: typeof raw.proposal === 'string' ? raw.proposal : '',
    requiresConfirmation: raw.requires_confirmation === true,
  };
}

function firstTripCoords(trip: HubAdventureData['trip']): { lat: number; lon: number } | null {
  const step = (trip?.steps ?? []).find((s) => s.latitude != null && s.longitude != null);
  if (!step) return null;
  const lat = Number(step.latitude);
  const lon = Number(step.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

/** Liens rapides + destinations réels, calculés par le registre des sections. */
function buildQuickLinks(adventure: ActiveAdventureData): {
  sections: HubAdventureQuickLink[];
  hrefs: Record<string, string>;
} {
  const ref: HubAdventureRef =
    adventure.nature === 'sortie'
      ? { nature: 'sortie', slug: adventure.slug }
      : { nature: adventure.nature };
  const sections: HubAdventureQuickLink[] = [];
  const hrefs: Record<string, string> = {};

  for (const config of QUICK_LINKS_BY_NATURE[adventure.nature]) {
    const def = hubSectionRegistry.find((section) => section.id === config.id);
    if (!def || !def.natures.includes(adventure.nature)) continue;
    try {
      hrefs[config.id] = hubSectionHref(ref, config.id);
      sections.push({ id: config.id, label: def.label, icon: config.icon });
    } catch (err) {
      console.error('[LKDV hub] quick link error:', err);
    }
  }

  return { sections, hrefs };
}

export async function getAdventureIntelligenceInner(): Promise<HubAdventureIntelligenceData> {
  try {
    const supabase = await createClient();
    const hub = await getHubAdventureData();
    const flags = await currentAdventureFeatureFlags();
    const terrainEnabled = flags.terrain_live === true;
    const quickLinks = buildQuickLinks(hub.adventure);

    let plan: HubPlanRow | null = null;
    let prediction: HubPredictionRow | null = null;
    let decisions: HubDecisionRow[] = [];

    const { data: planRows } = await supabase
      .from('adventure_plans')
      .select('id, title, status, confidence, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1);
    const rawPlan = ((planRows ?? []) as Record<string, unknown>[])[0];
    if (rawPlan) {
      plan = planRowFrom(rawPlan);

      const { data: decisionRows } = await supabase
        .from('adventure_plan_decisions')
        .select('id, proposal, requires_confirmation, status')
        .eq('plan_id', plan.id)
        .eq('status', 'proposed')
        .order('created_at', { ascending: true });
      decisions = ((decisionRows ?? []) as Record<string, unknown>[]).map(decisionRowFrom);

      const { data: predictionRows } = await supabase
        .from('route_predictions')
        .select(
          'strategy, eta_p50, eta_p90, pace_p25_min_per_km, pace_p50_min_per_km, pace_p75_min_per_km, turnaround_time, personal_difficulty, computed_at'
        )
        .eq('plan_id', plan.id)
        .order('computed_at', { ascending: false })
        .limit(1);
      const rawPrediction = ((predictionRows ?? []) as Record<string, unknown>[])[0];
      if (rawPrediction) prediction = predictionRowFrom(rawPrediction);
    }

    // Terrain Live : uniquement si le flag est actif ; aucune requête sinon.
    let terrainReports: TerrainLiveReport[] = [];
    if (terrainEnabled) {
      const coords = hub.hiking?.coords ?? firstTripCoords(hub.trip);
      if (coords) {
        try {
          const nearby = await listNearbyTerrainReports(
            { lat: coords.lat, lng: coords.lon, radiusM: HUB_TERRAIN_RADIUS_M },
            createSupabaseTerrainReportsClient(supabase)
          );
          terrainReports = gateHubTerrainReports(true, nearby);
        } catch (err) {
          console.error('[LKDV hub] terrain live error:', err);
        }
      }
    }

    return {
      cockpit: buildHubCockpitInput({ plan, prediction, decisions, terrainEnabled, terrainReports }),
      sections: quickLinks.sections,
      sectionHrefs: quickLinks.hrefs,
      terrainEnabled,
      terrainReports,
    };
  } catch (err) {
    console.error('[LKDV hub] adventure intelligence error:', err);
    return emptyIntelligence();
  }
}

/** Chargeur unique par requête (layout hub — une seule exécution par rendu). */
export const getAdventureIntelligence = cache(getAdventureIntelligenceInner);
