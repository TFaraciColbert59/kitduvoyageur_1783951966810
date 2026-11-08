'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Mémoire de session des tiroirs Explorer/Création.
 *
 * `00-MISSION.md` § 3 : volet, filtre, tri, requête et position de défilement sont
 * conservés à la réouverture pendant la session — état en mémoire uniquement, pas
 * de `localStorage` ni de `sessionStorage`. La carte vit au niveau du module : elle
 * survit au démontage/remontage des tiroirs (les deux tiroirs sont montés à la
 * première ouverture puis conservés, mais un changement de route les démonte).
 */

const memory = new Map<string, unknown>();

export function readSessionMemory<T>(key: string, fallback: T): T {
  return memory.has(key) ? (memory.get(key) as T) : fallback;
}

export function writeSessionMemory<T>(key: string, value: T): void {
  memory.set(key, value);
}

export function clearSessionMemory(prefix: string): void {
  for (const key of Array.from(memory.keys())) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

/** État React mémorisé pour la session (valeur initiale écrasée par la mémoire). */
export function useSessionMemory<T>(
  key: string,
  initial: T,
): [T, (next: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readSessionMemory(key, initial));
  const set = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved =
          typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
        memory.set(key, resolved);
        return resolved;
      });
    },
    [key],
  );
  return [value, set];
}

/**
 * Mémorise la position de défilement d'une pane (et la restaure au remontage).
 * Le scroll est écrit au plus une fois toutes les 200 ms, puis au démontage.
 */
export function useScrollMemory<T extends HTMLElement = HTMLDivElement>(
  key: string,
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const savedRef = useRef<number>(readSessionMemory(`${key}:scroll`, 0));

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const top = readSessionMemory<number>(`${key}:scroll`, 0);
    if (top > 0) {
      node.scrollTop = top;
      savedRef.current = top;
    }
  }, [key]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let timeout: number | null = null;
    const onScroll = () => {
      if (timeout != null) return;
      timeout = window.setTimeout(() => {
        timeout = null;
        savedRef.current = node.scrollTop;
        memory.set(`${key}:scroll`, node.scrollTop);
      }, 200);
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      node.removeEventListener('scroll', onScroll);
      if (timeout != null) window.clearTimeout(timeout);
      memory.set(`${key}:scroll`, node.scrollTop);
    };
  }, [key]);

  return ref;
}
