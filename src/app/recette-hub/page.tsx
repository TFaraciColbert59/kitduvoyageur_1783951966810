import '@/styles/communaute-v2.css';
import '@/styles/communaute-v2-shell.css';
import { notFound } from 'next/navigation';
import { HubCockpit } from '@/features/hub/cockpit/HubCockpit';
import { AdventureSwitcher } from '@/features/hub/components/AdventureSwitcher';
import { cockpitFixture } from '@/features/hub/cockpit/fixture';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'HUB LKDV — Voyage fictif',
  robots: { index: false, follow: false },
};

export default function HubPreviewPage() {
  if (process.env.LKDV_HUB_RECETTE !== '1') notFound();
  return <HubCockpit data={cockpitFixture} fixture adventureControl={<AdventureSwitcher variant="dock" hideTrigger />} />;
}
