'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { createDefaults, type CreateKind } from './createSchemas';

/**
 * Brouillon local des formulaires de création.
 *
 * - une clé par type et par version : `lkdv.create-draft:<draftKey>:v1` ;
 * - aucune donnée non sérialisable : le `File` est retiré, les aperçus `blob:`
 *   (morts après rechargement) sont vidés, et un média jamais envoyé est
 *   écarté — impossible de le restaurer ;
 * - un brouillon vide n’est jamais écrit, donc les valeurs par défaut ne
 *   peuvent pas écraser un brouillon existant ;
 * - l’écriture est débattue (400 ms) et vidée à la fermeture ou au démontage.
 */

export const CREATE_DRAFT_VERSION = 1;
export const CREATE_DRAFT_STORAGE_PREFIX = 'lkdv.create-draft';
export const CREATE_DRAFT_DEBOUNCE_MS = 400;

export interface CreateDraftRecord<T = unknown> {
  version: number;
  draftKey: string;
  updatedAt: number;
  values: T;
}

type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getStorage(): DraftStorage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    // Safari privé / origine opaque : le brouillon local n’est pas disponible.
    return null;
  }
}

export function createDraftStorageKey(draftKey: string, version = CREATE_DRAFT_VERSION): string {
  return `${CREATE_DRAFT_STORAGE_PREFIX}:${draftKey}:v${version}`;
}

/** Brouillons en mémoire : lus avant la fin du debounce par la confirmation de fermeture. */
const liveDrafts = new Map<string, unknown>();
const submittingDrafts = new Set<string>();

export function getLiveCreateDraft<T = unknown>(draftKey: string): T | undefined {
  return liveDrafts.get(draftKey) as T | undefined;
}

export function rememberLiveCreateDraft(draftKey: string, values: unknown): void {
  liveDrafts.set(draftKey, values);
}

export function forgetLiveCreateDraft(draftKey: string): void {
  liveDrafts.delete(draftKey);
}

/**
 * Une soumission est en cours : la fermeture qui suit un succès ne doit pas
 * demander confirmation (le brouillon est effacé dès la résolution).
 */
export function setCreateDraftSubmitting(draftKey: string | undefined, value: boolean): void {
  if (!draftKey) return;
  if (value) submittingDrafts.add(draftKey);
  else submittingDrafts.delete(draftKey);
}

export function isCreateDraftSubmitting(draftKey: string | undefined): boolean {
  return draftKey ? submittingDrafts.has(draftKey) : false;
}

function isMediaLike(value: Record<string, unknown>): boolean {
  return (
    typeof value.name === 'string' &&
    typeof value.type === 'string' &&
    typeof value.status === 'string' &&
    typeof value.size === 'number'
  );
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
    const url = typeof record.url === 'string' && record.url.trim() ? record.url.trim() : '';
    // Un média local n’a pas de fichier après rechargement : il ne peut pas
    // être restauré, donc il n’entre pas dans le brouillon.
    if (!url) return undefined;
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
    };
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    if (key === 'file') continue;
    if (key === 'previewUrl' && typeof child === 'string' && child.startsWith('blob:')) {
      sanitized[key] = '';
      continue;
    }
    const next = sanitizeValue(child);
    if (next !== undefined) sanitized[key] = next;
  }
  return sanitized;
}

/** Copie sérialisable d’un brouillon (aucun `File`, aucun `blob:`). */
export function sanitizeCreateDraftValues<T>(values: T): T {
  return sanitizeValue(values) as T;
}

