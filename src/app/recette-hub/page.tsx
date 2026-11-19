import { notFound } from 'next/navigation';
import { HubCockpit } from '@/features/hub/cockpit/HubCockpit';
import { cockpitFixture } from '@/features/hub/cockpit/fixture';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'HUB LKDV — Voyage fictif',
  robots: { index: false, follow: false },
};

export default function HubPreviewPage() {
  if (process.env.LKDV_HUB_RECETTE !== '1') notFound();
  return <HubCockpit data={cockpitFixture} fixture />;
}
