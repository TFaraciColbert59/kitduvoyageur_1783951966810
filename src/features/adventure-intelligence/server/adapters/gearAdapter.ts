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

export interface GearAdapterInput {
  route?: RouteAdapterOutput | null;
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

    const kitInput: ContextualKitInput = {
      countryCode,
      activity: brief.style.value[0] ?? 'hiking',
      durationDays,
      seasonMonth,
    };

    const analysis = generateTripContextualKit(kitInput);

    const warnings: EngineWarning[] = [
      {
        code: 'inventory_missing',
        message:
          'Inventaire utilisateur non fourni : les écarts d’équipement sont calculés à vide.',
        severity: 'info',
      },
    ];

    const assumptions: Assumption[] = [
      {
        id: 'empty_inventory',
        label: 'Inventaire vide',
        detail: 'Les recommandations partent d’un inventaire vide, sans supposer de matériel possédé.',
      },
    ];

    return makeEngineResult({
      value: analysis,
      confidence: makeConfidence({
        score: 0.5,
        sampleCount: 0,
        method: 'contextual_kit_rules',
        reasons: [
          'Règles contextuelles déterministes du catalogue LKDV',
          'Inventaire utilisateur absent — complétude non garantie',
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
