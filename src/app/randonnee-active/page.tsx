import { Suspense } from 'react';
import RandonneeActiveContent from './RandonneeActiveContent';
import { currentAdventureFeatureFlags } from '@/features/adventure-intelligence/server/featureFlags';

// Flag lu par requête (cookies) : jamais prerendue statiquement au build.
export const dynamic = 'force-dynamic';

export default async function RandonneeActivePage() {
  // A13 (S7) — `terrain_live` OFF par défaut : aucun composant, aucune requête.
  let terrainEnabled = false;
  try {
    terrainEnabled = (await currentAdventureFeatureFlags()).terrain_live === true;
  } catch {
    terrainEnabled = false;
  }

  return (
    <Suspense fallback={
      <div className="flex h-dvh w-full items-center justify-center bg-[var(--lkv-forest-950)]">
        <span className="font-mono text-xs text-[var(--sage-400)]">Chargement...</span>
      </div>
    }>
      <RandonneeActiveContent terrainEnabled={terrainEnabled} />
    </Suspense>
  );
}
