/* =============================================================================
   LKDV — Hook useWidgetExpansion : Animation Expansion Cinématique Fullscreen
   =============================================================================
   Gère l'ouverture/fermeture des 6 widgets en fullscreen avec :
   - Shared layout animation (Framer Motion layoutId)
   - Expansion depuis la position réelle de la card (420-600ms)
   - Stagger contenu (60-140ms par groupe)
   - prefers-reduced-motion respecté
   - Focus trap + Escape + focus restauré
   - Scroll arrière-plan bloqué
   - Drag & drop désactivé pendant animation + fullscreen
   ============================================================================= */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

export type CardId =
  | 'depart'
  | 'kits'
  | 'oublier'
  | 'inventaire'
  | 'disponibilite'
  | 'alertes';

export interface WidgetExpansionState {
  expandedCard: CardId | null;
  isAnimating: boolean;
  animationDirection: 'enter' | 'exit' | 'idle';
  previousCardRect: DOMRect | null;
}

interface UseWidgetExpansionOptions {
  onExpandStart?: (cardId: CardId) => void;
  onExpandComplete?: (cardId: CardId) => void;
  onCollapseStart?: (cardId: CardId) => void;
  onCollapseComplete?: (cardId: CardId) => void;
  reduceMotionFallback?: boolean; // Si true, ouvre/ferme instantanément sans animation
}

const EXPAND_DURATION_MS = 500;    // 420-600ms cible
const COLLAPSE_DURATION_MS = 400;  // 320-480ms cible
const CONTENT_STAGGER_DELAY = 80;  // 60-140ms par groupe

