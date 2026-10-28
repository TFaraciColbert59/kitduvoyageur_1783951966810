'use client';

import { startTransition, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import { CompasLightTheme } from '@/features/compas/components/CompasLightTheme';
// Voir loading.tsx : la page d'erreur doit avoir sa feuille même si la page
// n'a jamais pu se charger.
import '@/features/compas/compas.css';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

/**
 * Le Compas n'a pas pu s'afficher (plans 2.9 et 5.1).
 *
 * Dans la langue du Compas (verre, carte d'écran vide, boutons `.cp-btn`),
 * tutoyée comme le reste de l'écran.
 *
 * Rien d'interne n'est montré (le message d'une erreur serveur peut citer une
 * table ou un service) ; seule la référence Next (`digest`) l'est, la même que
 * dans les journaux Vercel, pour qu'un signalement puisse être retrouvé. Aucune
 * équipe n'est prévenue automatiquement : la page ne le prétend pas.
 *
 * « Réessayer » relit la page côté serveur (`router.refresh`) avant de la
 * remonter : `reset` seul rejouerait le rendu client avec la même erreur.
 * Le message est annoncé tout de suite (`role="alert"`) et le titre prend le
 * focus : au clavier ou au lecteur d'écran, on arrive sur l'erreur, pas sur
 * une page muette.
 */
export default function CompasError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    console.error('[compas] rendu impossible', error.digest ?? '');
  }, [error]);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <AppShell hasBottomNav videoBackground={false}>
      <CompasLightTheme />
      <div className="compas compas--empty">
        <div className="cp-bg" aria-hidden="true" />
        <section className="cp-empty cp-sheet-glass" role="alert" aria-labelledby="cp-error-title">
          <h1 id="cp-error-title" ref={titleRef} tabIndex={-1}>
            Le Compas n’a pas pu s’afficher
          </h1>
          <p className="cp-sub" style={{ margin: 0 }}>
            Ce qui était déjà enregistré dans ton voyage n’est pas touché. Réessaie dans un instant ;
            si l’erreur revient, la référence ci-dessous permet de la retrouver.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="cp-btn cp-btn--pg" onClick={retry}>
              {/* Le pictogramme porte un nom (aria-label) : masqué, pour que le bouton s'appelle « Réessayer ». */}
              <span aria-hidden="true" style={{ display: 'inline-flex' }}>
                <LKDVIcon name="actualiser" size={16} />
              </span>
              Réessayer
            </button>
            <Link className="cp-btn cp-btn--soft" href="/hub">
              <span aria-hidden="true" style={{ display: 'inline-flex' }}>
                <LKDVIcon name="accueil" size={16} />
              </span>
              Retour au hub
            </Link>
          </div>
          {error.digest ? (
            <p className="cp-note">
              Référence : <span style={{ fontFamily: 'ui-monospace, monospace' }}>{error.digest}</span>
            </p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
