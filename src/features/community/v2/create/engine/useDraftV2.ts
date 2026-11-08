'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import {
  createDefaultsV2,
  newClientRequestId,
  type CreateFormValuesMapV2,
  type CreateKindV2,
  type MediaItemV2,
} from './createSchemasV2';

/**
 * Brouillons V2 — un brouillon par type (`Publication#16`, `Carnet#1`).
 *
 * - clé `lkdv.cv2-draft:<kind>:v1` dans localStorage (aucun réseau) ;
 * - écriture débattue à 400 ms, vidée à la fermeture (`flush`), sur `pagehide`
 *   et sur `visibilitychange` (onglet masqué) ;
 * - jamais de `File`, de `Blob` ni d'aperçu `blob:` : seuls les médias **déjà
 *   téléversés** (URL non vide) survivent ;
 * - un brouillon vide n'est jamais écrit ; un champ non sérialisable est écarté ;
 * - `clientRequestId` restauré tel quel (un envoi rejoué reste idempotent).
 */

export const CREATE_DRAFT_V2_VERSION = 1;
export const CREATE_DRAFT_V2_PREFIX = 'lkdv.cv2-draft';
export const CREATE_DRAFT_V2_DEBOUNCE_MS = 400;

export interface CreateDraftV2Record<T = unknown> {
  version: number;
  kind: CreateKindV2;
  updatedAt: number;
  values: T;
}

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getStorage(): DraftStorage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    // Safari privé / origine opaque : le brouillon local n'est pas disponible.
    return null;
  }
}

export function draftStorageKey(kind: CreateKindV2, version = CREATE_DRAFT_V2_VERSION): string {
  return `${CREATE_DRAFT_V2_PREFIX}:${kind}:v${version}`;
}

function isMediaLike(value: Record<string, unknown>): boolean {
  return (
    typeof value.name === 'string' &&
    typeof value.type === 'string' &&
    typeof value.status === 'string' &&
    typeof value.size === 'number'
  );
}

function sanitizeMedia(record: Record<string, unknown>): MediaItemV2 | null {
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  // Un média local n'a plus de fichier après rechargement : impossible à restaurer.
  if (!url) return null;
  return {
    id: String(record.id ?? ''),
    name: String(record.name ?? ''),
    type: String(record.type ?? ''),
    size: Number(record.size ?? 0),
    previewUrl: '',
    url,
    alt: String(record.alt ?? ''),
    cover: Boolean(record.cover),
    status: 'uploaded',
    progress: 100,
    storageBucket: String(record.storageBucket ?? ''),
    storagePath: String(record.storagePath ?? ''),
    crop:
      record.crop === '4:5' || record.crop === '1:1' || record.crop === '9:16' || record.crop === '3:1'
        ? record.crop
        : 'original',
    durationMs: typeof record.durationMs === 'number' ? record.durationMs : undefined,
    trimStartMs: typeof record.trimStartMs === 'number' ? record.trimStartMs : undefined,
    trimEndMs: typeof record.trimEndMs === 'number' ? record.trimEndMs : undefined,
  };
}

function sanitizeValue(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeValue(entry))
      .filter((entry) => entry !== undefined);
  }
  if (typeof value !== 'object') return value;
  if (typeof File !== 'undefined' && value instanceof File) return undefined;
  if (typeof Blob !== 'undefined' && value instanceof Blob) return undefined;

  const record = value as Record<string, unknown>;
  if (isMediaLike(record)) {
    return sanitizeMedia(record) ?? undefined;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    if (key === 'file') continue;
    if (key === 'previewUrl') continue; // toutes les previews sont locales (blob:)
    const next = sanitizeValue(child);
    if (next !== undefined) sanitized[key] = next;
  }
  return sanitized;
}

/** Copie sérialisable d'un brouillon (aucun `File`, aucun `blob:`). */
export function sanitizeDraftValuesV2<T>(values: T): T {
  return sanitizeValue(values) as T;
}

