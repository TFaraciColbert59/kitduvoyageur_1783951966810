/**
 * Lignées de kits — règles de filiation applicatives (chantier lignées, Lot 1).
 *
 * Le déclencheur serveur (handle_kit_lineage, migration 20260903010000) reste la
 * garantie finale d'intégrité. Ces fonctions purifient les décisions de la route
 * de fork : ce qui est de l'ordre de la règle métier (auto-fork, nom) vit ici,
 * testable sans base de données.
 */

/** Champs dérivés exclusivement par le serveur — interdits en entrée client. */
export const SERVER_KIT_FIELDS = [
  'lineage_root_id',
  'generation',
  'ancestors',
  'field_proven_count',
] as const;

/** Un fork de son propre kit est une duplication privée, PAS une adaptation. */
export function isAutoFork(sourceUserId: string | null | undefined, currentUserId: string): boolean {
  return !!sourceUserId && sourceUserId === currentUserId;
}

/**
 * Nom d'un fork adapté : jamais « (copie) ». Un fork est une adaptation, pas une
 * photocopie — on honore le créateur de la version d'origine quand on le connaît.
 */
export function buildAdaptiveForkName(sourceName: string, sourceOwnerName?: string | null): string {
  const base = sourceName.trim();
  if (!base) return 'Kit sans nom';
  return sourceOwnerName ? `${base} — ${sourceOwnerName}` : base;
}

export interface KitForkDecision {
  forkedFrom: string | null;
  origin: 'fork' | 'manuel';
  name: string;
}

/**
 * Décide du payload de filiation d'un fork.
 * - Fork du kit d'autrui → vraie filiation (forked_from = source, origin = 'fork').
 * - Auto-fork (son propre kit) → duplication privée : PAS de filiation, origin =
 *   'manuel'. Un auto-fork ne doit jamais compter dans la conservation ni ouvrir
 *   droit à commission (vecteur de fraude n°1).
 */
export function decideKitFork(input: {
  sourceId: string;
  sourceUserId: string | null | undefined;
  sourceName: string;
  currentUserId: string;
  sourceOwnerName?: string | null;
  requestedName?: string | null;
}): KitForkDecision {
  const auto = isAutoFork(input.sourceUserId, input.currentUserId);

  if (auto) {
    return {
      forkedFrom: null,
      origin: 'manuel',
      name: input.requestedName?.trim() || input.sourceName.trim() || 'Kit sans nom',
    };
  }

  return {
    forkedFrom: input.sourceId,
    origin: 'fork',
    name:
      input.requestedName?.trim() ||
      buildAdaptiveForkName(input.sourceName, input.sourceOwnerName),
  };
}

/** Garde d'entrée : les champs dérivés serveur ne sont jamais acceptés du client. */
export function assertNoServerKitFields(body: Record<string, unknown>): void {
  for (const key of SERVER_KIT_FIELDS) {
    if (key in body) {
      throw new Error(`Champ serveur interdit en entrée : ${key}`);
    }
  }
}