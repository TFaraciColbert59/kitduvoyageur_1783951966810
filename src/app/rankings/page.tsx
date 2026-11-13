import type { Metadata } from 'next';
import AppShell from '@/components/shell/AppShell';
import RankingsHeader from '@/components/rankings/RankingsHeader';
import RankingsHub from '@/components/rankings/RankingsHub';
import { isRankingsTabId } from '@/components/rankings/tabs';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Classements · Le Kit du Voyageur',
  description:
    'Classements hebdomadaires et mensuels, Local Legends, Peak Bagging, défis, trophées et comparaison avec vos pairs. Preuves validées, vie privée fail-closed.',
  openGraph: {
    title: 'Classements · Le Kit du Voyageur',
    description:
      'Vos sommets, vos défis, vos couronnes locales et vos pairs : des classements fondés sur des activités validées, jamais sur des données inventées.',
    type: 'website',
    locale: 'fr_FR',
  },
  robots: { index: false, follow: false },
};

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const initialTab = isRankingsTabId(rawTab) ? rawTab : 'leaderboard';

  return (
    <AppShell hasBottomNav header={<RankingsHeader />}>
      <RankingsHub initialTab={initialTab} />
    </AppShell>
  );
}
