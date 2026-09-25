'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import WeightGauge from '@/components/WeightGauge';
import TopoSeparator from '@/components/TopoSeparator';
import Icon from '@/components/ui/AppIcon';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ListItem,
  LoadingState,
  PageHeader,
  Tabs,
  type BadgeTone,
} from '@/components/ui';
import { saveCart, getCart } from '@/lib/cart';
import { createClient } from '@/lib/supabase/client';

interface KitItem {
  id: string;
  nom: string;
  categorie: string;
  poids_g: number;
  prix_cents: number;
  quantite: number;
  essentiel: boolean;
  slug: string;
  image: string;
  alt: string;
}

interface KitData {
  id: string;
  slug: string;
  nom: string;
  description: string;
  destination: string;
  saison: string;
  poids_total_g: number;
  prix_cents: number;
  difficulte: string;
  activite: string;
  image: string;
  alt: string;
  conseils: string[];
  items?: KitItem[];
}

const DIFFICULTE_TONE: Record<string, BadgeTone> = {
  Débutant: 'sage',
  Intermédiaire: 'warn',
  Expert: 'danger',
};

const TAB_OPTIONS = [
  { id: 'composition', label: 'Composition' },
  { id: 'conseils', label: 'Conseils terrain' },
] as const;

// Aucune donnée fictive : les kits proviennent uniquement de la table Supabase `kits`.
// En cas d'échec, on affiche un vrai état d'erreur (voir loadKit).

