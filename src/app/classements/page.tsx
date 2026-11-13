import React from 'react';
import type { Metadata } from 'next';
import AppShell from '@/components/shell/AppShell';
import { LeaderboardsIndexScreen } from '@/components/leaderboards';
import '@/components/leaderboards/leaderboards.css';
import { listSegmentLeaderboardSummaries } from '@/lib/leaderboards/service';
import { getLeaderboardViewerId } from '@/lib/leaderboards/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Classements de segments · Le Kit du Voyageur',
  description:
    'Classements vérifiés de segments sportifs : KOM, QOM, CR, filtres de période et de club, Local Legends et contrôles anti-triche.',
  openGraph: {
    title: 'Classements de segments · Le Kit du Voyageur',
    description:
      'Les meilleurs passages vérifiés, les titres KOM/QOM/CR et les Local Legends du terrain.',
    type: 'website',
    locale: 'fr_FR',
  },
};

export default async function ClassementsPage() {
  const viewerId = await getLeaderboardViewerId();
  const segments = listSegmentLeaderboardSummaries({ viewerId });

  return (
    <AppShell>
      <LeaderboardsIndexScreen segments={segments} />
    </AppShell>
  );
}
