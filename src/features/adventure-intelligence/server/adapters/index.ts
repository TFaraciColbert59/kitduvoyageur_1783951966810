/**
 * A6 — Registre par défaut des adaptateurs.
 *
 * Ordre de la roadmap : intent → route → budget|gear → coherence →
 * prediction → difficulty → safety → weather|regulations|documents.
 * Les moteurs sans source déterministe sont enregistrés pour apparaître en
 * `skipped` motivé dans les runs (observabilité honnête).
 */
import type { AdventureEngine } from '@/features/adventure-intelligence/domain/engine';
import { EngineRegistry } from '@/features/adventure-intelligence/domain/engineRegistry';
import { intentAdapter } from './intentAdapter';
import { routeAdapter } from './routeAdapter';
import { budgetAdapter } from './budgetAdapter';
import { gearAdapter } from './gearAdapter';
import { coherenceAdapter } from './coherenceAdapter';
import { predictionAdapter } from './predictionAdapter';
import { difficultyAdapter } from './difficultyAdapter';
import { safetyAdapter } from './safetyAdapter';
import {
  documentsAdapter,
  regulationsAdapter,
  weatherAdapter,
} from './skippedAdapters';

export * from './intentAdapter';
export * from './routeAdapter';
export * from './budgetAdapter';
export * from './gearAdapter';
export * from './coherenceAdapter';
export * from './predictionAdapter';
export * from './difficultyAdapter';
export * from './safetyAdapter';
export * from './skippedAdapters';

export const DEFAULT_ADAPTERS: AdventureEngine<unknown, unknown>[] = [
  intentAdapter,
  routeAdapter,
  budgetAdapter,
  gearAdapter,
  coherenceAdapter,
  predictionAdapter,
  difficultyAdapter,
  safetyAdapter,
  weatherAdapter,
  regulationsAdapter,
  documentsAdapter,
];

export function createDefaultRegistry(): EngineRegistry {
  const registry = new EngineRegistry();
  for (const adapter of DEFAULT_ADAPTERS) {
    registry.register(adapter);
  }
  return registry;
}
