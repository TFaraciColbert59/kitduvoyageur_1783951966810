'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Card, ErrorState } from '@/components/ui';

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-transparent p-4">
      <Card className="w-full max-w-md p-[var(--space-8)] text-center">
        <ErrorState
          title="Une erreur est survenue"
          message="Nous n'avons pas pu charger cette page. Veuillez réessayer."
          onRetry={() => reset()}
        />
        <Link
          href="/"
          className="mt-[var(--space-3)] inline-flex min-h-[var(--control-height-md)] w-full items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-6)] text-[length:var(--lkv-text-subheadline)] font-semibold text-[color:var(--card-content)] transition-colors hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
        >
          Retour à l&apos;accueil
        </Link>
      </Card>
    </div>
  );
}
