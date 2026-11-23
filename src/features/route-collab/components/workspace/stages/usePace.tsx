'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { PerformanceProfile } from '@/features/adventure-intelligence/schemas/performance.schema';
import { describePace, paceOf } from '../../../dayReading';
import type { PaceMember } from '../../../insights/pace';

/**
 * Allure du groupe (6.4) : les durées se calculent sur le plus lent. Les allures des membres viennent du Compas
 * (profil de performance appris des sorties, 10.8) quand la page les fournit via `RoutePaceProvider` ; sinon la personne peut
 * renseigner la vitesse du plus lent à la main (mémorisée sur l'appareil). Sans rien : allure standard Naismith,
 * dite comme telle, jamais présentée comme celle du groupe.
 */
const MembersContext = createContext<readonly PaceMember[]>([]);
const PerformanceContext = createContext<PerformanceProfile | null>(null);

/**
 * `members` : allures connues (profil appris de la personne, `paceMemberFromProfile`) ; `performance` : son profil
 * complet, pour la prédiction d'effort (7.1). Sans profil, la page ne monte rien de plus : allure standard, dite.
 */
export function RoutePaceProvider({
  members,
  performance = null,
  children,
}: {
  members: readonly PaceMember[];
  performance?: PerformanceProfile | null;
  children: ReactNode;
}) {
  return (
    <MembersContext.Provider value={members}>
      <PerformanceContext.Provider value={performance}>{children}</PerformanceContext.Provider>
    </MembersContext.Provider>
  );
}

/** Profil de performance de la personne (10.8) pour la prédiction d'effort ; `null` : non personnalisée. */
export function usePerformanceProfile(): PerformanceProfile | null {
  return useContext(PerformanceContext);
}

/** Membres du groupe et leur allure déclarée (Compas), pour les moteurs qui ont besoin de chacun (effort, charge). */
export function useGroupMembers(): readonly PaceMember[] {
  return useContext(MembersContext);
}

const KEY = 'lkdv:itineraire:slowestKmh:v1';
const EVENT = 'lkdv:itineraire:slowestKmh';

function read(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const n = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function useGroupPace() {
  const members = useContext(MembersContext);
  const manual = useSyncExternalStore(subscribe, read, () => null);
  const pace = useMemo(() => paceOf(members, manual), [members, manual]);
  const allMembers = useMemo<PaceMember[]>(() => (manual ? [...members, { id: 'manual', name: 'Allure renseignée', speedKmh: manual }] : [...members]), [members, manual]);
  const setManual = useCallback((kmh: number | null) => {
    if (typeof window === 'undefined') return;
    try {
      if (kmh == null) window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, String(kmh));
    } catch {
      /* stockage indisponible : valable pour la session seulement */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { pace, manualKmh: manual, setManual, description: describePace(pace, allMembers), fromMembers: members.length > 0 };
}
