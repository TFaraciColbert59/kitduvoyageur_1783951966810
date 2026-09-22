'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { Badge, Button, Card, EmptyState, Spinner, Tabs } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

const JOURNALS = [
  { id: 'j1', author: 'Thomas Vernet', authorId: 'fake-author-1', authorAvatar: 'TV', authorTrustScore: 94, authorLevel: 'ambassadeur', title: 'Circuit des Annapurnas — 18 jours en autonomie complète', destination: 'Circuit des Annapurnas', country: 'Népal', countryCode: 'np', duration: '18 jours', date: '2026-07-01', coverImage: "https://img.rocket.new/generatedImages/rocket_gen_img_1fc94b322-1777501827822.png", coverAlt: 'Randonneur avec sac à dos sur sentier himalayan', excerpt: 'Départ de Besisahar le 12 mars, retour à Pokhara le 30.', gpsTrace: true, gpsPoints: 2847, weatherReal: 'Ensoleillé J1–J14, tempête neige J15–J18', gearUsed: [{ name: 'Osprey Atmos 65', category: 'Sac à dos', rating: 5, linked: true }], missingGear: ['Guêtres imperméables'], routeRating: 9.2, reactions: { useful: 203, securityConfirmed: 87, bagHelped: 156 }, comments: 34, readTime: 12, verified: true },
  { id: 'j2', author: 'Camille Rousseau', authorId: 'fake-author-2', authorAvatar: 'CR', authorTrustScore: 87, authorLevel: 'expert', title: 'GR20 Corse — 15 jours de bout en bout', destination: 'GR20', country: 'France (Corse)', countryCode: 'fr', duration: '15 jours', date: '2026-06-20', coverImage: "https://img.rocket.new/generatedImages/rocket_gen_img_12782a0e5-1772085588678.png", coverAlt: 'Randonneuse sur sentier rocheux corse', excerpt: 'Le GR20 en juin : chaleur intense en basse altitude.', gpsTrace: true, gpsPoints: 1923, weatherReal: '28°C en vallée, 12°C en altitude', gearUsed: [{ name: 'Sac Deuter Aircontact 55+10', category: 'Sac à dos', rating: 4, linked: true }], missingGear: ['Filtre à eau'], routeRating: 8.8, reactions: { useful: 178, securityConfirmed: 64, bagHelped: 142 }, comments: 28, readTime: 9, verified: true },
];

const FILTERS = [
  { id: 'all', label: 'Tous les carnets' },
  { id: 'verified', label: '✓ Achat vérifié' },
  { id: 'gps', label: '📍 Tracé GPS' },
  { id: 'recent', label: 'Récents' },
];

