'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, PageActions, PageHeader } from '@/components/ui';

const CHUNK_RELOAD_KEY = 'lkdv:hub-chunk-reload';

function isChunkLoadError(error: Error): boolean {
  const msg = `${error.name || ''} ${error.message || ''}`;
  return /ChunkLoadError|Loading chunk \d+ failed|Failed to fetch dynamically imported module/i.test(msg);
}

/**
 * H3.4 — Erreur du hub (jamais d'écran blanc : auto-reload unique sur ChunkLoadError + retry).
 */
export default function HubError({
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
      const last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
      if (Date.now() - last > 15_000) {
        window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  }, [chunkError]);

  return (
    <div className="space-y-4" role="alert">
      <PageHeader
        variant="large"
        title={chunkError ? 'Mise à jour du hub en cours' : "Le hub n'a pas pu charger"}
        subtitle={
          chunkError
            ? 'Une nouvelle version de l’application est disponible. Recharge la page pour continuer.'
            : 'Une erreur inattendue est survenue.'
        }
        subtitleLines={0}
      />
      <PageActions align="start">
        <Button
          variant="primary"
          onClick={() => (chunkError ? window.location.reload() : reset())}
        >
          {chunkError ? 'Recharger' : 'Réessayer'}
        </Button>
        <Link href="/hub">
          <Button variant="secondary">Retour au hub</Button>
        </Link>
      </PageActions>
    </div>
  );
}
