'use client';

import React from 'react';
import AppShell from '@/components/shell/AppShell';
import { ErrorState } from '@/components/ui';

export default function VoyagesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell safeTop={true} hasBottomNav={true}>
      <div className="mx-auto max-w-xl px-4 py-16">
        <ErrorState
          title="Impossible de charger les voyages"
          message={
            error?.message
              ? `Une erreur inattendue est survenue lors de la récupération des données. ${error.message}`
              : 'Une erreur inattendue est survenue lors de la récupération des données.'
          }
          onRetry={() => reset()}
        />
      </div>
    </AppShell>
  );
}
