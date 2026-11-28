'use client';

import { useEffect } from 'react';
import { Button, Card } from '@/components/ui';

const GLOBAL_CHUNK_RELOAD_KEY = 'lkdv:global-chunk-reload';

function isChunkLoadError(error: Error): boolean {
  const msg = `${error.name || ''} ${error.message || ''}`;
  return /ChunkLoadError|Loading chunk \d+ failed|Failed to fetch dynamically imported module/i.test(msg);
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (!chunkError || typeof window === 'undefined') return;
    try {
      const last = Number(window.sessionStorage.getItem(GLOBAL_CHUNK_RELOAD_KEY) || '0');
      if (Date.now() - last > 15_000) {
        window.sessionStorage.setItem(GLOBAL_CHUNK_RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }, [chunkError]);
  return (
    <html lang="fr">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-4)] font-sans">
          <Card variant="standard" className="w-full max-w-md space-y-[var(--space-6)] p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[var(--lkv-radius-control)] bg-[color:var(--glass-bg-medium)]">
              <svg
                className="h-8 w-8 text-[color:var(--lkv-text-primary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="font-serif text-[length:var(--lkv-text-title-lg)] font-bold text-[color:var(--lkv-text-primary)]">
              Erreur Critique
            </h2>
            <p className="text-[color:var(--lkv-text-muted)]">
              Une erreur inattendue s&apos;est produite. Rechargez l&apos;application ; si
              l&apos;erreur revient, la référence ci-dessous permet de la retrouver.
            </p>
            {error.digest ? (
              <p className="text-xs text-[color:var(--lkv-text-muted)]">
                Référence : <span className="font-mono">{error.digest}</span>
              </p>
            ) : null}
            <div className="pt-[var(--space-4)]">
              <Button onClick={() => reset()} fullWidth size="lg">
                Recharger l&apos;application
              </Button>
            </div>
          </Card>
        </div>
      </body>
    </html>
  );
}