function differsFromDefault(value: unknown, fallback: unknown): boolean {
  if (Array.isArray(value)) {
    if (!Array.isArray(fallback)) return value.length > 0;
    if (value.length !== fallback.length) return value.length > 0;
    return value.some((entry, index) => differsFromDefault(entry, fallback[index]));
  }
  if (value && typeof value === 'object') {
    if (!fallback || typeof fallback !== 'object' || Array.isArray(fallback)) {
      return Object.keys(value).length > 0;
    }
    const fallbackRecord = fallback as Record<string, unknown>;
    return Object.entries(value as Record<string, unknown>).some(([key, child]) =>
      differsFromDefault(child, fallbackRecord[key]),
    );
  }
  if (typeof value === 'string' && typeof fallback === 'string') {
    return value.trim() !== fallback.trim();
  }
  if (!(value === undefined || value === null)) return value !== fallback;
  return false;
}

function comparableValues(kind: CreateKindV2, values: unknown): Record<string, unknown> {
  const base = {
    ...(createDefaultsV2(kind) as Record<string, unknown>),
    ...(values && typeof values === 'object' ? (values as Record<string, unknown>) : {}),
  };
  // L'identifiant de requête n'est pas une saisie : il ne rend pas un brouillon « rempli ».
  delete base.clientRequestId;
  return base;
}

/** Le brouillon porte-t-il du contenu réel (au-delà des valeurs par défaut) ? */
export function draftHasContentV2(kind: CreateKindV2, values: unknown): boolean {
  if (!values || typeof values !== 'object') return false;
  const defaults = comparableValues(kind, createDefaultsV2(kind));
  const current = comparableValues(kind, sanitizeDraftValuesV2(values));
  return differsFromDefault(current, defaults);
}

export function readDraftV2<T = unknown>(kind: CreateKindV2): CreateDraftV2Record<T> | null {
  const store = getStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(draftStorageKey(kind));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CreateDraftV2Record<T>>;
    if (
      !parsed ||
      parsed.version !== CREATE_DRAFT_V2_VERSION ||
      parsed.kind !== kind ||
      !parsed.values ||
      typeof parsed.values !== 'object'
    ) {
      return null;
    }
    return {
      version: CREATE_DRAFT_V2_VERSION,
      kind,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      values: parsed.values as T,
    };
  } catch {
    return null;
  }
}

export function writeDraftV2<T>(kind: CreateKindV2, values: T, now = Date.now()): boolean {
  const sanitized = sanitizeDraftValuesV2(values);
  const store = getStorage();
  if (!store) return false;
  try {
    if (!draftHasContentV2(kind, sanitized)) {
      store.removeItem(draftStorageKey(kind));
      return true;
    }
    const record: CreateDraftV2Record<T> = {
      version: CREATE_DRAFT_V2_VERSION,
      kind,
      updatedAt: now,
      values: sanitized,
    };
    store.setItem(draftStorageKey(kind), JSON.stringify(record));
    return true;
  } catch {
    // Quota dépassé : on ne casse pas la saisie, la prochaine écriture réessaie.
    return false;
  }
}

export function clearDraftV2(kind: CreateKindV2): void {
  liveDrafts.delete(kind);
  const store = getStorage();
  try {
    store?.removeItem(draftStorageKey(kind));
  } catch {
    /* rien à faire : la clé sera réécrite ou purgée */
  }
}

/** Brouillons en mémoire : lus avant la fin du debounce par la confirmation. */
const liveDrafts = new Map<CreateKindV2, unknown>();

export function rememberLiveDraftV2(kind: CreateKindV2, values: unknown): void {
  liveDrafts.set(kind, values);
}

export function getLiveDraftV2<T = unknown>(kind: CreateKindV2): T | undefined {
  return liveDrafts.get(kind) as T | undefined;
}

/** Le contenu courant (mémoire) ou stocké diffère-t-il des valeurs par défaut ? */
export function hasDraftContentV2(kind: CreateKindV2): boolean {
  const live = liveDrafts.get(kind);
  if (live !== undefined) return draftHasContentV2(kind, live);
  const stored = readDraftV2(kind);
  return stored ? draftHasContentV2(kind, stored.values) : false;
}

