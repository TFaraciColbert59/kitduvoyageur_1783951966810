'use client';

import Link from 'next/link';
import { Button, PageActions, PageHeader } from '@/components/ui';

/**
 * H3.4 — Erreur d'une section du hub (retry + retour aperçu).
 */
export default function HubSectionError({
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
        title="Cette section n'a pas pu charger"
        subtitle={error.message || 'Une erreur inattendue est survenue.'}
        subtitleLines={0}
      />
      <PageActions align="start">
        <Button variant="primary" onClick={reset}>
          Réessayer
        </Button>
        <Link href="/hub">
          <Button variant="secondary">Retour à l&apos;aperçu</Button>
        </Link>
      </PageActions>
    </div>
  );
}
