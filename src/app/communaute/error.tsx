'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, Card } from '@/components/ui';

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-transparent p-[var(--space-4)]">
      <Card className="w-full max-w-md space-y-[var(--space-6)] text-center">
        <div className="mx-auto mb-[var(--space-4)] flex size-16 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-surface-muted)]">
          <svg className="size-8 text-[color:var(--lkv-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="font-serif text-[length:var(--lkv-text-title-sm)] text-[color:var(--lkv-primary)]">
          Une erreur est survenue
        </h2>
        <p className="text-[color:var(--lkv-text-muted)]">
          Nous n&apos;avons pas pu charger cette page. Veuillez réessayer.
        </p>
        <div className="flex flex-col gap-[var(--space-3)] pt-[var(--space-4)]">
          <Button type="button" variant="primary" fullWidth onClick={() => reset()}>
            Réessayer
          </Button>
          <Link href="/" className="block w-full">
            <Button variant="secondary" fullWidth>
              Retour à l&apos;accueil
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
