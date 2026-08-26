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
import { GlassCard } from '@/components/ui/GlassCard';
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

const difficultePill: Record<string, string> = {
  Débutant: 'glass-pill',
  Intermédiaire: 'glass-pill pill-warn',
  Expert: 'glass-pill pill-danger',
};

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
          <div data-lkv-material-theme="light" className="h-dvh overflow-hidden bg-[#FAF8F5]">
            <Header />
            <main className="h-full overflow-y-auto pt-20">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="glass-sub-card h-72 rounded-2xl animate-pulse mb-8" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-4">
                    {[1, 2, 3, 4].map((i) => <div key={i} className="glass-sub-card h-16 rounded-2xl animate-pulse" />)}
                  </div>
                  <div className="glass-sub-card h-64 rounded-2xl animate-pulse" />
                </div>
              </div>
            </main>
          </div>
        </div>

        {/* ── MOBILE ── */}
        <div className="block md:hidden">
          <MobilePageShell>
            <div className="px-3 pt-6 pb-24 flex items-center justify-center min-h-[50dvh]">
              <div className="text-center">
                <span className="inline-block h-8 w-8 rounded-full border-2 border-white/30 border-t-[#17402C] animate-spin" />
                <p className="mt-3 text-[13px] text-[#5A7064]">Chargement du kit...</p>
              </div>
            </div>
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
          <div data-lkv-material-theme="light" className="h-dvh overflow-hidden bg-[#FAF8F5]">
            <Header />
            <main className="h-full overflow-y-auto pt-20">
              <div className="min-h-[60dvh] flex items-center justify-center px-4">
                <GlassCard tone="sage" className="p-8 max-w-md w-full text-center">
                  <Icon name="ExclamationTriangleIcon" size={40} className="mx-auto mb-4 text-[#C89A3B]" />
                  <h1 className="font-display font-bold text-2xl text-[#17402C] mb-2">Kit introuvable</h1>
                  <p className="text-sm text-[#5A7064] mb-6">{error || 'Ce kit n\'existe pas ou a été supprimé.'}</p>
                  <Link href="/kits" className="glass-capsule-btn primary">Voir tous les kits</Link>
                </GlassCard>
              </div>
            </main>
          </div>
        </div>

        {/* ── MOBILE ── */}
        <div className="block md:hidden">
          <MobilePageShell>
            <div className="px-3 pt-20 text-center flex flex-col items-center gap-4">
              <p className="text-[40px] leading-none">🔧</p>
              <h1 className="font-display font-bold text-[20px] text-[#17402C]">Kit introuvable</h1>
              <p className="text-sm text-[#5A7064]">{error || 'Ce kit n\'existe pas ou a été supprimé.'}</p>
              <Link href="/kits" className="glass-capsule-btn primary">
                <span>Voir tous les kits</span>
              </Link>
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
        <div data-lkv-material-theme="light" className="h-dvh overflow-hidden bg-[#FAF8F5]">
          <Header />
          <main className="h-full overflow-y-auto">
            {/* Hero */}
            <section className="relative h-72 md:h-80 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={kit.image} alt={kit.alt} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#FAF8F5] via-[#FAF8F5]/25 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                <div className="max-w-7xl mx-auto space-y-2">
                  <nav
                    className="inline-flex items-center gap-2 text-xs text-[#17402C]/70 bg-[rgba(255,255,255,0.92)] border border-[rgba(255,255,255,0.60)] rounded-[12px] px-3 py-2"
                    aria-label="Fil d'Ariane"
                  >
                    <Link href="/" className="hover:text-[#17402C] transition-colors">Accueil</Link>
                    <span aria-hidden="true">/</span>
                    <Link href="/kits" className="hover:text-[#17402C] transition-colors">Kits</Link>
                    <span aria-hidden="true">/</span>
                    <span className="text-[#17402C] font-medium" aria-current="page">{kit.nom}</span>
                  </nav>

                  <div className="bg-[rgba(255,255,255,0.92)] border border-[rgba(255,255,255,0.60)] rounded-[12px] px-3 py-2 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`${difficultePill[kit.difficulte] ?? 'glass-pill'}`}>
                        {kit.difficulte.toUpperCase()}
                      </span>
                      <span className="glass-pill pill-info">{kit.activite.toUpperCase()}</span>
                    </div>
                    <h1 className="font-display font-bold text-3xl md:text-4xl text-[#17402C] tracking-tight leading-tight">
                      {kit.nom}
                    </h1>
                    <p className="text-[#365233] mt-1 text-sm">
                      📍 {kit.destination} · 🗓 {kit.saison}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2">
                  <p className="text-[#365233] mb-6 leading-relaxed text-sm">{kit.description}</p>

                  {/* Tabs */}
                  <div className="glass-capsule-bar w-fit mb-6" role="tablist" aria-label="Contenu du kit">
                    {(['composition', 'conseils'] as const).map((tab) => (
                      <button
                        key={tab}
                        role="tab"
                        aria-selected={activeTab === tab}
                        onClick={() => setActiveTab(tab)}
                        className={`glass-capsule-segment ${activeTab === tab ? 'active' : ''}`}
                      >
                        {tab === 'composition' ? 'Composition' : 'Conseils terrain'}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'composition' && (
                    <div className="space-y-3" role="tabpanel" aria-label="Composition du kit">
                      {(kit.items ?? []).length === 0 ? (
                        <p className="text-sm text-[#5A7064]">Aucun article dans ce kit.</p>
                      ) : (
                        (kit.items ?? []).map((item) => (
                          <div
                            key={item.id}
                            className={`glass-sub-card p-3 flex items-center gap-3 rounded-2xl transition-all cursor-pointer ${
                              selectedItems.has(item.id) ? 'border-[#17402C]/40 bg-white/25' : ''
                            }`}
                            onClick={() => toggleItem(item.id)}
                          >
                            <span className={`glass-check-circle ${selectedItems.has(item.id) ? 'checked' : ''}`}>
                              {selectedItems.has(item.id) && <Icon name="CheckIcon" size={10} className="text-white" />}
                            </span>
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/30">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={item.image} alt={item.alt} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-[#17402C] text-sm truncate">{item.nom}</p>
                                {item.essentiel && (
                                  <span className="glass-pill">Essentiel</span>
                                )}
                                {item.quantite > 1 && (
                                  <span className="text-[10px] font-mono text-[#5A7064]">×{item.quantite}</span>
                                )}
                              </div>
                              <p className="text-xs text-[#5A7064] mt-0.5">{item.categorie} · {item.poids_g}g</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-mono font-bold text-[#17402C] text-sm">{(item.prix_cents / 100).toFixed(2)} €</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === 'conseils' && (
                    <div className="space-y-3" role="tabpanel" aria-label="Conseils terrain">
                      {(kit.conseils ?? []).length === 0 ? (
                        <p className="text-sm text-[#5A7064]">Aucun conseil disponible pour ce kit.</p>
                      ) : (
                        (kit.conseils ?? []).map((conseil, i) => (
                          <div key={i} className="glass-sub-card p-3 rounded-2xl flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-white/25 border border-white/30 flex items-center justify-center flex-shrink-0">
                              <span className="font-mono font-bold text-[10px] text-[#17402C]">{String(i + 1).padStart(2, '0')}</span>
                            </div>
                            <p className="text-sm text-[#365233] leading-relaxed">{conseil}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Sidebar */}
                <div className="lg:col-span-1">
                  <div className="sticky top-24 space-y-4">
                    <GlassCard tone="sage" className="p-5">
                      <h3 className="font-display font-bold text-[#17402C] mb-4">
                        Récapitulatif
                      </h3>
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-[#5A7064]">Articles sélectionnés</span>
                          <span className="font-mono font-bold text-[#17402C]">{selectedItemsData.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#5A7064]">Poids total</span>
                          <span className="font-mono font-bold text-[#17402C]">{(totalPoids / 1000).toFixed(2)} kg</span>
                        </div>
                        <WeightGauge weightG={totalPoids} maxG={15000} size="sm" />
                        <div className="flex justify-between text-base font-bold pt-2 border-t border-white/30">
                          <span className="text-[#17402C]">Total</span>
                          <span className="font-mono text-[#17402C]">{(totalPrix / 100).toFixed(2)} €</span>
                        </div>
                      </div>
                      <button
                        onClick={handleAddAllToCart}
                        disabled={selectedItemsData.length === 0}
                        className="glass-capsule-btn primary w-full justify-center h-11"
                      >
                        {addedToCart ? '✓ Ajouté au panier' : 'Ajouter au panier'}
                      </button>
                    </GlassCard>

                    <GlassCard tone="sage" className="p-5">
                      <h3 className="font-display font-bold text-[#17402C] text-sm mb-3">
                        Infos kit
                      </h3>
                      <div className="space-y-2 text-xs text-[#5A7064]">
                        <div className="flex justify-between">
                          <span>Destination</span>
                          <span className="font-medium text-[#17402C]">{kit.destination}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Saison</span>
                          <span className="font-medium text-[#17402C]">{kit.saison}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Activité</span>
                          <span className="font-medium text-[#17402C]">{kit.activite}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Difficulté</span>
                          <span className={`${difficultePill[kit.difficulte] ?? 'glass-pill'}`}>{kit.difficulte}</span>
                        </div>
                      </div>
                    </GlassCard>
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
          <div className="px-3 pt-3 pb-24 flex flex-col gap-3.5">
            {/* Header with back link */}
            <header className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#5A7064]">
                  {kit.difficulte} · {kit.activite}
                </span>
                <h1 className="font-display font-bold text-[20px] tracking-tight text-[#17402C] truncate">
                  {kit.nom}
                </h1>
              </div>
              <Link
                href="/kits"
                className="glass interactive h-7.5 px-3 rounded-full flex items-center text-xs font-semibold text-[#17402C] border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6)] shrink-0"
              >
                ← Kits
              </Link>
            </header>

            {/* Mobile Hero Card */}
            <GlassCard tone="sage" className="overflow-hidden p-0 border border-white/40">
              <div className="relative h-44 w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={kit.image} alt={kit.alt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#FAF8F5]/95 via-[#FAF8F5]/30 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-xs font-medium text-[#17402C] bg-[rgba(255,255,255,0.92)] border border-[rgba(255,255,255,0.60)] rounded-[9px] px-2 py-1 inline-flex">
                    📍 {kit.destination} · 🗓 {kit.saison}
                  </p>
                </div>
              </div>
            </GlassCard>

            <p className="text-xs text-[#365233] leading-relaxed px-1">{kit.description}</p>

            {/* Animated Tab Pill Selector */}
            <div className="glass-capsule-bar w-full">
              {(['composition', 'conseils'] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`glass-capsule-segment flex-1 ${isActive ? 'active' : ''}`}
                  >
                    {tab === 'composition' ? 'Composition' : 'Conseils'}
                  </button>
                );
              })}
            </div>

            {activeTab === 'composition' && (
              <div className="flex flex-col gap-2">
                {(kit.items ?? []).length === 0 ? (
                  <p className="text-xs text-[#5A7064] p-4 text-center">Aucun article dans ce kit.</p>
                ) : (
                  (kit.items ?? []).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`glass-sub-card p-3 flex items-center gap-3 cursor-pointer rounded-2xl transition-all ${
                        selectedItems.has(item.id) ? 'border-[#17402C]/40 bg-white/25' : ''
                      }`}
                    >
                      <span className={`glass-check-circle ${selectedItems.has(item.id) ? 'checked' : ''}`}>
                        {selectedItems.has(item.id) && <span className="text-[10px] font-bold">✓</span>}
                      </span>
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/30">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.image} alt={item.alt} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-xs text-[#17402C] truncate">{item.nom}</span>
                          {item.essentiel && (
                            <span className="glass-pill !px-1.5 !py-0.5 !text-[9px]">
                              Essentiel
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#5A7064] mt-0.5">{item.categorie} · {item.poids_g}g</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-bold text-[#17402C]">{(item.prix_cents / 100).toFixed(2)} €</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'conseils' && (
              <div className="flex flex-col gap-2">
                {(kit.conseils ?? []).length === 0 ? (
                  <p className="text-xs text-[#5A7064] p-4 text-center">Aucun conseil disponible pour ce kit.</p>
                ) : (
                  (kit.conseils ?? []).map((conseil, i) => (
                    <div key={i} className="glass-sub-card p-3 rounded-2xl flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-white/25 border border-white/30 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-mono font-bold text-[#17402C]">{String(i + 1).padStart(2, '0')}</span>
                      </div>
                      <p className="text-xs text-[#365233] leading-relaxed">{conseil}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Mobile Summary CTA */}
            <GlassCard tone="sage" className="p-4 rounded-2xl flex flex-col gap-3 mt-2">
              <h3 className="font-display font-bold text-sm text-[#17402C]">Récapitulatif</h3>
              <div className="flex justify-between text-xs text-[#5A7064]">
                <span>Articles sélectionnés</span>
                <span className="font-mono font-bold text-[#17402C]">{selectedItemsData.length}</span>
              </div>
              <div className="flex justify-between text-xs text-[#5A7064]">
                <span>Poids total</span>
                <span className="font-mono font-bold text-[#17402C]">{(totalPoids / 1000).toFixed(2)} kg</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-white/30">
                <span className="text-[#17402C]">Total</span>
                <span className="font-mono text-[#17402C]">{(totalPrix / 100).toFixed(2)} €</span>
              </div>
              <button
                type="button"
                onClick={handleAddAllToCart}
                disabled={selectedItemsData.length === 0}
                className="glass-capsule-btn primary w-full justify-center h-11 text-xs mt-1"
              >
                {addedToCart ? '✓ Ajouté au panier' : 'Ajouter au panier'}
              </button>
            </GlassCard>

            {/* Kit Info */}
            <GlassCard tone="sage" className="p-4 rounded-2xl flex flex-col gap-2">
              <h3 className="font-display font-bold text-xs text-[#17402C] mb-1">Détails du kit</h3>
              <div className="flex flex-col gap-1.5 text-xs">
                {[
                  { label: 'Destination', value: kit.destination },
                  { label: 'Saison', value: kit.saison },
                  { label: 'Activité', value: kit.activite },
                  { label: 'Difficulté', value: kit.difficulte },
                ].map((info) => (
                  <div key={info.label} className="flex justify-between py-0.5">
                    <span className="text-[#5A7064]">{info.label}</span>
                    <span className="font-medium text-[#17402C]">{info.value}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
