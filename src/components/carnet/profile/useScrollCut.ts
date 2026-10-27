'use client';

import { useEffect, useState } from 'react';

/**
 * Défilement du conteneur réel d'un volet. Le carnet monte ses volets dans
 * `.ckp-card-scroll` (la carte, ou le corps du drawer) : la coupure au
 * défilement et l'en-tête collant lisent ce conteneur-là, jamais la page
 * (qui est verrouillée à 932 px).
 *
 * `threshold` est le nombre de pixels au-delà duquel l'état passe à `true`.
 * Aucune valeur n'est inventée : sans conteneur trouvé, l'état reste `false`.
 */
export function useScrollCut<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  threshold = 8,
): boolean {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const scroller = node.closest('.ckp-card-scroll') as HTMLElement | null;
    if (!scroller) return;
    const read = () => setPast(scroller.scrollTop > threshold);
    read();
    scroller.addEventListener('scroll', read, { passive: true });
    return () => scroller.removeEventListener('scroll', read);
  }, [ref, threshold]);

  return past;
}

export default useScrollCut;
