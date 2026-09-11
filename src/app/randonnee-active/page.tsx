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
      <div style={{ width: '100%', height: '100dvh', background: '#0d1a12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#8BAF7C', fontFamily: 'monospace', fontSize: 12 }}>Chargement...</span>
      </div>
    }>
      <RandonneeActiveContent terrainEnabled={terrainEnabled} />
    </Suspense>
  );
}
