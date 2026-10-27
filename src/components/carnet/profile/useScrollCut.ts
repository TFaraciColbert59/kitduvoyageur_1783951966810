'use client';

import { useEffect, useState } from 'react';

/**
 * Défilement du conteneur réel d'un volet. Le carnet monte ses volets dans
 * `.ckp-card-scroll` (la carte, ou le corps du drawer) : la coupure au
 * défilement et l'en-tête collant lisent ce conteneur-là, jamais la page
 * (qui est verrouillée à 932 px). Le nœud passé peut être le conteneur
 * lui-même ou un de ses descendants.
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
    /* Le nœud peut être le conteneur qui défile (corps du drawer) ou un volet
       posé dedans (sous-drawer statistiques) : on cherche dans les deux sens. */
    const scroller = (
      node.classList.contains('ckp-card-scroll') ? node : node.closest('.ckp-card-scroll')
    ) as HTMLElement | null;
    if (!scroller) return;
    const read = () => setPast(scroller.scrollTop > threshold);
    read();
    scroller.addEventListener('scroll', read, { passive: true });
    return () => scroller.removeEventListener('scroll', read);
  }, [ref, threshold]);

  return past;
}

/**
 * Reste-t-il du contenu sous la dernière ligne visible ? C'est l'état du voile
 * de fin de course : il s'allume quand le corps défile encore et s'éteint au
 * bout. Sans conteneur, aucun voile.
 */
export function useScrollTail<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  threshold = 2,
): boolean {
  const [tail, setTail] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const scroller = (
      node.classList.contains('ckp-card-scroll') ? node : node.closest('.ckp-card-scroll')
    ) as HTMLElement | null;
    if (!scroller) return;
    const read = () =>
      setTail(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > threshold);
    read();
    const frame = window.requestAnimationFrame(read);
    scroller.addEventListener('scroll', read, { passive: true });
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => read());
    observer?.observe(scroller);
    return () => {
      window.cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', read);
      observer?.disconnect();
    };
  }, [ref, threshold]);

  return tail;
}

export default useScrollCut;
