'use client';
// Écran « base indisponible » pour un utilisateur connecté.
//
// Deux cas seulement :
// 1. un cache local RÉEL existe (dernière donnée serveur déjà synchronisée) → studio hors-ligne ;
// 2. aucun cache → état d'erreur + « Réessayer » (relance le rendu serveur).
// Jamais de jeu de démonstration ici : c'est précisément ce que P1 doit interdire.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStudioCache } from '../services/studioOffline';
import type { CachedStudioData } from '../services/studioOffline';
import { KitStudioClient } from './KitStudioClient';

export function StudioUnavailable() {
  const router = useRouter();
  // undefined = pas encore lu (premier rendu SSR/hydratation), null = pas de cache valide.
  const [cached, setCached] = useState<CachedStudioData | null | undefined>(undefined);

  useEffect(() => {
    setCached(loadStudioCache());
  }, []);

  if (cached === undefined) {
    return <main aria-busy="true" style={{ minHeight: '100dvh', background: 'var(--lkv-stone-50)' }} />;
  }

  if (cached) {
    return <KitStudioClient mode="offline" initialData={cached.data} />;
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'calc(var(--safe-top) + 24px) 24px 24px',
        background: 'var(--lkv-stone-50)',
        color: 'var(--lkv-forest-900)',
      }}
    >
      <div
        role="alert"
        style={{ width: '100%', maxWidth: 420, display: 'grid', gap: 14, textAlign: 'center', justifyItems: 'center' }}
      >
        <p style={{ margin: 0, fontSize: 24 }} aria-hidden="true">
          ⚠️
        </p>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Studio indisponible</h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
          Tes données n’ont pas pu être chargées. Aucune donnée de démonstration n’est
          affichée. Réessaie dans un instant.
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          style={{
            minHeight: 44,
            padding: '0 20px',
            borderRadius: 999,
            border: '1px solid var(--lkv-forest-900)',
            background: 'var(--lkv-forest-900)',
            color: 'var(--lkv-stone-50)',
            font: 'inherit',
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Réessayer
        </button>
      </div>
    </main>
  );
}
