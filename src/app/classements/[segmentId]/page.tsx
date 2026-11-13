import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import { LeaderboardScreen } from '@/components/leaderboards';
import '@/components/leaderboards/leaderboards.css';
import {
  LeaderboardSegmentNotFoundError,
  getLeaderboardClubs,
  getSegmentLeaderboardView,
  getSegmentLocalLegendsView,
} from '@/lib/leaderboards/service';
import { getLeaderboardSegment } from '@/lib/leaderboards/store';
import { getLeaderboardViewerId } from '@/lib/leaderboards/session';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ segmentId: string }> | { segmentId: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { segmentId } = await params;
  const segment = getLeaderboardSegment(segmentId);
  if (!segment) {
    return { title: 'Classement introuvable · Le Kit du Voyageur' };
  }
  return {
    title: `Classement ${segment.name} · Le Kit du Voyageur`,
    description: `Classement vérifié du segment ${segment.name}, titres KOM/QOM/CR et Local Legend.`,
    openGraph: {
      title: `Classement ${segment.name} · Le Kit du Voyageur`,
      description: `Les passages vérifiés sur ${segment.name}.`,
      type: 'website',
      locale: 'fr_FR',
    },
  };
}

export default async function ClassementSegmentPage({ params }: PageProps) {
  const { segmentId } = await params;
  const viewerId = await getLeaderboardViewerId();

  try {
    const view = getSegmentLeaderboardView(segmentId, {
      viewerId,
      query: { scope: 'global', period: 'all_time' },
    });
    const legend = getSegmentLocalLegendsView(segmentId, { viewerId, scope: 'global' });

    return (
      <AppShell>
        <LeaderboardScreen
          segment={view.segment}
          initialLeaderboard={view.leaderboard}
          initialLocalLegend={legend.localLegend}
          initialAntiCheat={view.antiCheat}
          initialFilters={{ scope: 'global', period: 'all_time' }}
          clubOptions={getLeaderboardClubs(viewerId)}
          isAuthenticated={Boolean(viewerId)}
        />
      </AppShell>
    );
  } catch (error) {
    if (error instanceof LeaderboardSegmentNotFoundError) notFound();
    throw error;
  }
}
