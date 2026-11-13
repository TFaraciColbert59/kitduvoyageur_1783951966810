import type { Metadata } from 'next';

import { LiveTrackingScreen } from '@/components/compte/live-tracking/LiveTrackingScreen';

export const metadata: Metadata = {
  title: 'Suivi en direct — Sécurité',
  description:
    'Partage ta position en direct avec un proche, gère tes contacts de sécurité et révoque chaque lien.',
  robots: { index: false, follow: false },
};

export default function LiveTrackingPage() {
  return <LiveTrackingScreen />;
}
