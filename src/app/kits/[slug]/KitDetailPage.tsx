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

const difficulteColor: Record<string, string> = {
  Débutant: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  Intermédiaire: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  Expert: 'text-red-400 bg-red-400/10 border-red-400/30',
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
          <div className="min-h-screen bg-background text-foreground">
            <Header />
            <div className="pt-16 max-w-7xl mx-auto px-4 py-12">
              <div className="h-72 rounded-xl bg-muted animate-pulse mb-8" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-4">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
                </div>
                <div className="h-64 rounded-xl bg-muted animate-pulse" />
              </div>
            </div>
            <Footer />
          </div>
        </div>

        {/* ── MOBILE ── */}
        <div className="block md:hidden">
          <MobilePageShell>
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50dvh' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid rgba(11,31,23,0.1)', borderTopColor: '#1C2620', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ marginTop: '12px', fontSize: '13px', color: '#6B7A72' }}>Chargement du kit...</p>
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
          <div className="min-h-screen bg-background text-foreground">
            <Header />
            <div className="pt-16 max-w-7xl mx-auto px-4 py-12 text-center">
              <Icon name="ExclamationTriangleIcon" size={40} className="mx-auto mb-4 text-muted-foreground opacity-40" />
              <h1 className="font-display font-700 text-2xl text-foreground mb-2">Kit introuvable</h1>
              <p className="text-muted-foreground mb-6">{error || 'Ce kit n\'existe pas ou a été supprimé.'}</p>
              <Link href="/kits" className="btn-primary">Voir tous les kits</Link>
            </div>
            <Footer />
          </div>
        </div>

        {/* ── MOBILE ── */}
        <div className="block md:hidden">
          <MobilePageShell>
            <div style={{ padding: '16px', textAlign: 'center', paddingTop: '80px' }}>
              <p style={{ fontSize: '40px', marginBottom: '16px' }}>🔧</p>
              <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1C2620', marginBottom: '8px' }}>Kit introuvable</h1>
              <p style={{ fontSize: '14px', color: '#6B7A72', marginBottom: '24px' }}>{error || 'Ce kit n\'existe pas ou a été supprimé.'}</p>
              <Link href="/kits" style={{ display: 'inline-block', padding: '12px 24px', background: '#17402C', color: 'white', borderRadius: '999px', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>Voir tous les kits</Link>
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
        <div className="min-h-screen bg-background text-foreground">
          <Header />

          {/* Hero */}
          <section className="pt-16 relative">
            <div className="relative h-72 md:h-96 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={kit.image} alt={kit.alt} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-dark-bg via-dark-bg/50 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                <div className="max-w-7xl mx-auto">
                  <nav className="flex items-center gap-2 text-xs text-white/50 mb-3" aria-label="Fil d'Ariane">
                    <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
                    <span aria-hidden="true">/</span>
                    <Link href="/kits" className="hover:text-white transition-colors">Kits</Link>
                    <span aria-hidden="true">/</span>
                    <span className="text-white/80" aria-current="page">{kit.nom}</span>
                  </nav>
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${difficulteColor[kit.difficulte]}`} style={{ fontFamily: 'var(--font-mono)' }}>
                          {kit.difficulte.toUpperCase()}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-info/30 text-info bg-info/10" style={{ fontFamily: 'var(--font-mono)' }}>
                          {kit.activite.toUpperCase()}
                        </span>
                      </div>
                      <h1 className="font-display font-800 text-3xl md:text-4xl text-white tracking-tight leading-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                        {kit.nom}
                      </h1>
                      <p className="text-white/60 mt-1 text-sm">
                        📍 {kit.destination} · 🗓 {kit.saison}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Main Content */}
              <div className="lg:col-span-2">
                <p className="text-muted-foreground mb-6 leading-relaxed">{kit.description}</p>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 bg-card rounded-lg p-1 border border-border w-fit" role="tablist" aria-label="Contenu du kit">
                  {(['composition', 'conseils'] as const).map((tab) => (
                    <button
                      key={tab}
                      role="tab"
                      aria-selected={activeTab === tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        activeTab === tab ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab === 'composition' ? 'Composition' : 'Conseils terrain'}
                    </button>
                  ))}
                </div>

                {activeTab === 'composition' && (
                  <div className="space-y-3" role="tabpanel" aria-label="Composition du kit">
                    {(kit.items ?? []).length === 0 ? (
                      <p className="text-muted-foreground text-sm">Aucun article dans ce kit.</p>
                    ) : (
                      (kit.items ?? []).map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                            selectedItems.has(item.id)
                              ? 'border-primary/40 bg-primary/5' :'border-border bg-card hover:border-border/80'
                          }`}
                          onClick={() => toggleItem(item.id)}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                            selectedItems.has(item.id) ? 'bg-primary border-primary' : 'border-border'
                          }`}>
                            {selectedItems.has(item.id) && <Icon name="CheckIcon" size={12} className="text-white" />}
                          </div>
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.image} alt={item.alt} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-foreground text-sm">{item.nom}</p>
                              {item.essentiel && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">
                                  Essentiel
                                </span>
                              )}
                              {item.quantite > 1 && (
                                <span className="text-[10px] text-muted-foreground">×{item.quantite}</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.categorie} · {item.poids_g}g</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-mono text-sm font-600 text-foreground">{(item.prix_cents / 100).toFixed(2)} €</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'conseils' && (
                  <div className="space-y-4" role="tabpanel" aria-label="Conseils terrain">
                    {(kit.conseils ?? []).length === 0 ? (
                      <p className="text-muted-foreground text-sm">Aucun conseil disponible pour ce kit.</p>
                    ) : (
                      (kit.conseils ?? []).map((conseil, i) => (
                        <div key={i} className="flex gap-4 p-4 rounded-xl bg-card border border-border">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="font-mono text-xs font-700 text-primary">{String(i + 1).padStart(2, '0')}</span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{conseil}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-1">
                <div className="sticky top-24 space-y-4">
                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="font-display font-700 text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                      Récapitulatif
                    </h3>
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Articles sélectionnés</span>
                        <span className="font-600 text-foreground">{selectedItemsData.length}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Poids total</span>
                        <span className="font-600 text-foreground">{(totalPoids / 1000).toFixed(2)} kg</span>
                      </div>
                      <WeightGauge weightG={totalPoids} maxG={15000} size="sm" />
                      <div className="flex justify-between text-base font-700 pt-2 border-t border-border">
                        <span className="text-foreground">Total</span>
                        <span className="text-primary font-mono">{(totalPrix / 100).toFixed(2)} €</span>
                      </div>
                    </div>
                    <button
                      onClick={handleAddAllToCart}
                      disabled={selectedItemsData.length === 0}
                      className={`w-full py-3 rounded-xl text-sm font-700 transition-all ${
                        addedToCart
                          ? 'bg-secondary text-white'
                          : selectedItemsData.length === 0
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'btn-primary justify-center'
                      }`}
                    >
                      {addedToCart ? '✓ Ajouté au panier' : 'Ajouter au panier'}
                    </button>
                  </div>

                  <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="font-display font-700 text-foreground text-sm mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                      Infos kit
                    </h3>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Destination</span>
                        <span className="text-foreground font-medium">{kit.destination}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Saison</span>
                        <span className="text-foreground font-medium">{kit.saison}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Activité</span>
                        <span className="text-foreground font-medium">{kit.activite}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Difficulté</span>
                        <span className={`font-medium ${difficulteColor[kit.difficulte]?.split(' ')[0]}`}>{kit.difficulte}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <TopoSeparator color="var(--background)" />
          <Footer />
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
                <div className="absolute inset-0 bg-gradient-to-t from-[#17402C]/90 via-[#17402C]/30 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <p className="text-xs font-medium text-white/90">📍 {kit.destination} · 🗓 {kit.saison}</p>
                </div>
              </div>
            </GlassCard>

            <p className="text-xs text-[#365233] leading-relaxed px-1">{kit.description}</p>

            {/* Animated Tab Pill Selector */}
            <div className="p-1 rounded-full bg-white/[0.08] border border-white/25 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.4)] flex items-center gap-1">
              {(['composition', 'conseils'] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className="relative flex-1 py-1.5 px-3 rounded-full text-xs font-bold text-center transition-colors select-none"
                  >
                    {isActive && (
                      <span
                        className="absolute inset-0 rounded-full bg-[#17402C]/12 border border-[#17402C]/20 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.8),0_2px_8px_rgba(23,64,44,0.08)]"
                      />
                    )}
                    <span className={`relative z-10 ${isActive ? 'text-[#17402C] font-extrabold' : 'text-[#365233]/70'}`}>
                      {tab === 'composition' ? 'Composition' : 'Conseils'}
                    </span>
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
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                        selectedItems.has(item.id) ? 'bg-[#17402C] border-[#17402C] text-white' : 'border-white/40 bg-white/10'
                      }`}>
                        {selectedItems.has(item.id) && <span className="text-[10px] font-bold">✓</span>}
                      </div>
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/30">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.image} alt={item.alt} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-xs text-[#17402C] truncate">{item.nom}</span>
                          {item.essentiel && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 bg-[#17402C]/10 text-[#17402C] rounded-full border border-[#17402C]/20 font-bold">
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
                      <div className="w-6 h-6 rounded-full bg-[#17402C]/10 border border-[#17402C]/20 flex items-center justify-center shrink-0">
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
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-white/20">
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
