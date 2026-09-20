'use client';

import Link from 'next/link';
import { Button, PageActions, PageHeader } from '@/components/ui';

/**
 * H3.4 — Erreur du hub (jamais d'écran blanc : retry + sortie).
 */
export default function HubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4" role="alert">
      <PageHeader
        variant="large"
        title="Le hub n'a pas pu charger"
        subtitle={error.message || 'Une erreur inattendue est survenue.'}
        subtitleLines={0}
      />
      <PageActions align="start">
        <Button variant="primary" onClick={reset}>
          Réessayer
        </Button>
        <Link href="/hub">
          <Button variant="secondary">Retour au hub</Button>
        </Link>
      </PageActions>
    </div>
  );
}
