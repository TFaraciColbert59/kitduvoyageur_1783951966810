'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import s from './crm.module.css';
import { Button } from './button';
import { IconRefresh } from './icons';

/**
 * État d'erreur : cause en mots simples, solution, « Réessayer ».
 * Ne montre jamais de code technique brut.
 */
export function ErrorState({
  cause,
  solution,
  onRetry
}: {
  cause: string;
  solution?: string;
  onRetry?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div className={s.empty} role="alert">
      <span className={s.emptyTitle}>Impossible d’afficher cette partie</span>
      <span className={s.muted}>{cause}</span>
      {solution ? <span className={s.muted}>{solution}</span> : null}
      {localError ? <span className={s.fieldErr}>{localError}</span> : null}
      <Button
        tone="soft"
        icon={<IconRefresh />}
        disabled={pending}
        onClick={() => {
          setLocalError(null);
          if (onRetry) {
            onRetry();
            return;
          }
          try {
            startTransition(() => router.refresh());
          } catch {
            setLocalError('La nouvelle tentative a échoué. Vérifiez votre connexion puis réessayez.');
          }
        }}
      >
        {pending ? 'Nouvelle tentative…' : 'Réessayer'}
      </Button>
    </div>
  );
}
