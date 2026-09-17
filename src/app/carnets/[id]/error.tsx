'use client';

import React from 'react';
import Link from 'next/link';

export default function CarnetError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[var(--lkv-surface)] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[var(--lkv-primary)]/5 flex items-center justify-center mb-6">
        <span className="text-3xl">⚠️</span>
      </div>

      <h1 className="font-display font-bold text-2xl md:text-3xl text-[var(--lkv-primary)] mb-3">
        Erreur de chargement du carnet
      </h1>
      
      <p className="text-sm text-[var(--lkv-text-muted)] max-w-md mb-8">
        Une erreur est survenue lors de la récupération de ce carnet de voyage. Il est possible que le carnet ait été retiré ou soit momentanément indisponible.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-[var(--lkv-primary)] text-[var(--lkv-surface)] rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[var(--lkv-primary-hover)] transition-colors"
        >
          Réessayer
        </button>

        <Link
          href="/carnets"
          className="px-6 py-3 border border-[var(--lkv-border)] text-[var(--lkv-primary)] rounded-full text-xs font-bold uppercase tracking-wider hover:bg-[var(--lkv-primary)]/5 transition-colors"
        >
          Retour aux carnets
        </Link>
      </div>
    </div>
  );
}
