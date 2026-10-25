import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Laboratoire Récompenses',
  robots: { index: false, follow: false },
};

/** États visuels du chantier Récompenses ; jamais servi en production. */
export default async function RewardsLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const { default: RewardsStatesLab } = await import('@/components/dev/rewards/RewardsStatesLab');
  return <RewardsStatesLab />;
}
