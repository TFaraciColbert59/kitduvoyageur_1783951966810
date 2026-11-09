'use client';

/**
 * src/features/hub/components/StudioHost.tsx
 * Hôte du Kit Studio survivant dans le hub (P3 — un seul studio).
 *
 * `HubCampShell` garde `?studio=1`, la hiérarchie popstate et ses huit points d'entrée ;
 * ce composant monte le studio livré (`KitStudioClient` → `SceneView` → `createScene`),
 * c'est-à-dire exactement la scène de `/kit-studio`. Aucune duplication de scène, aucune
 * requête de données côté client : la donnée réelle est lue par la page serveur du hub
 * (`resolveStudioPageState` + `getStudioData`) et passée en prop.
 *
 * Les imports sont dynamiques (`ssr: false`) : le studio et three ne pèsent pas sur le
 * premier chargement de `/hub`, ils arrivent quand l'état STUDIO s'ouvre.
 */

import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { StudioPageState } from '@/features/kit-studio/server/studioMode';

const StudioLoading = () => (
  <div className="ks-root ks-stage" aria-busy="true" data-mode="server" data-testid="hub-studio-loading" />
);

const KitStudioClient = dynamic(
  () => import('@/features/kit-studio/ui/KitStudioClient').then((m) => m.KitStudioClient),
  { ssr: false, loading: StudioLoading },
);

const StudioEmptyState = dynamic(
  () => import('@/features/kit-studio/ui/StudioEmptyState').then((m) => m.StudioEmptyState),
  { ssr: false, loading: StudioLoading },
);

const StudioUnavailable = dynamic(
  () => import('@/features/kit-studio/ui/StudioUnavailable').then((m) => m.StudioUnavailable),
  { ssr: false, loading: StudioLoading },
);

export interface StudioHostProps {
  /** État décidé par le serveur (`debug | login | empty | unavailable | studio`). */
  readonly state?: StudioPageState;
  /** Quitte le studio : la machine du hub revient à l'état précédent (`?studio=1` retiré). */
  readonly onExit: () => void;
}

/**
 * Aucun état serveur disponible (entrée client sans donnée initiale) : on ne montre
 * jamais la démonstration ; message explicite + sortie.
 */
function StudioMissingState({ onExit }: { onExit: () => void }) {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'calc(var(--safe-top, 0px) + 24px) 24px 24px',
        background: 'var(--lkv-stone-50, rgb(250 249 245))',
        color: 'var(--lkv-forest-900, rgb(23 43 36))',
      }}
    >
      <div style={{ display: 'grid', gap: 12, maxWidth: 380, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Studio indisponible</h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          Les données du studio n’ont pas pu être chargées. Aucune donnée de démonstration
          n’est affichée. Recharge le hub, ou reviens au camp.
        </p>
        <button
          type="button"
          onClick={onExit}
          style={{
            justifySelf: 'center',
            minHeight: 44,
            padding: '0 20px',
            borderRadius: 999,
            border: 0,
            background: 'var(--lkv-forest-900, rgb(23 43 36))',
            color: 'var(--lkv-stone-50, rgb(250 249 245))',
            font: 'inherit',
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Retour au camp
        </button>
      </div>
    </main>
  );
}

export function StudioHost({ state, onExit }: StudioHostProps) {
  if (!state) return <StudioMissingState onExit={onExit} />;

  let content: ReactNode;

  switch (state.kind) {
    case 'debug':
      content = <KitStudioClient mode="debug" onExit={onExit} />;
      break;
    case 'studio':
      content = <KitStudioClient mode="server" initialData={state.data} onExit={onExit} />;
      break;
    case 'empty':
      content = <StudioEmptyState />;
      break;
    case 'unavailable':
      content = <StudioUnavailable />;
      break;
    case 'login':
      content = (
        <main
          style={{
            minHeight: '100dvh',
            display: 'grid',
            placeItems: 'center',
            padding: 'calc(var(--safe-top, 0px) + 24px) 24px 24px',
            background: 'var(--lkv-stone-50, rgb(250 249 245))',
            color: 'var(--lkv-forest-900, rgb(23 43 36))',
          }}
        >
          <div style={{ display: 'grid', gap: 12, maxWidth: 380, textAlign: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>Connecte-toi pour ouvrir le studio</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              Le Kit Studio montre uniquement les vraies données de ton compte. Aucune donnée
              de démonstration n’est affichée ici.
            </p>
            <Link
              href={`/connexion?next=${encodeURIComponent(state.next)}`}
              style={{
                justifySelf: 'center',
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: 44,
                padding: '0 20px',
                borderRadius: 999,
                background: 'var(--lkv-forest-900, rgb(23 43 36))',
                color: 'var(--lkv-stone-50, rgb(250 249 245))',
                fontSize: 15,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Se connecter
            </Link>
          </div>
        </main>
      );
      break;
  }

  return (
    <div
      data-testid="hub-studio-host"
      data-studio-scene="survivante"
      data-studio-mode={state.kind}
      style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}
    >
      {content}
    </div>
  );
}
