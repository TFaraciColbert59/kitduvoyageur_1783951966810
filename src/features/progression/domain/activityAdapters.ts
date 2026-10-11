/**
 * T21 — Adaptateurs d'activité (hors randonnée).
 *
 * Invariants :
 *   • une CLÉ D'ACTIVITÉ COMMUNE : les adaptateurs d'une même session
 *     partagent la clé d'évidence `activity:<session_id>` et le claim
 *     `activity_completed` — une sortie multitag ne produit qu'UN gain ;
 *   • durée active et objectif adapté sont contrôlés CÔTÉ SERVEUR (les mêmes
 *     gardes que la randonnée : paliers 20/60/120/240 min, mouvement
 *     plausible) ;
 *   • aucun adaptateur fermé ne promet de gain : ses critères sont publiés,
 *     son producteur reste inactif tant que la source de données n'existe pas.
 *
 * L'émission réelle (`activity_completed`) reste fermée dans le barème v1 :
 * le moteur refuse `action_non_autorisee` jusqu'à l'activation v2 — c'est le
 * comportement attendu (producteur prêt ≠ émission ouverte).
 */

export type ActivityAdapterId = 'randonnee' | 'velo' | 'urbain' | 'accessible';

export interface ActivityAdapter {
  id: ActivityAdapterId;
  label: string;
  /** Mots-clés d'activité qui déclenchent cet adaptateur (priorité par ordre). */
  tags: readonly string[];
  /** Preuve équivalente : mêmes gardes serveur que la randonnée. */
  minActiveMinutes: number;
  adaptedObjectiveAllowed: boolean;
  status: 'active' | 'closed';
  /** Critères publiés avant activation d'un mode fermé. */
  criteria: string;
  closedReason?: string;
}

export const ACTIVITY_ADAPTERS: readonly ActivityAdapter[] = [
  {
    id: 'randonnee',
    label: 'Randonnée',
    tags: ['hike', 'hiking', 'randonnee', 'trail', 'marche'],
    minActiveMinutes: 20,
    adaptedObjectiveAllowed: true,
    status: 'active',
    criteria:
      'Session traitée, durée active recalculée (paliers 20/60/120/240), mouvement plausible, nouveauté par parcours canonique.',
  },
  {
    id: 'velo',
    label: 'Vélo',
    tags: ['bike', 'cycling', 'velo', 'vtte', 'gravel'],
    minActiveMinutes: 20,
    adaptedObjectiveAllowed: true,
    status: 'closed',
    criteria:
      'Réalisation vérifiée (trace continue, mouvement plausible), durée active serveur, objectif adapté possible ; consentement explicite.',
    closedReason:
      'Aucune source de sessions vélo persistée : le producteur attend un adaptateur métier (P3).',
  },
  {
    id: 'urbain',
    label: 'Sortie urbaine',
    tags: ['walk', 'urban', 'urbain', 'marche-urbaine'],
    minActiveMinutes: 20,
    adaptedObjectiveAllowed: true,
    status: 'closed',
    criteria:
      'Balancement extérieur réellement détecté, durée active serveur, vie privée : aucune coordonnée conservée pour le gain.',
    closedReason:
      'Aucune source de sessions urbaines persistée : le producteur attend un adaptateur métier (P3).',
  },
  {
    id: 'accessible',
    label: 'Sortie accessible',
    tags: ['accessible', 'adapted', 'joellette', 'fauteuil'],
    minActiveMinutes: 0,
    adaptedObjectiveAllowed: true,
    status: 'closed',
    criteria:
      'Objectif adapté publié et validé comme preuve (jamais de diagnostic collecté), durée ou jalon équivalent contrôlé serveur.',
    closedReason:
      'Objectif adapté : la grille de preuves équivalentes doit être publiée avant activation (P3).',
  },
] as const;

export function listActivityAdapters(): ActivityAdapter[] {
  return [...ACTIVITY_ADAPTERS];
}

export function getActivityAdapter(id: ActivityAdapterId): ActivityAdapter | null {
  return ACTIVITY_ADAPTERS.find((adapter) => adapter.id === id) ?? null;
}

/**
 * Résout UN SEUL adaptateur pour une activité (priorité du registre) :
 * une sortie multitag ne peut pas déclencher deux gains.
 */
export function resolveActivityAdapter(tags: readonly string[]): ActivityAdapter | null {
  const normalized = tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  if (normalized.length === 0) return null;
  for (const adapter of ACTIVITY_ADAPTERS) {
    if (adapter.tags.some((tag) => normalized.includes(tag))) return adapter;
  }
  return null;
}

/**
 * Clé d'évidence COMMUNE : le gain (et sa nouveauté éventuelle) réserve ce
 * fait une seule fois, quel que soit l'adaptateur qui l'a observé.
 */
export function activityEvidenceKey(sessionId: string): string {
  return `activity:${sessionId}`;
}

export const ACTIVITY_CLAIM_GROUP = 'activity_completed';

/** Un adaptateur fermé ne produit jamais de gain (false = refuse explicite). */
export function isAdapterAvailable(id: ActivityAdapterId): boolean {
  return getActivityAdapter(id)?.status === 'active';
}

/**
 * Porte de la preuve serveur : mêmes métriques que la randonnée, contrôlées
 * par l'appelant (durée active, mouvement). Adaptateur fermé → refus.
 */
export function evaluateActivityProof(
  adapterId: ActivityAdapterId,
  proof: { activeMinutes: number; plausibleMovement: number | null; adaptedObjective: boolean }
): { ok: true } | { ok: false; reason: string } {
  const adapter = getActivityAdapter(adapterId);
  if (!adapter) return { ok: false, reason: 'adaptateur_inconnu' };
  if (adapter.status !== 'active') return { ok: false, reason: 'adaptateur_ferme' };

  if (proof.plausibleMovement !== null && proof.plausibleMovement < 0.5) {
    return { ok: false, reason: 'mouvement_non_plausible' };
  }
  const minMinutes = proof.adaptedObjective && adapter.adaptedObjectiveAllowed ? 0 : adapter.minActiveMinutes;
  if (proof.activeMinutes < minMinutes) {
    return { ok: false, reason: 'duree_insuffisante' };
  }
  if (proof.adaptedObjective && !adapter.adaptedObjectiveAllowed) {
    return { ok: false, reason: 'objectif_adapte_refuse' };
  }
  return { ok: true };
}
