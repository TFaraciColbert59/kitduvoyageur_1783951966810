/**
 * Lot A02 — types partagés de la surface UI du cycle de vie.
 */

export type LifecycleSubDrawer =
  | 'edit_metadata_media'
  | 'edit_sport_tags'
  | 'crop_split'
  | 'correct_distance_elevation'
  | 'delete_restore'
  | 'quick_edit_sync';

export type SubmitResult = { ok: true } | { ok: false; error: string };

export interface UiNotice {
  tone: 'ok' | 'error' | 'warning' | 'info';
  text: string;
}

export const SUB_DRAWER_TITLES: Readonly<Record<LifecycleSubDrawer, string>> = {
  edit_metadata_media: 'Modifier la séance',
  edit_sport_tags: 'Sport et tags',
  crop_split: 'Recadrer ou fractionner',
  correct_distance_elevation: 'Corriger distance et dénivelé',
  delete_restore: 'Supprimer la séance',
  quick_edit_sync: 'Édition rapide',
};

export function newOperationId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `op_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
