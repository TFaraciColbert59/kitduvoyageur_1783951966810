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
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-center">
      <div className="glass-sub-card flex flex-col items-center rounded-xl p-8">
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
          className="glass-capsule-btn primary px-6 text-xs font-bold uppercase tracking-wider"
        >
          Réessayer
        </button>

        <Link
          href="/carnets"
          className="glass-capsule-btn px-6 text-xs font-bold uppercase tracking-wider"
        >
          Retour aux carnets
        </Link>
      </div>
      </div>
    </div>
  );
}
