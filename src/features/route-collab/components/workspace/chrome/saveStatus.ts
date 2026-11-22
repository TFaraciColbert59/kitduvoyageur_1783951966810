/**
 * Sauvegarde dite honnêtement (3.5) et file hors ligne (3.6) : une phrase, calculée sans rien deviner.
 * « Enregistré » n'est écrit qu'après l'accusé du serveur pour la dernière séquence ; tout le reste est
 * « Non enregistré », « Enregistrement… », « N changements en attente » ou « N en conflit · voir ».
 */
export type SaveKind = 'saved' | 'saving' | 'unsaved' | 'queued' | 'conflict';

export interface SaveInputs {
  /** Les opérations passent par le serveur (sinon rien n'est jamais enregistré ailleurs que sur cet appareil). */
  readonly serverSynced: boolean;
  /** Opérations parties, pas encore accusées. */
  readonly pending: number;
  /** Dernière séquence accusée par le serveur. */
  readonly ackedSeq: number;
  /** Séquence de l'état affiché. */
  readonly headSeq: number;
  /** Opérations gardées sur l'appareil, en attente du réseau. */
  readonly queued: number;
  /** Opérations gardées sur l'appareil que le serveur a refusées pour conflit. */
  readonly conflicts: number;
  /** Dernier refus (droits, résultat périmé), sinon `null`. */
  readonly failedReason: string | null;
  readonly online: boolean;
}

export interface SaveStatus {
  readonly kind: SaveKind;
  readonly label: string;
  /** Précision lisible au survol / par lecteur d'écran. */
  readonly detail: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function saveStatusOf(i: SaveInputs): SaveStatus {
  if (i.conflicts > 0) {
    return {
      kind: 'conflict',
      label: `${i.conflicts} en conflit · voir`,
      detail: `${plural(i.conflicts, 'changement refusé', 'changements refusés')} par le serveur : à relire avant de réessayer.`,
    };
  }
  if (i.queued > 0) {
    return {
      kind: 'queued',
      label: `${plural(i.queued, 'changement', 'changements')} en attente`,
      detail: i.online
        ? 'Gardés sur cet appareil : ils partent dès que le serveur répond.'
        : 'Hors ligne : gardés sur cet appareil, ils partiront au retour du réseau.',
    };
  }
  if (i.pending > 0) {
    return { kind: 'saving', label: 'Enregistrement…', detail: 'En attente de l’accusé du serveur.' };
  }
  if (!i.serverSynced) {
    return {
      kind: 'unsaved',
      label: 'Non enregistré',
      detail: 'Cet itinéraire n’est pas relié au serveur : rien n’est enregistré en ligne.',
    };
  }
  if (i.failedReason) {
    return { kind: 'unsaved', label: 'Non enregistré', detail: i.failedReason };
  }
  if (i.headSeq > i.ackedSeq) {
    return {
      kind: 'unsaved',
      label: 'Non enregistré',
      detail: 'Des changements affichés n’ont pas été confirmés par le serveur.',
    };
  }
  return { kind: 'saved', label: 'Enregistré', detail: `Confirmé par le serveur (séquence ${i.ackedSeq}).` };
}
