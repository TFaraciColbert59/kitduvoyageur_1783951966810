'use client';

import { startTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import { ErrorState } from '@/components/ui';
import { CompasLightTheme } from '@/features/compas/components/CompasLightTheme';

/**
 * Le Compas n'a pas pu s'afficher (plan 2.9).
 *
 * Rien d'interne n'est montré (le message d'une erreur serveur peut citer une
 * table ou un service) ; seule la référence Next (`digest`) l'est, la même que
 * dans les journaux Vercel, pour qu'un signalement puisse être retrouvé. Aucune
 * équipe n'est prévenue automatiquement : la page ne le prétend pas.
 *
 * « Réessayer » relit la page côté serveur (`router.refresh`) avant de la
 * remonter : `reset` seul rejouerait le rendu client avec la même erreur.
 */
export default function CompasError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[compas] rendu impossible', error.digest ?? '');
  }, [error]);

  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <AppShell hasBottomNav videoBackground={false}>
      <CompasLightTheme />
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState
          title="Le Compas n’a pas pu s’afficher"
          message="Ce qui était déjà enregistré dans votre voyage n’est pas touché. Réessayez dans un instant ; si l’erreur revient, la référence ci-dessous permet de la retrouver."
          onRetry={retry}
        />
        {error.digest ? (
          <p className="mt-4 text-center text-xs text-[color:var(--lkv-text-secondary)]">
            Référence : <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
