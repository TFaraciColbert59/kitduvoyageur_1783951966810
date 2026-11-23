/**
 * « Prêt à partir ? » (9.7) : ce que la page SAIT, fait par fait. La liste de départ est celle du HUB
 * (`trip_checklist_items`), pas une seconde liste cochée à la main. Un fait non lisible reste « inconnu » et ne
 * compte ni pour ni contre : le pourcentage porte seulement sur ce qui est connu, et le nombre d'inconnus est dit.
 */
import { routeFaults } from '../insights/summary';
import type { StoredDeparturePack } from '../offlinePackStore';
import type { RouteWorkspaceState } from '../types';

export type DepartFactState = 'ok' | 'todo' | 'unknown';

export interface DepartFact {
  readonly id: 'track' | 'published' | 'pack' | 'kit' | 'checklist' | 'safety' | 'participants';
  readonly label: string;
  readonly state: DepartFactState;
  readonly detail: string;
}

export interface ChecklistSummary {
  readonly total: number;
  readonly done: number;
}

export interface DepartReading {
  readonly facts: readonly DepartFact[];
  /** Part des faits connus qui sont faits, 0 à 100 ; `null` quand rien n'est connu. */
  readonly scorePct: number | null;
  readonly unknownCount: number;
  readonly label: 'Prêt pour le départ' | 'Préparation avancée' | 'Préparation à finaliser' | 'À évaluer';
}

export function departReading(input: {
  workspace: RouteWorkspaceState;
  pack: StoredDeparturePack | null;
  /** `null` : liste du HUB non lue (hors ligne, voyage non rattaché, pas de droit). */
  checklist: ChecklistSummary | null;
  /** `null` : contacts non lus. */
  safetyContacts: number | null;
  /** Participants vus par l'organisateur ; `null` quand la personne n'est pas organisatrice. */
  participants: { ready: number; total: number } | null;
}): DepartReading {
  const ws = input.workspace;
  const faults = routeFaults(ws);
  const facts: DepartFact[] = [];
  const trackOk = faults.hasRoute && faults.missingJoins + faults.gapJoins === 0;
  facts.push({ id: 'track', label: 'Tracé continu', state: trackOk ? 'ok' : 'todo', detail: trackOk ? 'Aucun raccord à corriger' : faults.hasRoute ? `${faults.missingJoins + faults.gapJoins} raccord(s) à corriger` : 'Aucun tracé' });
  facts.push({ id: 'published', label: 'Version publiée', state: ws.publishedRevisionNo ? 'ok' : 'todo', detail: ws.publishedRevisionNo ? `v${ws.publishedRevisionNo}` : 'Rien n’est publié' });
  const packNo = input.pack?.manifest.revisionNo ?? null;
  facts.push({
    id: 'pack',
    label: 'Copie hors ligne',
    state: packNo != null && packNo === ws.publishedRevisionNo ? 'ok' : 'todo',
    detail: packNo == null ? 'Aucune copie sur cet appareil' : packNo === ws.publishedRevisionNo ? `v${packNo} sur l’appareil` : `v${packNo} sur l’appareil, v${ws.publishedRevisionNo ?? '?'} publiée`,
  });
  const reval = ws.kitItems.filter((i) => i.status === 'needs_revalidation').length;
  const unassigned = ws.kitItems.filter((i) => i.shared && !i.assigneeUserId).length;
  facts.push({
    id: 'kit',
    label: 'Sac vérifié',
    state: ws.kitItems.length === 0 ? 'unknown' : reval + unassigned === 0 ? 'ok' : 'todo',
    detail: ws.kitItems.length === 0 ? 'Aucun objet dans le sac' : reval + unassigned === 0 ? `${ws.kitItems.length} objet(s) à jour` : `${reval} à revérifier · ${unassigned} commun(s) sans porteur`,
  });
  facts.push({
    id: 'checklist',
    label: 'Liste de départ (HUB)',
    state: input.checklist == null || input.checklist.total === 0 ? 'unknown' : input.checklist.done === input.checklist.total ? 'ok' : 'todo',
    detail: input.checklist == null ? 'Liste du HUB non lue' : input.checklist.total === 0 ? 'Aucun élément dans la liste du HUB' : `${input.checklist.done} sur ${input.checklist.total} faits`,
  });
  facts.push({
    id: 'safety',
    label: 'Contact de sécurité',
    state: input.safetyContacts == null ? 'unknown' : input.safetyContacts > 0 ? 'ok' : 'todo',
    detail: input.safetyContacts == null ? 'Contacts non lus' : input.safetyContacts > 0 ? `${input.safetyContacts} contact(s)` : 'Aucun contact renseigné',
  });
  if (input.participants) {
    facts.push({
      id: 'participants',
      label: 'Participants prêts',
      state: input.participants.total === 0 ? 'unknown' : input.participants.ready === input.participants.total ? 'ok' : 'todo',
      detail: `${input.participants.ready} sur ${input.participants.total}`,
    });
  }
  const known = facts.filter((f) => f.state !== 'unknown');
  const ok = known.filter((f) => f.state === 'ok').length;
  const scorePct = known.length === 0 ? null : Math.round((ok / known.length) * 100);
  return {
    facts,
    scorePct,
    unknownCount: facts.length - known.length,
    label: scorePct == null ? 'À évaluer' : scorePct >= 100 ? 'Prêt pour le départ' : scorePct >= 60 ? 'Préparation avancée' : 'Préparation à finaliser',
  };
}
