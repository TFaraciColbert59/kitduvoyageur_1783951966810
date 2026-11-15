import type { Metadata } from 'next';
import { DeveloperConsole } from '@/components/offers/DeveloperConsole';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Console Développeurs · API & Webhooks · LKDV',
  description: 'Gestion des clients API scopés, quotas et webhooks signés (hors navigation publique).',
  robots: { index: false, follow: false },
};

export default function DeveloppeursPage() {
  return (
    <main id="main-content" className="min-h-screen w-full bg-white text-slate-900">
      <DeveloperConsole />
    </main>
  );
}