export function flushDraftV2(kind: CreateKindV2): void {
  const live = liveDrafts.get(kind);
  if (live !== undefined) writeDraftV2(kind, live);
}

function mergeDraftValues<K extends CreateKindV2>(kind: K, draft: unknown): CreateFormValuesMapV2[K] {
  const defaults = createDefaultsV2(kind) as Record<string, unknown>;
  if (!draft || typeof draft !== 'object') return defaults as CreateFormValuesMapV2[K];
  const merged: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(draft as Record<string, unknown>)) {
    const fallback = defaults[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      fallback &&
      typeof fallback === 'object' &&
      !Array.isArray(fallback)
    ) {
      merged[key] = { ...(fallback as Record<string, unknown>), ...value };
    } else {
      merged[key] = value;
    }
  }
  if (typeof merged.clientRequestId !== 'string' || !merged.clientRequestId) {
    merged.clientRequestId = newClientRequestId();
  }
  return merged as CreateFormValuesMapV2[K];
}

export interface UseDraftV2Options<T extends FieldValues> {
  kind: CreateKindV2;
  form: UseFormReturn<T>;
  enabled?: boolean;
  debounceMs?: number;
}

export interface DraftV2Api {
  /** Un brouillon a été restauré au montage. */
  restored: boolean;
  /** La saisie courante diffère des valeurs par défaut. */
  hasContent: boolean;
  /** Efface le brouillon et remet le formulaire à neuf. */
  clear: () => void;
  /** Écrit immédiatement le dernier contenu connu (fermeture, pagehide). */
  flush: () => void;
}

export function useDraftV2<T extends FieldValues>({
  kind,
  form,
  enabled = true,
  debounceMs = CREATE_DRAFT_V2_DEBOUNCE_MS,
}: UseDraftV2Options<T>): DraftV2Api {
  const [restored, setRestored] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const hydrated = useRef(false);
  const latest = useRef<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelTimer = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const flush = useCallback(() => {
    cancelTimer();
    if (latest.current !== null) {
      writeDraftV2(kind, latest.current);
      rememberLiveDraftV2(kind, latest.current);
    }
  }, [cancelTimer, kind]);

  const clear = useCallback(() => {
    cancelTimer();
    latest.current = null;
    clearDraftV2(kind);
    setHasContent(false);
    setRestored(false);
  }, [cancelTimer, kind]);

  // Écriture à la fermeture de l'onglet / mise en arrière-plan.
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const onPageHide = () => flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, flush]);

  useEffect(() => {
    if (!enabled) return;
    const record = readDraftV2<T>(kind);
    if (record) {
      const values = mergeDraftValues(kind, record.values) as unknown as T;
      latest.current = values;
      rememberLiveDraftV2(kind, values);
      form.reset(values as never, { keepDefaultValues: true });
      setRestored(true);
      setHasContent(true);
    } else {
      const values = form.getValues();
      latest.current = values;
      rememberLiveDraftV2(kind, values);
      setHasContent(false);
    }
    hydrated.current = true;

    const subscription = form.watch((values) => {
      if (!hydrated.current) return;
      const snapshot = values as T;
      latest.current = snapshot;
      rememberLiveDraftV2(kind, snapshot);
      setHasContent(draftHasContentV2(kind, snapshot));
      cancelTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        writeDraftV2(kind, snapshot);
      }, debounceMs);
    });

    return () => {
      subscription.unsubscribe();
      hydrated.current = false;
      cancelTimer();
      if (latest.current !== null) writeDraftV2(kind, latest.current);
    };
  }, [cancelTimer, debounceMs, enabled, form, kind]);

  return { restored, hasContent, clear, flush };
}

/** Réinitialise les brouillons de tous les types (tests, déconnexion). */
export function clearAllDraftsV2(kinds: readonly CreateKindV2[]): void {
  for (const kind of kinds) clearDraftV2(kind);
}
