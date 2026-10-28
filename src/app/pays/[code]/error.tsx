'use client';

import { useEffect } from 'react';
import Link from 'next/link';
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
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-4">
      <div className="glass rounded-xl p-8 max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-[color:var(--lkv-success-bg)] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <LKDVIcon name="alerte" size={32} className="w-8 h-8 text-[color:var(--lkv-text-primary)]" />
        </div>
        <h2 className="text-2xl font-display font-bold text-[color:var(--lkv-text-primary)]">Une erreur est survenue</h2>
        <p className="text-[color:var(--lkv-text-secondary)]">
          Nous n'avons pas pu charger cette page. Veuillez réessayer.
        </p>
        <div className="flex flex-col gap-3 pt-4">
          <button
            onClick={() => reset()}
            className="glass-capsule-btn w-full justify-center"
          >
            Réessayer
          </button>
          <Link
            href="/"
            className="glass-capsule-btn secondary w-full justify-center"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}