export function useWidgetExpansion(options: UseWidgetExpansionOptions = {}) {
  const {
    onExpandStart,
    onExpandComplete,
    onCollapseStart,
    onCollapseComplete,
    reduceMotionFallback = true,
  } = options;

  const prefersReducedMotion = useReducedMotion();
  const [state, setState] = useState<WidgetExpansionState>({
    expandedCard: null,
    isAnimating: false,
    animationDirection: 'idle',
    previousCardRect: null,
  });

  const cardRefs = useRef<Map<CardId, HTMLDivElement>>(new Map());
  const contentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const focusRestoreTarget = useRef<HTMLElement | null>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enregistrer la ref d'une card
  const registerCardRef = useCallback((cardId: CardId, element: HTMLDivElement | null) => {
    if (element) {
      cardRefs.current.set(cardId, element);
    } else {
      cardRefs.current.delete(cardId);
    }
  }, []);

  // Enregistrer la ref d'un élément de contenu (pour stagger)
  const registerContentRef = useCallback((key: string, element: HTMLDivElement | null) => {
    if (element) {
      contentRefs.current.set(key, element);
    } else {
      contentRefs.current.delete(key);
    }
  }, []);

  // Ouvrir une card en fullscreen
  const expandCard = useCallback((cardId: CardId) => {
    const cardElement = cardRefs.current.get(cardId);
    if (!cardElement) return;

    // Capturer la position AVANT l'expansion
    const rect = cardElement.getBoundingClientRect();

    // Désactiver drag & drop globalement
    document.body.style.setProperty('--dnd-disabled', 'true');

    // Bloquer scroll arrière-plan
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Focus target pour restauration
    const expandBtn = cardElement.querySelector('[aria-label^="Agrandir"]') as HTMLElement;
    if (expandBtn) focusRestoreTarget.current = expandBtn;

    // Callback début
    onExpandStart?.(cardId);

    // Mode reduced motion : instantané
    if (prefersReducedMotion || reduceMotionFallback) {
      setState({
        expandedCard: cardId,
        isAnimating: false,
        animationDirection: 'idle',
        previousCardRect: rect,
      });
      onExpandComplete?.(cardId);
      return;
    }

    // Animation complète
    setState({
      expandedCard: cardId,
      isAnimating: true,
      animationDirection: 'enter',
      previousCardRect: rect,
    });

    // Nettoyer timeout précédent
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    // Durée totale = expansion + stagger contenu
    const totalDuration = EXPAND_DURATION_MS + CONTENT_STAGGER_DELAY * 3;

    animationTimeoutRef.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        isAnimating: false,
        animationDirection: 'idle',
      }));
      onExpandComplete?.(cardId);
    }, totalDuration);
  }, [prefersReducedMotion, reduceMotionFallback, onExpandStart, onExpandComplete]);

  // Fermer le fullscreen
  const collapseCard = useCallback(() => {
    const currentCard = state.expandedCard;
    if (!currentCard) return;

    const cardElement = cardRefs.current.get(currentCard);

    // Callback début
    onCollapseStart?.(currentCard);

    // Mode reduced motion : instantané
    if (prefersReducedMotion || reduceMotionFallback) {
      // Restaurer scroll
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.removeProperty('--dnd-disabled');

      // Restaurer focus
      if (focusRestoreTarget.current) {
        focusRestoreTarget.current.focus();
        focusRestoreTarget.current = null;
      }

      setState({
        expandedCard: null,
        isAnimating: false,
        animationDirection: 'idle',
        previousCardRect: null,
      });
      onCollapseComplete?.(currentCard);
      return;
    }

    // Animation de fermeture
    setState(prev => ({
      ...prev,
      isAnimating: true,
      animationDirection: 'exit',
    }));

    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    animationTimeoutRef.current = setTimeout(() => {
      // Restaurer scroll
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.removeProperty('--dnd-disabled');

      // Restaurer focus sur le bouton Agrandir d'origine
      if (focusRestoreTarget.current) {
        focusRestoreTarget.current.focus();
        focusRestoreTarget.current = null;
      }

      setState({
        expandedCard: null,
        isAnimating: false,
        animationDirection: 'idle',
        previousCardRect: null,
      });
      onCollapseComplete?.(currentCard);
    }, COLLAPSE_DURATION_MS);
  }, [state.expandedCard, prefersReducedMotion, reduceMotionFallback, onCollapseStart, onCollapseComplete]);

  // Toggle (pour compatibilité)
  const toggleCard = useCallback((cardId: CardId) => {
    if (state.expandedCard === cardId) {
      collapseCard();
    } else {
      expandCard(cardId);
    }
  }, [state.expandedCard, expandCard, collapseCard]);

  // Gestion Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.expandedCard) {
        collapseCard();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [state.expandedCard, collapseCard]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.removeProperty('--dnd-disabled');
    };
  }, []);

  // Helpers pour Framer Motion
  const getContainerTransition = useCallback(() => ({
    type: 'spring' as const,
    stiffness: 280,
    damping: 28,
    duration: prefersReducedMotion ? 0 : EXPAND_DURATION_MS / 1000,
  }), [prefersReducedMotion]);

  const getContentTransition = useCallback((delayIndex: number) => ({
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
    delay: prefersReducedMotion ? 0 : (EXPAND_DURATION_MS / 1000) * 0.3 + delayIndex * (CONTENT_STAGGER_DELAY / 1000),
    duration: prefersReducedMotion ? 0 : 0.3,
  }), [prefersReducedMotion]);

  const getBackdropTransition = useCallback(() => ({
    duration: prefersReducedMotion ? 0 : 0.2,
    ease: [0.16, 1, 0.3, 1] as const,
  }), [prefersReducedMotion]);

  return {
    // État
    expandedCard: state.expandedCard,
    isAnimating: state.isAnimating,
    animationDirection: state.animationDirection,
    previousCardRect: state.previousCardRect,
    prefersReducedMotion,

    // Actions
    expandCard,
    collapseCard,
    toggleCard,
    registerCardRef,
    registerContentRef,

    // Transitions Framer Motion
    getContainerTransition,
    getContentTransition,
    getBackdropTransition,

    // Utils
    isCardExpanded: (cardId: CardId) => state.expandedCard === cardId,
    isAnyExpanded: !!state.expandedCard,
  };
}

/* ---------- Hook complémentaire : Focus Trap pour fullscreen ---------- */
export function useFocusTrap(active: boolean, containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus initial sur le premier élément
    firstElement?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTab);
    return () => container.removeEventListener('keydown', handleTab);
  }, [active, containerRef]);
}