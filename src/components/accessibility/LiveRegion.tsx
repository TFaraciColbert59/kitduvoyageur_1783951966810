'use client';

/**
 * Live-region ARIA et contexte d'annonce pour VoiceOver / TalkBack (Lot O02-UI).
 *
 * Le contrat `@/features/accessibility` fournit l'annonceur (déduplication,
 * nettoyage, historique). Ce module l'expose à l'arbre React :
 * - `ScreenReaderAnnouncerProvider` partage une instance (ou une instance de test) ;
 * - `useAnnouncer` donne `announce` / `clear` sans recréer de région ;
 * - `LiveRegion` rend une région explicite, utile quand un écran doit maîtriser
 *   son propre texte (chargement, résultat, erreur).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import {
  getSharedAnnouncer,
  type AnnouncementOptions,
  type AriaLivePoliteness,
  type ScreenReaderAnnouncer,
} from '@/features/accessibility';

export interface AnnouncerContextValue {
  announce: (message: string, options?: AnnouncementOptions) => boolean;
  clear: () => void;
  announcer: ScreenReaderAnnouncer;
}

const AnnouncerContext = createContext<AnnouncerContextValue | null>(null);

export interface ScreenReaderAnnouncerProviderProps {
  children: ReactNode;
  /** Instance injectable (tests, SSR) ; par défaut l'annonceur partagé. */
  announcer?: ScreenReaderAnnouncer;
}

export function ScreenReaderAnnouncerProvider({
  children,
  announcer,
}: ScreenReaderAnnouncerProviderProps) {
  const value = useMemo<AnnouncerContextValue>(() => {
    const instance = announcer ?? getSharedAnnouncer();
    return {
      announcer: instance,
      announce: (message, options) => instance.announce(message, options),
      clear: () => instance.clear(),
    };
  }, [announcer]);

  return <AnnouncerContext.Provider value={value}>{children}</AnnouncerContext.Provider>;
}

export function useAnnouncer(): AnnouncerContextValue {
  const context = useContext(AnnouncerContext);
  const fallback = useMemo<AnnouncerContextValue>(() => {
    const instance = getSharedAnnouncer();
    return {
      announcer: instance,
      announce: (message, options) => instance.announce(message, options),
      clear: () => instance.clear(),
    };
  }, []);
  return context ?? fallback;
}

export interface LiveRegionProps {
  /** Texte à annoncer. `null` / vide efface la région. */
  message?: string | null;
  /** `off` crée une région muette, utile pour un conteneur désactivé. */
  politeness?: AriaLivePoliteness;
  /** Annonce le contenu entier à chaque changement (défaut : true). */
  atomic?: boolean;
  /** Force un rôle explicite ; sinon `status` (poli) ou `alert` (assertif). */
  role?: 'status' | 'alert' | 'none';
  /** Rend la région visible (défaut : masquée aux voyants, lue par les lecteurs). */
  visible?: boolean;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

const VISUALLY_HIDDEN: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export function LiveRegion({
  message = '',
  politeness = 'polite',
  atomic = true,
  role,
  visible = false,
  id,
  className,
  'aria-label': ariaLabel,
}: LiveRegionProps) {
  const resolvedRole = role ?? (politeness === 'assertive' ? 'alert' : politeness === 'polite' ? 'status' : undefined);

  return (
    <div
      id={id}
      className={className}
      style={visible ? undefined : VISUALLY_HIDDEN}
      role={resolvedRole}
      aria-live={politeness}
      aria-atomic={atomic ? 'true' : 'false'}
      aria-label={ariaLabel}
      data-lkdv-live-region={politeness}
    >
      {message ?? ''}
    </div>
  );
}

export interface UseLiveAnnouncementResult {
  message: string;
  politeness: AriaLivePoliteness;
  announce: (message: string, politeness?: AriaLivePoliteness) => void;
  clear: () => void;
}

/**
 * Petit état local pour piloter une `LiveRegion` : le message reste affiché
 * jusqu'au prochain `announce` ou `clear`.
 */
export function useLiveAnnouncement(initialMessage = ''): UseLiveAnnouncementResult {
  const [state, setState] = React.useState<{ message: string; politeness: AriaLivePoliteness }>({
    message: initialMessage,
    politeness: 'polite',
  });

  const announce = useCallback((message: string, politeness: AriaLivePoliteness = 'polite') => {
    setState({ message, politeness });
  }, []);

  const clear = useCallback(() => {
    setState((current) => ({ ...current, message: '' }));
  }, []);

  return { message: state.message, politeness: state.politeness, announce, clear };
}

export default LiveRegion;
