/**
 * Compas — « prochaine décision, appliquer » (îlot au-dessus de la barre d'onglets, fonction pure).
 *
 * Le moteur sait déjà quelle est LA prochaine décision (`CompasModel.nextDecision`). Ici, on dit
 * seulement si le Compas peut l'APPLIQUER d'un geste, sans rien choisir à la place de la personne :
 *
 * - une décision qui demande un CHOIX (dates, parcours, produit à trouver) ou qui engage de
 *   l'argent (commander, confirmer une réservation, relever l'enveloppe) n'a PAS d'« Appliquer » :
 *   la capsule ne propose que « Voir », qui ouvre l'étape ;
 * - une décision qui n'est qu'un CALCUL sur des données déjà là et dont l'inverse est sûr peut
 *   l'être. Aujourd'hui une seule : « Répartir le matériel commun » (objets communs sans porteur)
 *   entre les membres, pour que les sacs pèsent le plus pareil. Inverse : les remettre sans porteur.
 *
 * Même entrée, même répartition, au gramme près.
 */

import type { CompasKitLine, CompasMemberLoad, CompasModel } from './compasModel';
import { formatKg } from './format';

/** Un objet commun confié à un membre. */
export interface CarrierAssignment {
  itemId: string;
  itemName: string;
  carrierId: string;
  carrierName: string;
  /** Poids de la ligne (quantité comprise), 0 quand il n'est pas connu. */
  grams: number;
}

export interface DecisionApply {
  kind: 'carriers';
  /** Ce que fait « Appliquer », en quelques mots. */
  label: string;
  /** Qui porte quoi, une phrase par porteur, séparées par « · ». */
  summary: string;
  assignments: CarrierAssignment[];
}

const weightOf = (line: CompasKitLine): number => (line.weightGrams ?? 0) * line.quantity;

/**
 * Répartition du commun sans porteur : les plus lourds d'abord, chacun chez le membre dont le sac
 * serait le moins chargé APRÈS l'avoir pris. Quand tout le monde a une capacité connue, on compare
 * la charge rapportée à la capacité ; sinon, la charge en grammes (on ne devine pas une capacité).
 * Égalité : le moins d'objets déjà confiés dans cette passe, puis l'ordre de l'équipe.
 */
export function balanceCarriers(
  lines: readonly CompasKitLine[],
  loads: readonly CompasMemberLoad[]
): CarrierAssignment[] {
  if (loads.length === 0) return [];
  const byCapacity = loads.every((m) => m.capacityKg != null && m.capacityKg > 0);
  const carried = loads.map((m) => m.carriedGrams);
  const count = loads.map(() => 0);
  const projected = (i: number, grams: number) =>
    byCapacity
      ? (carried[i] + grams) / ((loads[i].capacityKg as number) * 1000)
      : carried[i] + grams;

  const ordered = [...lines].sort(
    (a, b) =>
      weightOf(b) - weightOf(a) ||
      (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : 1)
  );
  return ordered.map((line) => {
    const grams = weightOf(line);
    let best = 0;
    for (let i = 1; i < loads.length; i += 1) {
      const a = projected(i, grams);
      const b = projected(best, grams);
      if (a < b || (a === b && count[i] < count[best])) best = i;
    }
    carried[best] += grams;
    count[best] += 1;
    return {
      itemId: line.id,
      itemName: line.name,
      carrierId: loads[best].userId,
      carrierName: loads[best].name,
      grams,
    };
  });
}

/** « Léa : 2 objets, 2,7 kg · Tony : 1 objet » (le poids seulement quand il est connu). */
export function summarize(assignments: readonly CarrierAssignment[]): string {
  const byCarrier = new Map<string, { count: number; grams: number }>();
  for (const a of assignments) {
    const seen = byCarrier.get(a.carrierName) ?? { count: 0, grams: 0 };
    byCarrier.set(a.carrierName, { count: seen.count + 1, grams: seen.grams + a.grams });
  }
  return [...byCarrier]
    .map(
      ([who, { count, grams }]) =>
        `${who} : ${count} objet${count > 1 ? 's' : ''}${grams > 0 ? `, ${formatKg(grams)}` : ''}`
    )
    .join(' · ');
}

/**
 * Ce que « Appliquer » ferait pour la prochaine décision, ou null quand la décision demande un
 * choix (« Voir » seulement). `canEdit` : la personne peut modifier le voyage.
 */
export function planDecisionApply(model: CompasModel, canEdit: boolean): DecisionApply | null {
  const decision = model.nextDecision;
  if (!decision || !canEdit) return null;
  if (decision.flow === 'sacs') {
    const { unassignedShared, loads } = model.crew;
    if (loads.length < 2 || unassignedShared.length === 0) return null;
    const assignments = balanceCarriers(unassignedShared, loads);
    return {
      kind: 'carriers',
      label: 'Répartir le matériel commun',
      summary: summarize(assignments),
      assignments,
    };
  }
  return null;
}
