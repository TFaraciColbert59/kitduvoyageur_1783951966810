/**
 * Brouillons locaux des formulaires de création.
 *
 * Fermer le drawer (Échap, glissement, re-clic sur l'onglet) ne doit jamais
 * faire perdre une saisie. Seuls les champs texte sont conservés : les
 * fichiers ne se sérialisent pas. Le stockage peut manquer ou lever
 * (navigation privée, quota) : tout est dans un try/catch et le formulaire
 * fonctionne sans.
 */

const PREFIX = 'lkdv:draft:community:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface Envelope<T> {
  savedAt: number;
  value: T;
}

export function draftKey(kind: string, userId: string | null | undefined): string | null {
  return userId ? `${PREFIX}${kind}:${userId}` : null;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readDraft<T>(key: string | null, now = Date.now()): T | null {
  if (!key) return null;
  try {
    const raw = storage()?.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || typeof parsed.savedAt !== 'number' || now - parsed.savedAt > MAX_AGE_MS) {
      storage()?.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

export function writeDraft<T>(key: string | null, value: T, now = Date.now()): void {
  if (!key) return;
  try {
    storage()?.setItem(key, JSON.stringify({ savedAt: now, value } satisfies Envelope<T>));
  } catch {
    /* quota ou stockage indisponible : le brouillon est facultatif */
  }
}

export function clearDraft(key: string | null): void {
  if (!key) return;
  try {
    storage()?.removeItem(key);
  } catch {
    /* ignoré */
  }
}

/** Vrai si au moins un champ texte porte une saisie : évite de stocker un brouillon vide. */
export function hasContent(value: Record<string, unknown>): boolean {
  return Object.values(value).some((entry) => (typeof entry === 'string' ? entry.trim().length > 0 : false));
}
