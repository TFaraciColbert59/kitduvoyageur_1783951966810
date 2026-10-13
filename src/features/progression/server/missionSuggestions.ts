import 'server-only';
import {
  getAvailableMissionModels,
  getUserMissions,
  type AvailableMissionModel,
} from './challengeService';

/**
 * T17 — Suggestions de missions dans le catalogue FERMÉ.
 *
 * Sélection déterministe d'abord (aucun fournisseur requis) ; un classement
 * IA est facultatif et ne fait que réordonner des identifiants DÉJÀ présents
 * dans la liste serveur. L'IA ne crée ni modèle, ni preuve, ni montant : le
 * texte des descriptions est traité comme du contenu, jamais comme une
 * instruction. Toute réponse IA hors catalogue est ignorée.
 */

export interface MissionSuggestion {
  modelId: string;
  title: string;
  description: string;
  reason: string;
}

export type MissionAiRanker = (
  candidates: readonly { id: string; title: string; description: string }[]
) => Promise<readonly string[] | null>;

const CATEGORY_PRIORITY: Record<string, number> = {
  decouverte: 0,
  preparation: 1,
  progression: 2,
  communaute: 3,
};

const DETERMINISTIC_REASONS: Record<string, string> = {
  decouverte: 'Une première réalisation vérifiée ouvre la progression.',
  preparation: 'La préparation compte lorsqu’elle est terminée et vérifiée.',
  progression: 'Un accomplissement de plusieurs journées, distinct des sorties.',
  communaute: 'Partager une information utile après une réalisation réelle.',
};

/** Hash stable (djb2) : départage sans hasard ni état serveur. */
function stableHash(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function deterministicSuggestions(
  userId: string,
  models: readonly AvailableMissionModel[],
  excludedModelIds: ReadonlySet<string>,
  limit = 3
): MissionSuggestion[] {
  return models
    .filter((model) => !excludedModelIds.has(model.id))
    .map((model) => ({
      model,
      rank: CATEGORY_PRIORITY[guessCategory(model.id)] ?? 9,
      tie: stableHash(`${userId}:${model.id}`),
    }))
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.tie - b.tie))
    .slice(0, Math.max(0, limit))
    .map(({ model }) => ({
      modelId: model.id,
      title: model.title,
      description: model.description,
      reason: DETERMINISTIC_REASONS[guessCategory(model.id)] ?? 'Mission disponible dans le catalogue.',
    }));
}

/** Catégorie devinée depuis l'identifiant stable du catalogue (préfixe). */
function guessCategory(modelId: string): string {
  if (modelId.startsWith('mission_discovery')) return 'decouverte';
  if (modelId.startsWith('mission_prep')) return 'preparation';
  if (modelId.startsWith('mission_progress')) return 'progression';
  if (modelId.startsWith('mission_community')) return 'communaute';
  return 'autre';
}

/**
 * Classement IA facultatif : ne peut que réordonner les identifiants fournis.
 * Toute valeur hors liste est ignorée ; une panne ramène la sélection
 * déterministe sans erreur utilisateur.
 */
export async function applyAiRanking(
  suggestions: MissionSuggestion[],
  ranker: MissionAiRanker | null
): Promise<MissionSuggestion[]> {
  if (!ranker || suggestions.length === 0) return suggestions;
  try {
    const ranked = await ranker(
      suggestions.map(({ modelId, title, description }) => ({ id: modelId, title, description }))
    );
    if (!Array.isArray(ranked)) return suggestions;
    const byId = new Map(suggestions.map((suggestion) => [suggestion.modelId, suggestion]));
    const ordered: MissionSuggestion[] = [];
    for (const value of ranked) {
      if (typeof value !== 'string') continue;
      const found = byId.get(value);
      if (found && !ordered.includes(found)) ordered.push(found);
    }
    for (const suggestion of suggestions) {
      if (!ordered.includes(suggestion)) ordered.push(suggestion);
    }
    return ordered;
  } catch {
    return suggestions;
  }
}

export async function suggestMissions(
  userId: string,
  options: { ranker?: MissionAiRanker | null; limit?: number } = {}
): Promise<MissionSuggestion[]> {
  const [models, missions] = await Promise.all([
    getAvailableMissionModels(),
    getUserMissions(userId),
  ]);
  const excluded = new Set(
    missions
      .filter((mission) => mission.state === 'active' || mission.completedAt !== null)
      .map((mission) => mission.modelId)
  );
  const deterministic = deterministicSuggestions(userId, models, excluded, options.limit ?? 3);
  return applyAiRanking(deterministic, options.ranker ?? null);
}
