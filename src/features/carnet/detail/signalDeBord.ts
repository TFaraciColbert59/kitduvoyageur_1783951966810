/**
 * « Signal de bord » — proposition n° 37 de la maquette
 * `docs/carnets/maquette-carnets-de-bord.html` : pendant la randonnée,
 * publier en deux gestes une photo, une vidéo ou une ligne, rangée dans le
 * jour courant du carnet.
 *
 * Deux couches, testables séparément :
 * - des fonctions pures (jour courant, validation du fichier) ;
 * - `publishSignal`, qui poste un `FormData` vers `/api/carnets/signal`
 *   (même origine, cookies de session) — aucun accès direct à la base ici,
 *   la route serveur applique la RLS, valide et range le média.
 *
 * Aucune donnée inventée : sans carnet résoluble côté serveur, la route en
 * crée un (le cockpit le réutilisera à l'arrêt) ; le client ne fabrique jamais
 * d'identifiant.
 */

export type SignalKind = 'photo' | 'video' | 'note';

export interface SignalFileLike {
  type: string;
  size: number;
  name?: string;
}

interface SignalMediaRule {
  bucket: 'carnet-media' | 'carnet-moments-media';
  maxBytes: number;
  mimes: readonly string[];
}

/** Règles alignées sur les buckets Supabase (limites et MIME vérifiés en base). */
export const SIGNAL_MEDIA_RULES: Record<'photo' | 'video', SignalMediaRule> = {
  photo: {
    bucket: 'carnet-media',
    maxBytes: 10 * 1024 * 1024,
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  },
  video: {
    bucket: 'carnet-moments-media',
    maxBytes: 25 * 1024 * 1024,
    mimes: ['video/mp4', 'video/webm', 'video/quicktime'],
  },
};

const DAY_MS = 86_400_000;

/** Minuit UTC d'une date `YYYY-MM-DD` ; `null` si absente ou illisible. */
function isoStamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Jours civils écoulés entre la date du carnet et `now`, bornés 1..366. */
export function signalDayNumber(
  startDate: string | null | undefined,
  now: Date | number = Date.now()
): number {
  const start = isoStamp(startDate);
  if (start === null) return 1;
  const current = now instanceof Date ? now : new Date(now);
  const today = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
  const diff = Math.floor((today - start) / DAY_MS) + 1;
  if (!Number.isFinite(diff)) return 1;
  return Math.min(366, Math.max(1, diff));
}

export type SignalFileValidation = { ok: true } | { ok: false; error: string };

/** MIME et plafond de taille avant tout envoi ; message clair, jamais silencieux. */
export function validateSignalFile(
  kind: 'photo' | 'video',
  file: SignalFileLike | null | undefined
): SignalFileValidation {
  if (!file) return { ok: false, error: 'Choisis un fichier à envoyer.' };
  const rule = SIGNAL_MEDIA_RULES[kind];
  if (!rule.mimes.includes(file.type)) {
    return {
      ok: false,
      error:
        kind === 'photo'
          ? 'Format photo non pris en charge (JPEG, PNG, WebP ou HEIC).'
          : 'Format vidéo non pris en charge (MP4, WebM ou MOV).',
    };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: 'Le fichier est vide.' };
  }
  if (file.size > rule.maxBytes) {
    const maxMo = Math.round(rule.maxBytes / (1024 * 1024));
    return { ok: false, error: `Fichier trop lourd (maximum ${maxMo} Mo).` };
  }
  return { ok: true };
}

export interface PublishSignalInput {
  kind: SignalKind;
  /** La ligne du signal (facultative pour une photo/vidéo, requise pour une note). */
  text?: string;
  place?: string | null;
  tripId?: string | null;
  carnetId?: string | null;
  file?: File | null;
}

export interface PublishSignalResult {
  ok: boolean;
  carnetId?: string;
  day?: number;
  momentId?: string;
  error?: string;
}

/** Longueur maximale de la ligne de signal (alignée sur la validation serveur). */
export const SIGNAL_TEXT_MAX = 400;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalUuid(value: string | null | undefined): string | null {
  if (!value) return null;
  return UUID_RE.test(value) ? value : null;
}

/**
 * Envoie le signal à la route serveur. `fetchImpl` est injectable pour les
 * tests ; toute erreur réseau ressort en `{ ok:false, error }` lisible.
 */
export async function publishSignal(
  input: PublishSignalInput,
  deps: { fetchImpl?: typeof fetch } = {}
): Promise<PublishSignalResult> {
  const fetchImpl = deps.fetchImpl ?? (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl) return { ok: false, error: 'Envoi impossible sur cet appareil.' };

  const text = (input.text ?? '').trim();
  if (text.length > SIGNAL_TEXT_MAX) {
    return { ok: false, error: `La ligne fait plus de ${SIGNAL_TEXT_MAX} caractères.` };
  }
  if (input.kind === 'note' && !text) {
    return { ok: false, error: 'Écris une ligne avant d’envoyer ton signal.' };
  }
  if (input.kind !== 'note') {
    const check = validateSignalFile(input.kind, input.file);
    if (!check.ok) return check;
  }

  const form = new FormData();
  form.set('kind', input.kind);
  if (text) form.set('text', text);
  if (input.place) form.set('place', input.place.slice(0, 80));
  const tripId = optionalUuid(input.tripId);
  if (tripId) form.set('tripId', tripId);
  const carnetId = optionalUuid(input.carnetId);
  if (carnetId) form.set('carnetId', carnetId);
  if (input.file) form.set('file', input.file);

  try {
    const response = await fetchImpl('/api/carnets/signal', {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
    });
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; carnetId?: string; day?: number; momentId?: string; error?: string }
      | null;
    if (!response.ok || !payload?.ok) {
      return {
        ok: false,
        error: payload?.error ?? 'Le signal n’a pas pu être envoyé. Réessaie.',
      };
    }
    return {
      ok: true,
      carnetId: payload.carnetId,
      day: payload.day,
      momentId: payload.momentId,
    };
  } catch {
    return { ok: false, error: 'Connexion impossible. Vérifie ton réseau et réessaie.' };
  }
}
