import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import AppShell from '@/components/shell/AppShell';
import { SegmentsScreen } from '@/components/segments';
import { createClient } from '@/lib/supabase/server';
import { loadSegmentsViewerData } from '@/lib/segments/viewer';
import '@/components/segments/segments.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Segments sportifs · Le Kit du Voyageur',
  description:
    'Détection GPS, classements vérifiés, records personnels, comparaison d’efforts et signalement des segments dangereux.',
  openGraph: {
    title: 'Segments sportifs · Le Kit du Voyageur',
    description:
      'Vos passages, vos records : segments vérifiés, historique et sécurité du terrain.',
    type: 'website',
    locale: 'fr_FR',
  },
};

async function currentViewerId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function GuestSegments() {
  return (
    <AppShell>
      <div className="lkdv-seg-screen">
        <header className="lkdv-seg-hero">
          <div>
            <p className="lkdv-seg-eyebrow">S4.01 → S4.12 · Segments sportifs</p>
            <h1>Vos passages, vos records.</h1>
            <p>
              Connectez-vous pour détecter vos passages GPS, comparer vos efforts et signaler les
              dangers du terrain.
            </p>
          </div>
          <Link className="lkdv-seg-btn primary" href="/connexion?next=/segments">
            Se connecter
          </Link>
        </header>
      </div>
    </AppShell>
  );
}

export default async function SegmentsPage() {
  const viewerUserId = await currentViewerId();
  if (!viewerUserId) return <GuestSegments />;

  const data = loadSegmentsViewerData(viewerUserId);
  return (
    <SegmentsScreen
      viewerUserId={viewerUserId}
      initialSegments={data.segments}
      initialEfforts={data.efforts}
      initialHazardReports={data.hazardReports}
      initialPreferences={data.preferences}
    />
  );
}
