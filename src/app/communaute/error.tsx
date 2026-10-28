'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, Card } from '@/components/ui';
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-transparent p-[var(--space-4)]">
      <Card className="w-full max-w-md space-y-[var(--space-6)] text-center">
        <div className="mx-auto mb-[var(--space-4)] flex size-16 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--glass-bg-medium)]">
          <LKDVIcon name="alerte" size={32} className="size-8 text-[color:var(--lkv-text-primary)]" />
        </div>
        <h2 className="font-serif text-[length:var(--lkv-text-title-sm)] text-[color:var(--lkv-text-primary)]">
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
