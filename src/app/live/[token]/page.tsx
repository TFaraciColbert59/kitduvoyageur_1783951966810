import type { Metadata } from 'next';
import Link from 'next/link';

import { GuestLiveView } from '@/components/compte/live-tracking/GuestLiveView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Suivi en direct',
  description: 'Position partagée temporairement par un voyageur.',
  robots: { index: false, follow: false, nocache: true },
};

export default async function GuestLivePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-[calc(64px+var(--bottom-nav-height,72px))] pt-[calc(20px+var(--safe-top))] sm:px-6">
      <div className="mb-5 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-[color:var(--glass-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
        >
          Le Kit du Voyageur
        </Link>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--glass-secondary)]">
          Lien privé
        </span>
      </div>
      <GuestLiveView token={token} />
    </main>
  );
}
