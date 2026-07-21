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

const FALLBACK_KITS: Record<string, KitData> = {
  'islande-trek': {
    id: 'islande-trek',
    slug: 'islande-trek',
    nom: 'Kit Islande — Trek & Volcans',
    description: 'Équipement complet pour affronter les conditions extrêmes islandaises : vent violent, pluie horizontale, froid et terrains volcaniques. Ce kit a été conçu avec des guides locaux pour garantir sécurité et confort dans l\'une des destinations les plus sauvages d\'Europe.',
    destination: 'Islande',
    saison: 'Juin – Août',
    poids_total_g: 11400,
    prix_cents: 189000,
    difficulte: 'Intermédiaire',
    activite: 'Trek',
    image: 'https://images.unsplash.com/photo-1531168556467-80aace0d0144?w=1200&q=80',
    alt: 'Paysage volcanique islandais avec randonneurs sous les aurores boréales',
    conseils: [
      'Prévoyez des couches imperméables même en été — la météo change en 10 minutes',
      'Les vents peuvent dépasser 100 km/h sur les hauts plateaux',
      'Emportez un filtre à eau : les rivières glaciaires sont potables',
      'Réservez vos refuges (huts) 6 mois à l\'avance pour le Laugavegur',
      'Chargeur solaire indispensable — les journées sont longues mais les prises rares',
    ],
    items: [
      { id: '1', nom: 'Veste imperméable Gore-Tex', categorie: 'Vêtements', poids_g: 380, prix_cents: 32000, quantite: 1, essentiel: true, slug: 'veste-gore-tex', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80', alt: 'Veste imperméable rouge Gore-Tex' },
      { id: '2', nom: 'Sac à dos 50L Osprey', categorie: 'Sac à dos', poids_g: 1650, prix_cents: 22000, quantite: 1, essentiel: true, slug: 'osprey-farpoint-40', image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&q=80', alt: 'Sac à dos Osprey 50L vert' },
      { id: '3', nom: 'Tente 3 saisons MSR', categorie: 'Bivouac', poids_g: 1800, prix_cents: 45000, quantite: 1, essentiel: true, slug: 'msr-hubba-hubba', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80', alt: 'Tente MSR orange montée dans un paysage volcanique' },
      { id: '4', nom: 'Sac de couchage -10°C', categorie: 'Bivouac', poids_g: 1100, prix_cents: 28000, quantite: 1, essentiel: true, slug: 'sac-couchage-10', image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400&q=80', alt: 'Sac de couchage bleu compact' },
      { id: '5', nom: 'Chaussures de trek Salomon', categorie: 'Chaussures', poids_g: 720, prix_cents: 18000, quantite: 1, essentiel: true, slug: 'salomon-x-ultra-4', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80', alt: 'Chaussures de randonnée Salomon grises' },
      { id: '6', nom: 'Filtre à eau Katadyn', categorie: 'Eau', poids_g: 64, prix_cents: 4500, quantite: 1, essentiel: true, slug: 'katadyn-befree', image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=400&q=80', alt: 'Filtre à eau Katadyn bleu' },
      { id: '7', nom: 'Réchaud MSR PocketRocket', categorie: 'Cuisine', poids_g: 73, prix_cents: 5500, quantite: 1, essentiel: false, slug: 'msr-pocketrocket', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', alt: 'Réchaud compact MSR PocketRocket' },
      { id: '8', nom: 'Bâtons de randonnée Leki', categorie: 'Accessoires', poids_g: 480, prix_cents: 12000, quantite: 1, essentiel: false, slug: 'leki-micro-vario', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80', alt: 'Bâtons de randonnée Leki pliables' },
    ],
  },
  'gr20-corse': {
    id: 'gr20-corse',
    slug: 'gr20-corse',
    nom: 'Kit GR20 — Corse Intégrale',
    description: 'Le kit optimisé pour le GR20, l\'un des sentiers les plus exigeants d\'Europe. 180 km en autonomie complète à travers les montagnes corses. Chaque gramme compte sur ce parcours légendaire.',
    destination: 'Corse',
    saison: 'Juin – Septembre',
    poids_total_g: 9800,
    prix_cents: 145000,
    difficulte: 'Expert',
    activite: 'Trek',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80',
    alt: 'Sentier de montagne en Corse avec vue sur les crêtes granitiques',
    conseils: [
      'Partez du nord (Calenzana) pour avoir le vent dans le dos',
      'Réservez les refuges PNRC dès janvier — complets en juillet',
      'Poids cible : 10 kg max sac chargé pour préserver les genoux',
      'Emportez des crampons légers pour les névés en juin',
      'La chaleur peut être intense en juillet — partez à l\'aube',
    ],
    items: [
      { id: '1', nom: 'Sac à dos 35L ultraléger', categorie: 'Sac à dos', poids_g: 890, prix_cents: 28000, quantite: 1, essentiel: true, slug: 'sac-ultralight-35', image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&q=80', alt: 'Sac à dos ultraléger 35L orange' },
      { id: '2', nom: 'Tente ultralight 1 personne', categorie: 'Bivouac', poids_g: 980, prix_cents: 55000, quantite: 1, essentiel: true, slug: 'tente-ultralight', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80', alt: 'Tente ultraléger verte dans un paysage montagneux' },
      { id: '3', nom: 'Sac de couchage 0°C plume', categorie: 'Bivouac', poids_g: 680, prix_cents: 38000, quantite: 1, essentiel: true, slug: 'sac-plume-0', image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400&q=80', alt: 'Sac de couchage en plume compact' },
      { id: '4', nom: 'Chaussures trail La Sportiva', categorie: 'Chaussures', poids_g: 580, prix_cents: 22000, quantite: 1, essentiel: true, slug: 'la-sportiva-trango', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80', alt: 'Chaussures de trail La Sportiva jaunes' },
      { id: '5', nom: 'Filtre à eau Sawyer Squeeze', categorie: 'Eau', poids_g: 85, prix_cents: 3500, quantite: 1, essentiel: true, slug: 'sawyer-squeeze', image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=400&q=80', alt: 'Filtre à eau Sawyer Squeeze bleu' },
      { id: '6', nom: 'Veste coupe-vent légère', categorie: 'Vêtements', poids_g: 120, prix_cents: 8500, quantite: 1, essentiel: true, slug: 'veste-coupe-vent', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80', alt: 'Veste coupe-vent légère bleue' },
    ],
  },
  'vanlife-europe': {
    id: 'vanlife-europe',
    slug: 'vanlife-europe',
    nom: 'Kit Vanlife — Europe',
    description: 'Tout ce qu\'il faut pour vivre et dormir dans son van à travers l\'Europe. Compact, fonctionnel, durable. Ce kit a été testé sur 50 000 km de routes européennes.',
    destination: 'Europe',
    saison: 'Toute l\'année',
    poids_total_g: 15200,
    prix_cents: 210000,
    difficulte: 'Débutant',
    activite: 'Vanlife',
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200&q=80',
    alt: 'Van aménagé garé dans un paysage naturel européen au coucher du soleil',
    conseils: [
      'Investissez dans un bon matelas — vous y passerez 1/3 de votre temps',
      'Panneau solaire 200W + batterie 100Ah = autonomie électrique complète',
      'Abonnement iOverlander ou Park4Night pour trouver les spots',
      'Douche solaire 20L suffit pour 2 personnes en été',
      'Assurance van aménagé : vérifiez la couverture "habitation mobile"',
    ],
    items: [
      { id: '1', nom: 'Matelas van mousse haute densité', categorie: 'Couchage', poids_g: 4500, prix_cents: 18000, quantite: 1, essentiel: true, slug: 'matelas-van', image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400&q=80', alt: 'Matelas confortable dans un van aménagé' },
      { id: '2', nom: 'Réchaud 2 feux camping-gaz', categorie: 'Cuisine', poids_g: 1200, prix_cents: 8500, quantite: 1, essentiel: true, slug: 'rechaud-2-feux', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', alt: 'Réchaud 2 feux camping-gaz compact' },
      { id: '3', nom: 'Glacière électrique 40L', categorie: 'Cuisine', poids_g: 8500, prix_cents: 35000, quantite: 1, essentiel: false, slug: 'glaciere-electrique', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80', alt: 'Glacière électrique portable blanche' },
      { id: '4', nom: 'Panneau solaire 200W', categorie: 'Électronique', poids_g: 5200, prix_cents: 28000, quantite: 1, essentiel: true, slug: 'panneau-solaire-200w', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', alt: 'Panneau solaire flexible sur toit de van' },
      { id: '5', nom: 'Douche solaire 20L', categorie: 'Hygiène', poids_g: 450, prix_cents: 2500, quantite: 1, essentiel: false, slug: 'douche-solaire', image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=400&q=80', alt: 'Douche solaire noire suspendue à un van' },
    ],
  },
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
    } catch {
      // Supabase failed — use static fallback data
      const fallback = FALLBACK_KITS[slug];
      if (fallback) {
        setKit(fallback);
        setSelectedItems(new Set((fallback.items ?? []).filter((i) => i.essentiel).map((i) => i.id)));
      } else {
        setError('Kit introuvable');
      }
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
