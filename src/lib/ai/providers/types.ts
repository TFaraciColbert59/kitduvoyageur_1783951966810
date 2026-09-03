/**
 * Port IA de LKDV — contrat unique entre les features et les providers.
 * Changer de provider (Nemotron → Claude/GPT/local) = écrire UN adapter ici.
 * Aucune feature n'importe un provider directement : elles appellent askAI().
 */

export type AITier = 'heavy' | 'fast';

export interface AIRequest {
  feature: string; // clé du registre (src/lib/ai/features/registry.ts)
  tier: AITier;
  system: string;
  prompt: string;
  maxTokens: number;
  reasoningBudget?: number; // borne le raisonnement d'Ultra (crucial pour le quota)
  cacheTtlSeconds?: number; // 0 = pas de cache (utilisé par askAI, pas le provider)
  userId?: string; // pour le quota (utilisé par askAI, pas le provider)
}

export interface AIResponse {
  text: string;
  model: string;
  degraded: boolean;
  cached: boolean;
  provider: string;
}

export interface AIProvider {
  readonly name: string;
  /** Clé présente + endpoint joignable (vérification cheap, sans appel réseau). */
  isAvailable(): boolean;
  /** Retourne le texte brut. Throw en cas d'échec → askAI gère le fallback. */
  complete(req: AIRequest): Promise<string>;
}

/** Erreur transport normalisée (status HTTP ou timeout) — jamais de clé dedans. */
export class ProviderError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
  }
}
