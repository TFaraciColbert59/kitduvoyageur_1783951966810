'use client';

import { useEffect, useRef } from 'react';

/**
 * Pousse une entrée d'historique tant que `active` est vrai.
 * Le geste retour iOS / bouton retour Android ferme la conversation
 * au lieu de quitter /messagerie.
 *
 * Le handler renvoyé sert à la fermeture par bouton UI : il appelle
 * `onBack` puis consomme l'entrée d'historique (le popstate qui en
 * résulte retombe sur la garde avec `pushed=false` → simple no-op,
 * pas de double fermeture). Ne pas appeler `history.back()` ici
 * exposerait un « retour fantôme » sur l'historique suivant.
 */
export function useBackGuard(active: boolean, onBack: () => void): () => void {
  const pushed = useRef(false);

  useEffect(() => {
    if (active && !pushed.current) {
      try {
        window.history.pushState({ lkdvChat: true }, '');
        pushed.current = true;
      } catch {
        // Environnements sandboxés (webview, file://) : on abandonne le
        // garde-fou historique plutôt que de crasher la navigation.
      }
    }

    const onPop = () => {
      if (pushed.current) {
        pushed.current = false;
        onBack();
      }
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [active, onBack]);

  // Fermeture par bouton UI : on consomme l'entrée d'historique.
  return () => {
    const hadEntry = pushed.current;
    pushed.current = false;
    if (hadEntry) {
      window.history.back();
    }
    onBack();
  };
}