export default function FeedPage() {
  const [filter, setFilter] = useState<'all' | 'verified' | 'gps' | 'recent'>('all');
  const [showNewJournal, setShowNewJournal] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const { haptic } = useHapticFeedback();

  // Pull-to-refresh mobile (mission gestes, Phase 4) — hook existant,
  // déjà branché sur les 4 hubs communautaires.
  const { isRefreshing, pullProgress } = usePullToRefresh(async () => {
    haptic('medium');
    // Le fil est statique (données mock) : on rafraîchit l'horodatage.
    await new Promise((r) => setTimeout(r, 600));
    setRefreshedAt(Date.now());
  });

  useEffect(() => {
    if (!refreshedAt) return;
    const t = setTimeout(() => setRefreshedAt(null), 2000);
    return () => clearTimeout(t);
  }, [refreshedAt]);

  const filtered = JOURNALS.filter((j) => { if (filter === 'verified') return j.verified; if (filter === 'gps') return j.gpsTrace; return true; });

  return (
    <>
      {/* Header desktop */}
      <div className="hidden md:block">
        <Header />
      </div>

      <MobilePageShell>
        <main className="min-h-screen">
          <div className="pt-16 md:pt-0 lg:pt-18">
            <section className="relative overflow-hidden bg-[color:var(--lkv-primary)] px-[var(--space-4)] py-[var(--space-12)] text-[color:var(--lkv-text-inverted)]">
              <div className="relative mx-auto max-w-7xl">
                <div className="mb-[var(--space-4)] flex items-center gap-[var(--space-2)]">
                  <Badge tone="sage" className="border-[color:var(--lkv-forest-500)]/30 bg-[color:var(--lkv-secondary)]/30 text-[color:var(--lkv-forest-300)] uppercase">
                    COMMUNAUTÉ
                  </Badge>
                  <span className="font-mono text-[length:var(--lkv-text-caption)] text-white/50">CARNETS DE VOYAGE</span>
                </div>
                <div className="flex flex-col justify-between gap-[var(--space-6)] lg:flex-row lg:items-end">
                  <div>
                    <h1 className="mb-[var(--space-3)] text-[length:var(--lkv-text-title-lg)] font-bold text-white">
                      Carnets d&apos;expédition<br />
                      <span className="text-[color:var(--lkv-primary-subtle)]">vérifiés par les données</span>
                    </h1>
                    <p className="max-w-xl text-[length:var(--lkv-text-body)] text-white/60">
                      Pas des posts — des récits longs avec tracé GPS, météo réelle, matériel utilisé.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => setShowNewJournal(true)}
                    icon={<Icon name="PencilSquareIcon" size={16} aria-hidden="true" />}
                    className="shrink-0 self-start lg:self-auto"
                  >
                    Écrire un carnet
                  </Button>
                </div>
              </div>
            </section>

            <section className="sticky top-16 z-[var(--z-sticky)] border-b border-[color:var(--lkv-border)] bg-[color:var(--lkv-surface)]/95 backdrop-blur-[var(--blur-md)]">
              <div className="mx-auto max-w-7xl px-[var(--space-4)]">
                <Tabs
                  variant="scrollable"
                  ariaLabel="Filtrer les carnets"
                  className="py-[var(--space-3)]"
                  value={filter}
                  onChange={(id) => setFilter(id as typeof filter)}
                  options={FILTERS}
                />
              </div>
            </section>

            <div className="mx-auto max-w-7xl px-[var(--space-4)] py-[var(--space-10)]">
              {/* Indicateur pull-to-refresh (même pattern que MobileCommunityHub) */}
              {(pullProgress > 0 || isRefreshing) && (
                <div
                  className="flex w-full items-center justify-center overflow-hidden py-[var(--space-2)] transition-all"
                  style={{ height: isRefreshing ? '44px' : `${Math.min(pullProgress * 44, 44)}px` }}
                >
                  <Card variant="compact" className="flex items-center gap-[var(--space-2)] rounded-full py-[var(--space-1)]">
                    <Spinner size="sm" />
                    <span className="font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-primary)]">
                      {isRefreshing ? 'Actualisation...' : 'Tirer pour rafraîchir'}
                    </span>
                  </Card>
                </div>
              )}
              {refreshedAt && (
                <div className="mb-[var(--space-2)] flex w-full justify-center">
                  <Badge tone="sage" className="font-mono">Fil actualisé</Badge>
                </div>
              )}

              <h1 className="mb-[var(--space-2)] text-[length:var(--lkv-text-title-xl)] font-extrabold text-[color:var(--lkv-text-primary)] md:hidden">
                Carnets d&apos;expédition
              </h1>
              <p className="mb-[var(--space-4)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)] md:hidden">
                Récits avec tracé GPS et matériel utilisé.
              </p>

              {filtered.length === 0 ? (
                <Card>
                  <EmptyState
                    compact
                    icon={<Icon name="book-open" size={28} aria-hidden="true" />}
                    title="Aucun carnet"
                    description="Aucun carnet ne correspond à ce filtre pour le moment."
                  />
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-[var(--space-8)] lg:grid-cols-3">
                  <div className="space-y-[var(--space-8)] lg:col-span-2">
                    {filtered.map((j) => (
                      <Card key={j.id} className="overflow-hidden p-[var(--space-5)]">
                        <h2 className="mb-[var(--space-2)] font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">
                          {j.title}
                        </h2>
                        <p className="text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-muted)]">
                          {j.author} · {j.country} · {j.duration}
                        </p>
                        <p className="mt-[var(--space-2)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-text-secondary)]">
                          {j.excerpt}
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="hidden md:block">
            <Footer />
          </div>
        </main>
      </MobilePageShell>
    </>
  );
}
