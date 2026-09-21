'use client';

import React from 'react';
import Link from 'next/link';
import { ErrorState } from '@/components/ui';

export default function CarnetError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-transparent p-[var(--space-6)] text-center">
      <ErrorState
        title="Erreur de chargement du carnet"
        message="Une erreur est survenue lors de la récupération de ce carnet de voyage. Il est possible que le carnet ait été retiré ou soit momentanément indisponible."
        onRetry={() => reset()}
      />

      <Link
        href="/carnets"
        className="mt-[var(--space-4)] inline-flex min-h-[var(--control-height-md)] items-center rounded-full border border-[color:var(--lkv-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-6)] text-[length:var(--lkv-text-caption-2)] font-bold uppercase tracking-wider text-[color:var(--lkv-text-primary)]"
      >
        Retour aux carnets
      </Link>
    </div>
  );
}
