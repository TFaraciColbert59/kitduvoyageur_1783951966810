'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CarnetDetail } from './types';

/** Pastille « À la une » : un voyageur ou une étape clé (spec 01 § 1.2, 5 au plus). */
export interface CarnetHighlight {
  id: string;
  kind: 'crew' | 'etape';
  label: string;
  /** `userId` du voyageur ou `id` de l'étape. */
  refId: string;
  /** Sous-titre lu par l'édition (rôle du voyageur, route de l'étape). */
  hint: string | null;
}

export const MAX_HIGHLIGHTS = 5;
const LABEL_MAX = 24;

interface Prefs {
  hidden: string[];
  labels: Record<string, string>;
}

const EMPTY_PREFS: Prefs = { hidden: [], labels: {} };

const ROLE_FR: Record<string, string> = {
  author: 'Auteur',
  collaborator: 'Contributeur',
  participant: 'Participant',
};

/** Voyageurs d'abord (3 au plus), puis les arrivées d'étape jusqu'à cinq pastilles. */
export function buildDefaultHighlights(
  detail: Pick<CarnetDetail, 'participants' | 'etapes'>
): CarnetHighlight[] {
  const list: CarnetHighlight[] = detail.participants.slice(0, 3).map((p) => ({
    id: `crew-${p.userId}`,
    kind: 'crew' as const,
    label: (p.name || p.handle || 'Voyageur').split(' ')[0],
    refId: p.userId,
    hint: ROLE_FR[p.role] ?? null,
  }));
  for (const etape of detail.etapes) {
    if (list.length >= MAX_HIGHLIGHTS) break;
    const label = etape.to?.trim();
    if (!label) continue;
    list.push({
      id: `etape-${etape.id}`,
      kind: 'etape',
      label,
      refId: etape.id,
      hint: [etape.from, etape.to].filter(Boolean).join(' → ') || null,
    });
  }
  return list;
}

/** Applique les retraits et renommages de l'utilisateur ; un titre vide est ignoré. */
export function applyHighlightPrefs(list: CarnetHighlight[], prefs: Prefs): CarnetHighlight[] {
  return list
    .filter((item) => !prefs.hidden.includes(item.id))
    .map((item) => {
      const renamed = prefs.labels[item.id]?.trim();
      return renamed ? { ...item, label: renamed.slice(0, LABEL_MAX) } : item;
    });
}

const storageKey = (carnetId: string) => `lkdv:carnet:${carnetId}:highlights`;

function readPrefs(carnetId: string): Prefs {
  if (typeof window === 'undefined') return EMPTY_PREFS;
  try {
    const raw = window.localStorage.getItem(storageKey(carnetId));
    if (!raw) return EMPTY_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((v) => typeof v === 'string') : [],
      labels:
        parsed.labels && typeof parsed.labels === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.labels).filter(
                (entry): entry is [string, string] => typeof entry[1] === 'string'
              )
            )
          : {},
    };
  } catch {
    return EMPTY_PREFS;
  }
}

/**
 * Pastilles « À la une » du carnet. Les retraits et renommages sont gardés sur
 * l'appareil (aucune table serveur de sélection : écart documenté).
 */
export function useCarnetHighlights(detail: CarnetDetail) {
  const [prefs, setPrefs] = useState<Prefs>(EMPTY_PREFS);

  useEffect(() => {
    setPrefs(readPrefs(detail.id));
  }, [detail.id]);

  const persist = useCallback(
    (next: Prefs) => {
      setPrefs(next);
      try {
        window.localStorage.setItem(storageKey(detail.id), JSON.stringify(next));
      } catch {
        /* stockage plein ou refusé : l'état de session reste valable */
      }
    },
    [detail.id]
  );

  const base = useMemo(() => buildDefaultHighlights(detail), [detail]);
  const highlights = useMemo(() => applyHighlightPrefs(base, prefs), [base, prefs]);

  const rename = useCallback(
    (id: string, label: string) =>
      persist({ ...prefs, labels: { ...prefs.labels, [id]: label.trim().slice(0, LABEL_MAX) } }),
    [persist, prefs]
  );
  const remove = useCallback(
    (id: string) => persist({ ...prefs, hidden: [...new Set([...prefs.hidden, id])] }),
    [persist, prefs]
  );
  const restore = useCallback(
    (id: string) => persist({ ...prefs, hidden: prefs.hidden.filter((h) => h !== id) }),
    [persist, prefs]
  );

  return { highlights, rename, remove, restore };
}