export default function KitDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [kit, setKit] = useState<KitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [addedToCart, setAddedToCart] = useState(false);
  const [activeTab, setActiveTab] = useState<'composition' | 'conseils'>('composition');
  const supabase = useMemo(() => createClient(), []);

  const loadKit = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const { data: kitData, error: kitError } = await supabase
        .from('kits')
        .select('*')
        .eq('slug', slug)
        .single();
      if (kitError) throw kitError;

      const { data: itemsData } = await supabase
        .from('kit_items')
        .select('*')
        .eq('kit_id', kitData.id)
        .order('sort_order', { ascending: true });

      const fullKit = { ...kitData, items: itemsData ?? [] };
      setKit(fullKit);
      setSelectedItems(new Set((itemsData ?? []).filter((i: KitItem) => i.essentiel).map((i: KitItem) => i.id)));
    } catch {
      // Supabase indisponible ou kit inexistant : vrai état d'erreur, aucune donnée fictive.
      setError('Kit introuvable');
    } finally {
      setLoading(false);
    }
  }, [slug, supabase]);

  useEffect(() => { loadKit(); }, [loadKit]);

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItemsData = (kit?.items ?? []).filter((i) => selectedItems.has(i.id));
  const totalPoids = selectedItemsData.reduce((sum, i) => sum + i.poids_g * i.quantite, 0);
  const totalPrix = selectedItemsData.reduce((sum, i) => sum + i.prix_cents * i.quantite, 0);

  const handleAddAllToCart = () => {
    if (!kit) return;
    const existing = getCart();
    const toAdd = selectedItemsData.map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.nom,
      brand: 'Le Kit du Voyageur',
      category: item.categorie,
      priceEur: item.prix_cents / 100,
      weightG: item.poids_g,
      quantity: item.quantite,
      image: item.image,
      imageAlt: item.alt,
    }));
    const merged = [...existing];
    toAdd.forEach((newItem) => {
      const idx = merged.findIndex((e) => e.id === newItem.id);
      if (idx >= 0) merged[idx].quantity += newItem.quantity;
      else merged.push(newItem);
    });
    saveCart(merged);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 3000);
  };

  if (loading) {
    return (
      <>
        {/* ── DESKTOP ── */}
        <div className="hidden md:block">
          <div data-lkv-material-theme="light" className="h-dvh overflow-hidden bg-transparent">
            <Header />
            <main className="h-full overflow-y-auto pt-20">
              <LoadingState label="Chargement du kit…" />
            </main>
          </div>
        </div>

        {/* ── MOBILE ── */}
        <div className="block md:hidden">
          <MobilePageShell>
            <LoadingState label="Chargement du kit…" className="min-h-[50dvh]" />
          </MobilePageShell>
        </div>
      </>
    );
  }

  if (error || !kit) {
    return (
      <>
        {/* ── DESKTOP ── */}
        <div className="hidden md:block">
          <div data-lkv-material-theme="light" className="h-dvh overflow-hidden bg-transparent">
            <Header />
            <main className="h-full overflow-y-auto pt-20">
              <div className="flex min-h-[60dvh] items-center justify-center px-4">
                <div className="w-full max-w-md">
                  <EmptyState
                    icon={
                      <Icon
                        name="ExclamationTriangleIcon"
                        size={40}
                        className="text-[var(--lkv-warning)]"
                      />
                    }
                    title="Kit introuvable"
                    description={error || 'Ce kit n\'existe pas ou a été supprimé.'}
                    actionLabel="Voir tous les kits"
                    actionHref="/kits"
                  />
                </div>
              </div>
            </main>
          </div>
        </div>

        {/* ── MOBILE ── */}
        <div className="block md:hidden">
          <MobilePageShell>
            <div className="px-3 pt-20">
              <EmptyState
                icon={
                  <Icon
                    name="ExclamationTriangleIcon"
                    size={40}
                    className="text-[var(--lkv-warning)]"
                  />
                }
                title="Kit introuvable"
                description={error || 'Ce kit n\'existe pas ou a été supprimé.'}
                actionLabel="Voir tous les kits"
                actionHref="/kits"
              />
            </div>
          </MobilePageShell>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div data-lkv-material-theme="light" className="h-dvh overflow-hidden bg-transparent">
          <Header />
          <main className="h-full overflow-y-auto">
            {/* Hero */}
            <section className="relative h-72 overflow-hidden md:h-80">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={kit.image} alt={kit.alt} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--lkv-forest-900)] via-[var(--lkv-forest-900)]/25 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                <div className="mx-auto max-w-7xl space-y-2">
                  <nav
                    className="inline-flex items-center gap-2 rounded-sm border border-white/60 bg-[color:var(--card-tint-strong)] px-3 py-2 text-xs text-white/80"
                    aria-label="Fil d'Ariane"
                  >
                    <Link href="/" className="transition-colors hover:text-white">Accueil</Link>
                    <span aria-hidden="true">/</span>
                    <Link href="/kits" className="transition-colors hover:text-white">Kits</Link>
                    <span aria-hidden="true">/</span>
                    <span className="font-medium text-[var(--lkv-text-primary)]" aria-current="page">{kit.nom}</span>
                  </nav>

                  <div className="max-w-3xl rounded-sm border border-white/60 bg-[color:var(--card-tint-strong)] px-3 py-2">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge tone={DIFFICULTE_TONE[kit.difficulte] ?? 'stone'}>
                        {kit.difficulte.toUpperCase()}
                      </Badge>
                      <Badge tone="info">{kit.activite.toUpperCase()}</Badge>
                    </div>
                    <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[var(--lkv-text-primary)] md:text-4xl">
                      {kit.nom}
                    </h1>
                    <p className="mt-1 text-sm text-[var(--lkv-text-secondary)]">
                      📍 {kit.destination} · 🗓 {kit.saison}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Main Content */}
                <div className="lg:col-span-2">
                  <p className="mb-6 text-sm leading-relaxed text-[var(--lkv-forest-100)]">{kit.description}</p>

                  <Tabs
                    options={TAB_OPTIONS}
                    value={activeTab}
                    onChange={(id) => setActiveTab(id === 'conseils' ? 'conseils' : 'composition')}
                    ariaLabel="Contenu du kit"
                    className="mb-6 max-w-xs"
                  />

                  {activeTab === 'composition' && (
                    <div className="space-y-2" role="tabpanel" aria-label="Composition du kit">
                      {(kit.items ?? []).length === 0 ? (
                        <EmptyState compact title="Aucun article dans ce kit." />
                      ) : (
                        (kit.items ?? []).map((item) => {
                          const selected = selectedItems.has(item.id);
                          return (
                            <Card key={item.id} variant="compact" className="p-0">
                              <ListItem
                                onClick={() => toggleItem(item.id)}
                                selected={selected}
                                leading={
                                  <span className="flex items-center gap-3">
                                    <span
                                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                        selected
                                          ? 'border-white bg-white text-black'
                                          : 'border-white/40 bg-white/40'
                                      }`}
                                      aria-hidden="true"
                                    >
                                      {selected && <Icon name="CheckIcon" size={10} className="text-white" />}
                                    </span>
                                    <span className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl border border-white/30">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={item.image} alt={item.alt} className="h-full w-full object-cover" />
                                    </span>
                                  </span>
                                }
                                title={
                                  <span className="flex flex-wrap items-center gap-2">
                                    <span className="truncate">{item.nom}</span>
                                    {item.essentiel && <Badge tone="sage">Essentiel</Badge>}
                                    {item.quantite > 1 && (
                                      <span className="font-mono text-[10px] text-[var(--lkv-text-secondary)]">
                                        ×{item.quantite}
                                      </span>
                                    )}
                                  </span>
                                }
                                subtitle={`${item.categorie} · ${item.poids_g}g`}
                                metadata={
                                  <span className="font-mono font-bold text-[var(--lkv-text-primary)]">
                                    {(item.prix_cents / 100).toFixed(2)} €
                                  </span>
                                }
                              />
                            </Card>
                          );
                        })
                      )}
                    </div>
                  )}

                  {activeTab === 'conseils' && (
                    <div className="space-y-2" role="tabpanel" aria-label="Conseils terrain">
                      {(kit.conseils ?? []).length === 0 ? (
                        <EmptyState compact title="Aucun conseil disponible pour ce kit." />
                      ) : (
                        (kit.conseils ?? []).map((conseil, i) => (
                          <Card key={i} variant="compact" className="flex items-start gap-3 p-3">
                            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/25">
                              <span className="font-mono text-[10px] font-bold text-[var(--lkv-text-primary)]">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                            </div>
                            <p className="text-sm leading-relaxed text-[var(--lkv-text-secondary)]">{conseil}</p>
                          </Card>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1">
                  <div className="sticky top-24 space-y-4">
                    <Card tone="sage" className="p-5">
                      <h3 className="mb-4 font-display font-bold text-[var(--lkv-text-primary)]">
                        Récapitulatif
                      </h3>
                      <div className="mb-4 space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--lkv-text-secondary)]">Articles sélectionnés</span>
                          <span className="font-mono font-bold text-[var(--lkv-text-primary)]">{selectedItemsData.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--lkv-text-secondary)]">Poids total</span>
                          <span className="font-mono font-bold text-[var(--lkv-text-primary)]">{(totalPoids / 1000).toFixed(2)} kg</span>
                        </div>
                        <WeightGauge weightG={totalPoids} maxG={15000} size="sm" />
                        <div className="flex justify-between border-t border-white/30 pt-2 text-base font-bold">
                          <span className="text-[var(--lkv-text-primary)]">Total</span>
                          <span className="font-mono text-[var(--lkv-text-primary)]">{(totalPrix / 100).toFixed(2)} €</span>
                        </div>
                      </div>
                      <Button
                        onClick={handleAddAllToCart}
                        disabled={selectedItemsData.length === 0}
                        fullWidth
                      >
                        {addedToCart ? '✓ Ajouté au panier' : 'Ajouter au panier'}
                      </Button>
                    </Card>

                    <Card tone="sage" className="p-5">
                      <h3 className="mb-3 font-display text-sm font-bold text-[var(--lkv-text-primary)]">
                        Infos kit
                      </h3>
                      <div className="space-y-2 text-xs text-[var(--lkv-text-secondary)]">
                        <div className="flex justify-between">
                          <span>Destination</span>
                          <span className="font-medium text-[var(--lkv-text-primary)]">{kit.destination}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Saison</span>
                          <span className="font-medium text-[var(--lkv-text-primary)]">{kit.saison}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Activité</span>
                          <span className="font-medium text-[var(--lkv-text-primary)]">{kit.activite}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Difficulté</span>
                          <Badge tone={DIFFICULTE_TONE[kit.difficulte] ?? 'stone'}>{kit.difficulte}</Badge>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            </div>

            <TopoSeparator color="var(--background)" />
            <Footer />
          </main>
        </div>
      </div>

      {/* ── MOBILE (COCKPIT LIQUID GLASS) ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="flex flex-col gap-3.5 px-3 pb-24 pt-3">
            <PageHeader
              variant="inline"
              title={kit.nom}
              subtitle={`${kit.difficulte} · ${kit.activite}`}
              back
              backHref="/kits"
              backLabel="Kits"
            />

            {/* Mobile Hero Card */}
            <Card tone="sage" className="overflow-hidden border border-white/40 p-0">
              <div className="relative h-44 w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={kit.image} alt={kit.alt} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--lkv-forest-900)]/95 via-[var(--lkv-forest-900)]/30 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <Badge tone="stone" className="border-white/60 bg-[color:var(--card-tint-strong)]">
                    📍 {kit.destination} · 🗓 {kit.saison}
                  </Badge>
                </div>
              </div>
            </Card>

            <p className="px-1 text-xs leading-relaxed text-[var(--lkv-forest-100)]">{kit.description}</p>

            <Tabs
              options={TAB_OPTIONS}
              value={activeTab}
              onChange={(id) => setActiveTab(id === 'conseils' ? 'conseils' : 'composition')}
              ariaLabel="Contenu du kit"
            />

            {activeTab === 'composition' && (
              <div className="flex flex-col gap-2">
                {(kit.items ?? []).length === 0 ? (
                  <EmptyState compact title="Aucun article dans ce kit." />
                ) : (
                  (kit.items ?? []).map((item) => {
                    const selected = selectedItems.has(item.id);
                    return (
                      <Card key={item.id} variant="compact" className="p-0">
                        <ListItem
                          onClick={() => toggleItem(item.id)}
                          selected={selected}
                          leading={
                            <span className="flex items-center gap-3">
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                  selected
                                    ? 'border-white bg-white text-black'
                                    : 'border-white/40 bg-white/40'
                                }`}
                                aria-hidden="true"
                              >
                                {selected && <span className="text-[10px] font-bold">✓</span>}
                              </span>
                              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/30">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={item.image} alt={item.alt} className="h-full w-full object-cover" />
                              </span>
                            </span>
                          }
                          title={
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate">{item.nom}</span>
                              {item.essentiel && <Badge tone="sage">Essentiel</Badge>}
                            </span>
                          }
                          subtitle={`${item.categorie} · ${item.poids_g}g`}
                          metadata={
                            <span className="font-mono font-bold text-[var(--lkv-text-primary)]">
                              {(item.prix_cents / 100).toFixed(2)} €
                            </span>
                          }
                        />
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'conseils' && (
              <div className="flex flex-col gap-2">
                {(kit.conseils ?? []).length === 0 ? (
                  <EmptyState compact title="Aucun conseil disponible pour ce kit." />
                ) : (
                  (kit.conseils ?? []).map((conseil, i) => (
                    <Card key={i} variant="compact" className="flex items-start gap-3 p-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/25">
                        <span className="font-mono text-[10px] font-bold text-[var(--lkv-text-primary)]">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-[var(--lkv-text-secondary)]">{conseil}</p>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* Mobile Summary CTA */}
            <Card tone="sage" className="mt-2 flex flex-col gap-3 p-4">
              <h3 className="font-display text-sm font-bold text-[var(--lkv-text-primary)]">Récapitulatif</h3>
              <div className="flex justify-between text-xs text-[var(--lkv-text-secondary)]">
                <span>Articles sélectionnés</span>
                <span className="font-mono font-bold text-[var(--lkv-text-primary)]">{selectedItemsData.length}</span>
              </div>
              <div className="flex justify-between text-xs text-[var(--lkv-text-secondary)]">
                <span>Poids total</span>
                <span className="font-mono font-bold text-[var(--lkv-text-primary)]">{(totalPoids / 1000).toFixed(2)} kg</span>
              </div>
              <div className="flex justify-between border-t border-white/30 pt-2 text-sm font-bold">
                <span className="text-[var(--lkv-text-primary)]">Total</span>
                <span className="font-mono text-[var(--lkv-text-primary)]">{(totalPrix / 100).toFixed(2)} €</span>
              </div>
              <Button
                onClick={handleAddAllToCart}
                disabled={selectedItemsData.length === 0}
                fullWidth
                size="lg"
                className="mt-1"
              >
                {addedToCart ? '✓ Ajouté au panier' : 'Ajouter au panier'}
              </Button>
            </Card>

            {/* Kit Info */}
            <Card tone="sage" className="flex flex-col gap-2 p-4">
              <h3 className="mb-1 font-display text-xs font-bold text-[var(--lkv-text-primary)]">Détails du kit</h3>
              <div className="flex flex-col gap-1.5 text-xs">
                {[
                  { label: 'Destination', value: kit.destination },
                  { label: 'Saison', value: kit.saison },
                  { label: 'Activité', value: kit.activite },
                  { label: 'Difficulté', value: kit.difficulte },
                ].map((info) => (
                  <div key={info.label} className="flex justify-between py-0.5">
                    <span className="text-[var(--lkv-text-secondary)]">{info.label}</span>
                    <span className="font-medium text-[var(--lkv-text-primary)]">{info.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
