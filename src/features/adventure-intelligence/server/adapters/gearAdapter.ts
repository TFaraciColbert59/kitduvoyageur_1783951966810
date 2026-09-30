/**
 * A6 — Adaptateur équipement : `contextualKitEngine.generateTripContextualKit`.
 *
 * Le moteur existant applique ses règles contextuelles (pays, saison, durée)
 * sans inventer d'inventaire : l'absence d'inventaire utilisateur est déclarée
 * en warning et en hypothèse.
 */
import 'server-only';
import {
  generateTripContextualKit,
  type ContextualKitInput,
} from '@/features/trips/engine/contextualKitEngine';
import type { TripKitAnalysis } from '@/features/trips/types/kit.types';
import { makeConfidence } from '@/features/adventure-intelligence/domain/confidence';
import {
  makeEngineResult,
  type AdventureEngine,
  type Assumption,
  type EngineWarning,
} from '@/features/adventure-intelligence/domain/engine';
import { EngineSkipSignal } from '@/features/adventure-intelligence/domain/engineRegistry';
import type { RouteAdapterOutput } from './routeAdapter';
import { ADAPTER_VERSION } from './adapterSupport';
import {
  inventoryToKitItems,
  summarizeInventory,
  type OwnedGearRow,
} from '@/features/adventure-intelligence/domain/gearInventory';

export interface GearAdapterInput {
  route?: RouteAdapterOutput | null;
  /**
   * Chantier configurateur (P0) — inventaire réel (`product_ownership`, RLS).
   * `undefined` = non chargé (repli historique « inventaire vide » déclaré) ;
   * `[]` = chargé et vide, ce qui est une information différente.
   */
  inventory?: readonly OwnedGearRow[];
  /** Date de départ ISO : juge prêts, entretiens et péremptions. */
  departureDay?: string | null;
}

export const gearAdapter: AdventureEngine<GearAdapterInput, TripKitAnalysis> = {
  id: 'gear',
  version: ADAPTER_VERSION,
  dependencies: ['route'],
  canRun: () => true,
  async run(input, context) {
    const route = input?.route;
    if (!route) {
      throw new EngineSkipSignal({
        code: 'gear_no_source',
        message: 'Aucun itinéraire amont — section équipement laissée vide.',
        severity: 'warning',
      });
    }

    const brief = route.brief;
    const countryCode = brief.destinations.value[0]?.country ?? null;
    const durationDays = Math.max(1, Math.trunc(brief.duration.value.days));
    const seasonMonth = brief.window.value.month;

    const inventory = input?.inventory;
    const departureDay = input?.departureDay ?? null;
    const currentItems = inventory ? inventoryToKitItems(inventory, departureDay, context.nowIso) : undefined;

    const kitInput: ContextualKitInput = {
      countryCode,
      activity: brief.style.value[0] ?? 'hiking',
      durationDays,
      seasonMonth,
      ...(currentItems ? { currentItems } : {}),
    };

    const analysis = generateTripContextualKit(kitInput);

    const warnings: EngineWarning[] = [];
    const assumptions: Assumption[] = [];

    if (!inventory) {
      warnings.push({
        code: 'inventory_missing',
        message:
          'Inventaire utilisateur non fourni : les écarts d’équipement sont calculés à vide.',
        severity: 'info',
      });
      assumptions.push({
        id: 'empty_inventory',
        label: 'Inventaire vide',
        detail: 'Les recommandations partent d’un inventaire vide, sans supposer de matériel possédé.',
      });
    } else {
      const summary = summarizeInventory(inventory, departureDay);
      assumptions.push({
        id: 'owned_inventory',
        label: 'Inventaire personnel pris en compte',
        detail: `${summary.disponible} objet(s) disponible(s) comparé(s) aux besoins ; posséder ne signifie pas préparé.`,
      });
      const unavailable = summary.prete + summary.hors_service;
      if (unavailable > 0) {
        warnings.push({
          code: 'inventory_unavailable_items',
          message: `${unavailable} objet(s) possédé(s) exclu(s) : prêté(s) ou hors service.`,
          severity: 'info',
        });
      }
      if (summary.a_verifier > 0) {
        warnings.push({
          code: 'inventory_items_to_check',
          message: `${summary.a_verifier} objet(s) à vérifier avant le départ (entretien ou péremption).`,
          severity: 'warning',
        });
      }
    }

    return makeEngineResult({
      value: analysis,
      confidence: makeConfidence({
        score: 0.5,
        sampleCount: inventory ? inventory.length : 0,
        method: 'contextual_kit_rules',
        reasons: [
          'Règles contextuelles déterministes du catalogue LKDV',
          inventory
            ? 'Inventaire personnel comparé aux besoins — adéquation terrain à confirmer'
            : 'Inventaire utilisateur absent — complétude non garantie',
        ],
      }),
      provenance: [
        {
          source: 'computed',
          sourceRef: 'a6:gearAdapter',
          notes: 'Recommandations issues des règles contextuelles LKDV',
        },
      ],
      assumptions,
      warnings,
      computedAt: context.nowIso,
    });
  },
};