function isMeanish(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return value !== 0;
  return Boolean(value);
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

/** Le brouillon porte-t-il du contenu réel (au-delà des valeurs par défaut) ? */
export function draftHasContent(kind: CreateKind, values: unknown): boolean {
  if (!values || typeof values !== 'object') return false;
  const defaults = createDefaults(kind) as unknown;
  return differsFromDefault(sanitizeCreateDraftValues(values), defaults);
}

export function isCreateDraftEmpty(kind: CreateKind, values: unknown): boolean {
  return !draftHasContent(kind, values);
}

export function readCreateDraft<T = unknown>(draftKey: string): CreateDraftRecord<T> | null {
  const store = getStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(createDraftStorageKey(draftKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CreateDraftRecord<T>>;
    if (
      !parsed ||
      parsed.version !== CREATE_DRAFT_VERSION ||
      parsed.draftKey !== draftKey ||
      !parsed.values ||
      typeof parsed.values !== 'object'
    ) {
      return null;
    }
    return {
      version: CREATE_DRAFT_VERSION,
      draftKey,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      values: parsed.values as T,
    };
  } catch {
    return null;
  }
}

export function writeCreateDraft<T>(
  draftKey: string,
  kind: CreateKind,
  values: T,
  now = Date.now(),
): boolean {
  const sanitized = sanitizeCreateDraftValues(values);
  const store = getStorage();
  if (!store) return false;
  try {
    if (isCreateDraftEmpty(kind, sanitized)) {
      store.removeItem(createDraftStorageKey(draftKey));
      return true;
    }
    const record: CreateDraftRecord<T> = {
      version: CREATE_DRAFT_VERSION,
      draftKey,
      updatedAt: now,
      values: sanitized,
    };
    store.setItem(createDraftStorageKey(draftKey), JSON.stringify(record));
    return true;
  } catch {
    // Quota dépassé : on ne casse pas la saisie, le brouillon suivant réessaie.
    return false;
  }
}

export function clearCreateDraft(draftKey: string): void {
  liveDrafts.delete(draftKey);
  const store = getStorage();
  try {
    store?.removeItem(createDraftStorageKey(draftKey));
  } catch {
    /* rien à faire : la clé sera réécrite ou purgée */
  }
}

/** Écrit immédiatement le dernier contenu connu (fermeture, démontage). */
export function flushCreateDraft(draftKey: string, kind: CreateKind): void {
  const live = liveDrafts.get(draftKey);
  if (live !== undefined) writeCreateDraft(draftKey, kind, live);
}

/** Contenu non vide, y compris quand le debounce n’a pas encore écrit. */
export function hasCreateDraftContent(draftKey: string, kind: CreateKind): boolean {
  const live = liveDrafts.get(draftKey);
  if (live !== undefined) return draftHasContent(kind, live);
  const stored = readCreateDraft(draftKey);
  return stored ? draftHasContent(kind, stored.values) : false;
}

function mergeDraftValues<T>(kind: CreateKind, draft: unknown): T {
  const defaults = createDefaults(kind) as Record<string, unknown>;
  if (!draft || typeof draft !== 'object') return defaults as T;
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
  return merged as T;
}

export interface UseCreateDraftOptions<T extends FieldValues> {
  kind: CreateKind;
  draftKey: string;
  form: UseFormReturn<T>;
  enabled?: boolean;
  debounceMs?: number;
}

export interface CreateDraftApi {
  /** Un brouillon a été restauré au montage. */
  restored: boolean;
  /** Le contenu courant diffère des valeurs par défaut. */
  hasContent: boolean;
  clear: () => void;
  flush: () => void;
}

export function useCreateDraft<T extends FieldValues>({
  kind,
  draftKey,
  form,
  enabled = true,
  debounceMs = CREATE_DRAFT_DEBOUNCE_MS,
}: UseCreateDraftOptions<T>): CreateDraftApi {
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
      writeCreateDraft(draftKey, kind, latest.current);
    }
  }, [cancelTimer, draftKey, kind]);

  const clear = useCallback(() => {
    cancelTimer();
    latest.current = null;
    clearCreateDraft(draftKey);
    setHasContent(false);
  }, [cancelTimer, draftKey]);

  useEffect(() => {
    if (!enabled) return;
    const record = readCreateDraft<T>(draftKey);
    if (record) {
      const values = mergeDraftValues<T>(kind, record.values);
      latest.current = values;
      rememberLiveCreateDraft(draftKey, values);
      // `reset` conserve les valeurs par défaut du moteur : le brouillon
      // n’est jamais écrasé par elles au premier rendu.
      form.reset(values, { keepDefaultValues: true });
      setRestored(true);
      setHasContent(true);
    } else {
      const defaults = form.getValues();
      latest.current = defaults;
      rememberLiveCreateDraft(draftKey, defaults);
      setHasContent(false);
    }
    hydrated.current = true;

    const subscription = form.watch((values) => {
      if (!hydrated.current) return;
      const snapshot = values as T;
      latest.current = snapshot;
      rememberLiveCreateDraft(draftKey, snapshot);
      setHasContent(draftHasContent(kind, snapshot));
      cancelTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        writeCreateDraft(draftKey, kind, snapshot);
      }, debounceMs);
    });

    return () => {
      subscription.unsubscribe();
      hydrated.current = false;
      cancelTimer();
      if (latest.current !== null) {
        writeCreateDraft(draftKey, kind, latest.current);
      }
    };
  }, [cancelTimer, debounceMs, draftKey, enabled, form, kind]);

  return { restored, hasContent, clear, flush };
}
