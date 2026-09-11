/**
 * A6 — Adaptateurs sans source déterministe : weather, regulations, documents.
 *
 * Ces trois domaines exigent des données vivantes ou officielles. En l'absence
 * de source déterministe injectée, l'adaptateur retourne un skip explicite :
 * aucune donnée météo, réglementaire ou documentaire n'est jamais inventée.
 */
import 'server-only';
import type { AdventureEngine, EngineWarning } from '@/features/adventure-intelligence/domain/engine';
import { EngineSkipSignal } from '@/features/adventure-intelligence/domain/engineRegistry';
import { ADAPTER_VERSION } from './adapterSupport';

export interface SkippedAdapterOptions {
  id: string;
  dependencies: string[];
  skipReason: EngineWarning;
}

export type SkippedAdapter = AdventureEngine<unknown, null> & {
  readonly skipReason: EngineWarning;
};

export function createSkippedAdapter(options: SkippedAdapterOptions): SkippedAdapter {
  const engine: SkippedAdapter = {
    id: options.id,
    version: ADAPTER_VERSION,
    dependencies: options.dependencies,
    skipReason: options.skipReason,
    canRun: () => false,
    async run() {
      throw new EngineSkipSignal(options.skipReason);
    },
  };
  return engine;
}

export const weatherAdapter = createSkippedAdapter({
  id: 'weather',
  dependencies: ['route'],
  skipReason: {
    code: 'weather_no_deterministic_source',
    message:
      'Aucune source météo déterministe n’est injectée — section liveConditions laissée vide (aucune donnée inventée).',
    severity: 'warning',
  },
});

export const regulationsAdapter = createSkippedAdapter({
  id: 'regulations',
  dependencies: ['route'],
  skipReason: {
    code: 'regulations_no_deterministic_source',
    message:
      'Aucune source réglementaire déterministe n’est injectée — section regulations laissée vide (aucune donnée inventée).',
    severity: 'warning',
  },
});

export const documentsAdapter = createSkippedAdapter({
  id: 'documents',
  dependencies: ['route'],
  skipReason: {
    code: 'documents_no_deterministic_source',
    message:
      'Aucune source documentaire déterministe n’est injectée — section documents laissée vide (aucune donnée inventée).',
    severity: 'warning',
  },
});
