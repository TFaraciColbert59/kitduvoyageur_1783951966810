'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WeightGauge from '@/components/WeightGauge';
import TopoSeparator from '@/components/TopoSeparator';
import Icon from '@/components/ui/AppIcon';
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kit introuvable');
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
    );
  }

  if (error || !kit) {
    return (
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
    );
  }

  return (
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
  );
}
