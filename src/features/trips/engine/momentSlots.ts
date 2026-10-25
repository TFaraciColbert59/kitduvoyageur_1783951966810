/**
 * Moments d'enrichissement (§4.3) — lignes `trip_steps` écrites par le service
 * avec `metadata.kind='moment'` et un titre préfixé « Matin — … »,
 * « Après-midi — … » ou « Soir — … ». Le classement est déterministe :
 * métadonnée d'abord, préfixe canonique ensuite, heure de passage en repli.
 * Hors de ces marqueurs, la ligne reste une étape normale (jamais inventée).
 */
export type MomentSlot = 'matin' | 'apres-midi' | 'soir';

export interface MomentStepLike {
  title?: string | null;
  start_time?: string | null;
  metadata?: Record<string, unknown> | null;
}

export const MOMENT_SLOT_LABELS: Record<MomentSlot, string> = {
  matin: 'Matin',
  'apres-midi': 'Après-midi',
  soir: 'Soir',
};

/** Préfixe canonique du service d'enrichissement : « Créneau — libellé ». */
const SLOT_PREFIX = /^(matin|après-midi|apres-midi|soir)\s*[—–-]\s*/i;

function metadataKind(metadata: MomentStepLike['metadata']): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const kind = (metadata as Record<string, unknown>).kind;
  return typeof kind === 'string' ? kind : null;
}

/** Retire le préfixe de créneau : le libellé réel du moment seulement. */
export function momentTitleBody(title: string | null | undefined): string {
  const trimmed = (title ?? '').trim();
  const match = SLOT_PREFIX.exec(trimmed);
  return match ? trimmed.slice(match[0].length).trim() : trimmed;
}

/**
 * Créneau d'un moment, ou `null` si la ligne n'est pas un moment
 * d'enrichissement. Une étape normale n'est jamais reclassée.
 */
export function momentSlotOf(step: MomentStepLike): MomentSlot | null {
  const title = (step.title ?? '').trim();
  const prefixed = SLOT_PREFIX.test(title);
  if (!prefixed && metadataKind(step.metadata) !== 'moment') return null;

  const lower = title.toLowerCase();
  if (lower.startsWith('matin')) return 'matin';
  if (lower.startsWith('après-midi') || lower.startsWith('apres-midi')) return 'apres-midi';
  if (lower.startsWith('soir')) return 'soir';

  const time = (step.start_time ?? '').slice(0, 5);
  if (/^\d{2}:\d{2}$/.test(time)) {
    if (time >= '18:00') return 'soir';
    if (time >= '12:00') return 'apres-midi';
  }
  return 'matin';
}
