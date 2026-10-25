import 'server-only';

/**
 * T31 — Tâches collectives utiles : confirmation par un AUTRE membre
 * (confirmateur ≠ responsable), pas de micropartition ni de double crédit
 * avec l'organisation, quitter un groupe ne retire jamais un gain acquis.
 */

export type GroupTaskRefusal =
  | 'auto_confirmation'
  | 'tache_sans_substance'
  | 'deja_creditee_comme_organisation'
  | 'deja_creditee';

export interface GroupTaskInput {
  responsibleId: string;
  confirmerId: string;
  /** Longueur/épaisseur du contenu de la tâche (anti-micro-partition). */
  contentLength: number;
  /** Partie d'une tâche « découpée » artificiellement pour farmer. */
  isMicroSplit: boolean;
  creditedAsOrganizationForSameService: boolean;
  taskFingerprint: string;
  existingFingerprints?: readonly string[];
}

export const GROUP_TASK_MIN_CONTENT = 30;

export function evaluateGroupTask(
  input: GroupTaskInput
): { ok: true; claimKey: string } | { ok: false; reason: GroupTaskRefusal } {
  if (!input.confirmerId || input.confirmerId === input.responsibleId) {
    return { ok: false, reason: 'auto_confirmation' };
  }
  if (input.isMicroSplit || input.contentLength < GROUP_TASK_MIN_CONTENT) {
    return { ok: false, reason: 'tache_sans_substance' };
  }
  if (input.creditedAsOrganizationForSameService) {
    return { ok: false, reason: 'deja_creditee_comme_organisation' };
  }
  if ((input.existingFingerprints ?? []).includes(input.taskFingerprint)) {
    return { ok: false, reason: 'deja_creditee' };
  }
  return { ok: true, claimKey: `group_task:${input.taskFingerprint}` };
}
