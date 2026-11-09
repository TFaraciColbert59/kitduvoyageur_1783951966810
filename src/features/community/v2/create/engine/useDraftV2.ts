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
  /**
   * Étape quittée (`{d, step}` de la maquette L2628-2636) : le tiroir rouvre sur
   * l'étape où la saisie s'est arrêtée (N1). Absent d'un brouillon v1 antérieur.
   */
  step: number;
}

/** Étape d'un brouillon : entier ≥ 0 (0 pour un enregistrement v1 sans étape). */
export function sanitizeDraftStepV2(step: unknown): number {
  const value = typeof step === 'number' && Number.isFinite(step) ? Math.trunc(step) : 0;
  return value > 0 ? value : 0;
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
      step: sanitizeDraftStepV2((parsed as { step?: unknown }).step),
    };
  } catch {
    return null;
  }
}

export function writeDraftV2<T>(
  kind: CreateKindV2,
  values: T,
  step = 0,
  now = Date.now(),
): boolean {
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
      step: sanitizeDraftStepV2(step),
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
  liveSteps.delete(kind);
  const store = getStorage();
  try {
    store?.removeItem(draftStorageKey(kind));
  } catch {
    /* rien à faire : la clé sera réécrite ou purgée */
  }
}

/** Brouillons en mémoire : lus avant la fin du debounce par la confirmation. */
const liveDrafts = new Map<CreateKindV2, unknown>();
/** Étape courante en mémoire, pour l'écriture de fermeture (sans attendre le debounce). */
const liveSteps = new Map<CreateKindV2, number>();

export function rememberLiveDraftV2(kind: CreateKindV2, values: unknown, step = 0): void {
  liveDrafts.set(kind, values);
  liveSteps.set(kind, sanitizeDraftStepV2(step));
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
  if (live !== undefined) writeDraftV2(kind, live, liveSteps.get(kind) ?? 0);
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
  /** Étape courante du moteur : écrite avec le brouillon (N1). */
  step: number;
  /** Étape lue dans le brouillon restauré (appelée une seule fois, au montage). */
  onRestoreStep?: (step: number) => void;
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
  step,
  onRestoreStep,
}: UseDraftV2Options<T>): DraftV2Api {
  const [restored, setRestored] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const hydrated = useRef(false);
  const latest = useRef<T | null>(null);
  const latestStep = useRef(sanitizeDraftStepV2(step));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // L'étape courante peut changer sans toucher aux valeurs : on la garde à jour
  // pour que toute écriture (debounce, fermeture, pagehide) la porte.
  useEffect(() => {
    latestStep.current = sanitizeDraftStepV2(step);
    if (liveDrafts.has(kind)) liveSteps.set(kind, latestStep.current);
  }, [kind, step]);

  const cancelTimer = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const flush = useCallback(() => {
    cancelTimer();
    if (latest.current !== null) {
      writeDraftV2(kind, latest.current, latestStep.current);
      rememberLiveDraftV2(kind, latest.current, latestStep.current);
    }
  }, [cancelTimer, kind]);

  const clear = useCallback(() => {
    cancelTimer();
    latest.current = null;
    latestStep.current = 0;
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
      latestStep.current = sanitizeDraftStepV2(record.step);
      rememberLiveDraftV2(kind, values, latestStep.current);
      form.reset(values as never, { keepDefaultValues: true });
      setRestored(true);
      setHasContent(true);
      // Le tiroir rouvre sur l'étape quittée (N1).
      if (latestStep.current > 0) onRestoreStep?.(latestStep.current);
    } else {
      const values = form.getValues();
      latest.current = values;
      rememberLiveDraftV2(kind, values, latestStep.current);
      setHasContent(false);
    }
    hydrated.current = true;

    const subscription = form.watch((values) => {
      if (!hydrated.current) return;
      const snapshot = values as T;
      latest.current = snapshot;
      rememberLiveDraftV2(kind, snapshot, latestStep.current);
      setHasContent(draftHasContentV2(kind, snapshot));
      cancelTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        writeDraftV2(kind, snapshot, latestStep.current);
      }, debounceMs);
    });

    return () => {
      subscription.unsubscribe();
      hydrated.current = false;
      cancelTimer();
      if (latest.current !== null) writeDraftV2(kind, latest.current, latestStep.current);
    };
    // `onRestoreStep` est lu une seule fois au montage : le stabiliser côté
    // appelant (useCallback) suffit, il ne doit pas relancer l'hydratation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelTimer, debounceMs, enabled, form, kind]);

  return { restored, hasContent, clear, flush };
}

/** Réinitialise les brouillons de tous les types (tests, déconnexion). */
export function clearAllDraftsV2(kinds: readonly CreateKindV2[]): void {
  for (const kind of kinds) clearDraftV2(kind);
}
