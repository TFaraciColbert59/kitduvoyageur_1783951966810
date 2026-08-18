/* =============================================================================
   LKDV — Hook useWidgetOrder : Drag & Drop Persistant des 6 Widgets
   =============================================================================
   Gère l'ordre des cards du cockpit avec :
   - Persistance localStorage (versionné)
   - Restauration ordre par défaut si invalide
   - Accessibilité clavier (via @hello-pangea/dnd)
   - Synchronisation cross-tab (storage event)
   ============================================================================= */

import { useState, useEffect, useCallback } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export type CardId =
  | 'depart'
  | 'kits'
  | 'oublier'
  | 'inventaire'
  | 'disponibilite'
  | 'alertes';

export const DEFAULT_CARD_ORDER: CardId[] = [
  'depart',      // Prochain départ (large)
  'kits',        // Mes Kits (large)
  'oublier',     // À ne pas oublier (large)
  'inventaire',  // Inventaire & Catalogue (large)
  'disponibilite', // Disponibilité (compact)
  'alertes',     // Alertes (compact)
];

const STORAGE_KEY = 'lkdv_cockpit_widget_order_v2';
const STORAGE_VERSION = 2;

interface UseWidgetOrderOptions {
  onOrderChange?: (newOrder: CardId[]) => void;
  storageKey?: string;
}

export function useWidgetOrder(options: UseWidgetOrderOptions = {}) {
  const { onOrderChange, storageKey = STORAGE_KEY } = options;
  const { triggerHaptic } = useHapticFeedback();

  const [cardOrder, setCardOrder] = useState<CardId[]>(DEFAULT_CARD_ORDER);
  const [isInitialized, setIsInitialized] = useState(false);

  // Charger l'ordre depuis localStorage au montage
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validation : doit être un array de 6 CardId uniques
        if (
          Array.isArray(parsed) &&
          parsed.length === 6 &&
          new Set(parsed).size === 6 &&
          parsed.every((id: string) => DEFAULT_CARD_ORDER.includes(id as CardId))
        ) {
          setCardOrder(parsed as CardId[]);
        } else {
          // Invalide → reset vers défaut
          localStorage.setItem(storageKey, JSON.stringify(DEFAULT_CARD_ORDER));
          setCardOrder(DEFAULT_CARD_ORDER);
        }
      } catch (e) {
        // Erreur parsing → défaut
        localStorage.setItem(storageKey, JSON.stringify(DEFAULT_CARD_ORDER));
        setCardOrder(DEFAULT_CARD_ORDER);
      }
    }
    setIsInitialized(true);
  }, [storageKey]);

  // Sauvegarder à chaque changement
  const persistOrder = useCallback((newOrder: CardId[]) => {
    localStorage.setItem(storageKey, JSON.stringify(newOrder));
    onOrderChange?.(newOrder);
  }, [storageKey, onOrderChange]);

  // Handler drag & drop (compatible @hello-pangea/dnd)
  const handleDragEnd = useCallback((result: any) => {
    // result vient de @hello-pangea/dnd
    if (!result.destination) return;

    const items = Array.from(cardOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setCardOrder(items);
    persistOrder(items);
    triggerHaptic('selection');
  }, [cardOrder, persistOrder, triggerHaptic]);

  // Réordonner programmatiquement
  const moveCard = useCallback((cardId: CardId, newIndex: number) => {
    setCardOrder(prev => {
      const currentIndex = prev.indexOf(cardId);
      if (currentIndex === -1 || currentIndex === newIndex) return prev;

      const items = Array.from(prev);
      const [moved] = items.splice(currentIndex, 1);
      items.splice(newIndex, 0, moved);

      persistOrder(items);
      triggerHaptic('selection');
      return items;
    });
  }, [persistOrder, triggerHaptic]);

  // Remettre un card au début
  const moveToTop = useCallback((cardId: CardId) => {
    moveCard(cardId, 0);
  }, [moveCard]);

  // Remettre un card à la fin
  const moveToBottom = useCallback((cardId: CardId) => {
    moveCard(cardId, 5);
  }, [moveCard]);

  // Reset vers ordre par défaut
  const resetToDefault = useCallback(() => {
    setCardOrder(DEFAULT_CARD_ORDER);
    persistOrder(DEFAULT_CARD_ORDER);
    triggerHaptic('success');
  }, [persistOrder, triggerHaptic]);

  // Synchronisation cross-tab (autre onglet a modifié l'ordre)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (
            Array.isArray(parsed) &&
            parsed.length === 6 &&
            new Set(parsed).size === 6 &&
            parsed.every((id: string) => DEFAULT_CARD_ORDER.includes(id as CardId))
          ) {
            setCardOrder(parsed as CardId[]);
          }
        } catch (e) {
          // Ignorer erreurs cross-tab
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storageKey]);

  // Helpers pour layout
  const isLargeCard = useCallback((cardId: CardId) => {
    return cardId === 'depart' || cardId === 'kits' || cardId === 'oublier' || cardId === 'inventaire';
  }, []);

  const getCardSizeClass = useCallback((cardId: CardId) => {
    return isLargeCard(cardId) ? 'md:col-span-2' : 'md:col-span-1';
  }, [isLargeCard]);

  return {
    // État
    cardOrder,
    isInitialized,
    defaultOrder: DEFAULT_CARD_ORDER,

    // Actions
    handleDragEnd,
    moveCard,
    moveToTop,
    moveToBottom,
    resetToDefault,
    setCardOrder: (newOrder: CardId[]) => {
      setCardOrder(newOrder);
      persistOrder(newOrder);
    },

    // Helpers layout
    isLargeCard,
    getCardSizeClass,

    // Utils
    getCardIndex: (cardId: CardId) => cardOrder.indexOf(cardId),
    isFirst: (cardId: CardId) => cardOrder[0] === cardId,
    isLast: (cardId: CardId) => cardOrder[5] === cardId,
  };
}

/* ---------- Types pour @hello-pangea/dnd ---------- */
export interface DragEndResult {
  draggableId: string;
  type: string;
  source: {
    droppableId: string;
    index: number;
  };
  destination?: {
    droppableId: string;
    index: number;
  };
  reason: 'DROP' | 'CANCEL';
}