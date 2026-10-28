'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { LKDVIcon } from '@/components/ui/LKDVIcon';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-[color:var(--card-tint-strong)] border border-[color:var(--glass-border)] shadow-elevation-1 backdrop-blur-[var(--blur-lg)] rounded-[var(--lkv-radius-lg)] p-8 max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-[var(--lkv-surface)] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <LKDVIcon name="alerte" size={32} className="w-8 h-8 text-[color:var(--lkv-text-primary)]" />
        </div>
        <h2 className="text-2xl font-display font-bold tracking-tight text-[color:var(--lkv-text-primary)]">Une erreur est survenue</h2>
        <p className="text-[var(--lkv-text-muted)]">
          Nous n&apos;avons pas pu charger cette page. Veuillez réessayer.
        </p>
        <div className="flex flex-col gap-3 pt-4">
          <Button variant="primary" onClick={() => reset()}>
            Réessayer
          </Button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-[var(--space-2)] min-h-[var(--lkv-touch-min)] rounded-full px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--lkv-text-footnote)] font-semibold backdrop-blur-[var(--blur-md)] border border-[color:var(--glass-border)] bg-[color:var(--btn-tint)] text-[color:var(--btn-content)] shadow-elevation-1"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
