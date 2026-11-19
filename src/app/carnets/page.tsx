import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { CarnetsHubScreen } from '@/components/carnets/hub/CarnetsHubScreen';
import { CarnetsHubSkeleton } from '@/components/carnets/hub/CarnetsHubSkeleton';
import { loadCarnetsHub } from '@/features/carnet/hub/loadCarnetsHub';
import '@/styles/carnets-hub.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lekitduvoyageur.fr';

export const metadata: Metadata = {
  title: 'Carnets de bord — Le Kit du Voyageur',
  description:
    'Les carnets de bord des voyageurs : ceux qui sont en route maintenant, les récits de retour, les traces GPS et les compagnons de route de la communauté.',
  alternates: { canonical: `${siteUrl}/carnets` },
  openGraph: {
    type: 'website',
    title: 'Carnets de bord — Le Kit du Voyageur',
    description:
      'Les carnets de bord des voyageurs : ceux qui sont en route maintenant, les récits de retour et les traces GPS de la communauté.',
    url: `${siteUrl}/carnets`,
    siteName: 'Le Kit du Voyageur',
  },
};

/**
 * Le hub `/carnets` remplace la route absente : l'écran liste les carnets
 * réels lus sous RLS (aucune RPC `community_carnets_feed` en production, aucune
 * donnée de démonstration). Les squelettes sont le repli de streaming de la
 * lecture serveur, à la forme des cartes.
 */
async function CarnetsHubContent() {
  const data = await loadCarnetsHub();
  return <CarnetsHubScreen data={data} />;
}

export default function CarnetsPage() {
  return (
    <Suspense fallback={<CarnetsHubSkeleton />}>
      <CarnetsHubContent />
    </Suspense>
  );
}

// Rendu dynamique requis : la lecture passe par `cookies()` (session + RLS) et
// dépend de l'état vivant des carnets — jamais de cache statique.
export const dynamic = 'force-dynamic';
