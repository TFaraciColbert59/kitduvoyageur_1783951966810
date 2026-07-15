'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface OccasionItem {
  id: string;
  slug: string;
  title: string;
  seller: string;
  sellerAvatar: string;
  sellerTrustScore: number;
  sellerSales: number;
  category: string;
  price: number;
  originalPrice: number;
  condition: 'comme_neuf' | 'tres_bon' | 'bon' | 'acceptable';
  location: string;
  postedAt: string;
  image: string;
  alt: string;
  tags: string[];
  description: string;
  negotiable: boolean;
  shippingAvailable: boolean;
  shippingCost?: number;
  dimensions?: string;
  weight?: string;
  brand?: string;
  purchaseYear?: string;
}

const conditionConfig = {
  comme_neuf: { label: 'Comme neuf', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', badge: 'bg-emerald-500' },
  tres_bon: { label: 'Très bon état', color: 'text-blue-700 bg-blue-50 border-blue-200', badge: 'bg-blue-500' },
  bon: { label: 'Bon état', color: 'text-amber-700 bg-amber-50 border-amber-200', badge: 'bg-amber-500' },
  acceptable: { label: 'Acceptable', color: 'text-gray-600 bg-gray-50 border-gray-200', badge: 'bg-gray-400' },
};

function ContactModal({ item, onClose }: { item: OccasionItem; onClose: () => void }) {
  const [message, setMessage] = useState(`Bonjour ${item.seller.split(' ')[0]}, je suis intéressé(e) par votre annonce "${item.title}". Est-il toujours disponible ?`);
  const [sent, setSent] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        {!sent ? (
          <>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-display font-700 text-foreground text-lg">Contacter le vendeur</h3>
                <p className="text-sm text-muted-foreground">{item.seller}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <div className="bg-background rounded-xl border border-border p-3 mb-4">
              <p className="text-xs font-600 text-muted-foreground mb-1">Annonce</p>
              <p className="text-sm font-600 text-foreground">{item.title}</p>
              <p className="text-sm text-primary font-700">{item.price}€</p>
            </div>
            <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Votre message</label>
            <textarea className="input-field resize-none w-full" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
            <div className="flex gap-3 mt-4">
              <button onClick={onClose} className="btn-secondary flex-1 justify-center py-3">Annuler</button>
              <button onClick={() => setSent(true)} className="btn-primary flex-1 justify-center py-3">
                <Icon name="PaperAirplaneIcon" size={16} />Envoyer
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Icon name="CheckIcon" size={28} className="text-emerald-600" />
            </div>
            <h3 className="font-display font-700 text-foreground text-lg mb-2">Message envoyé !</h3>
            <p className="text-sm text-muted-foreground mb-6">{item.seller.split(' ')[0]} vous répondra par email.</p>
            <button onClick={onClose} className="btn-primary justify-center px-8 py-3">Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemDetailModal({ item, onClose }: { item: OccasionItem; onClose: () => void }) {
  const [showContact, setShowContact] = useState(false);
  const cond = conditionConfig[item.condition];
  const discount = item.originalPrice > 0 ? Math.round((1 - item.price / item.originalPrice) * 100) : 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card z-10">
            <h2 className="font-display font-700 text-foreground text-base line-clamp-1">{item.title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"><Icon name="XMarkIcon" size={18} /></button>
          </div>

          <div className="p-5 space-y-5">
            <div className="relative rounded-xl overflow-hidden aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image} alt={item.alt} className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 flex gap-2">
                <span className={`text-xs font-600 px-2 py-1 rounded-full border ${cond.color}`}>{cond.label}</span>
              </div>
              {discount > 0 && (
                <div className="absolute top-3 right-3 bg-primary rounded-lg px-2 py-1">
                  <span className="text-white text-xs font-700">-{discount}%</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display font-800 text-3xl text-foreground">{item.price}€</span>
                  {item.originalPrice > 0 && <span className="text-muted-foreground line-through text-sm">{item.originalPrice}€</span>}
                </div>
                {item.negotiable && <p className="text-xs text-green-500 mt-0.5">Prix négociable</p>}
              </div>
              <button onClick={() => setShowContact(true)} className="btn-primary flex items-center gap-2">
                <Icon name="ChatBubbleLeftIcon" size={16} variant="outline" />
                Contacter
              </button>
            </div>

            {item.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span key={tag} className="px-2.5 py-1 bg-muted rounded-full text-xs text-muted-foreground border border-border">{tag}</span>
                ))}
              </div>
            )}

            <div>
              <h3 className="font-semibold text-foreground mb-2 text-sm">Description</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Marque', value: item.brand },
                { label: 'Année d\'achat', value: item.purchaseYear },
                { label: 'Poids', value: item.weight },
                { label: 'Dimensions', value: item.dimensions },
                { label: 'Livraison', value: item.shippingAvailable ? `Disponible${item.shippingCost ? ` (${item.shippingCost}€)` : ''}` : 'Remise en main propre' },
                { label: 'Localisation', value: item.location },
              ].filter((d) => d.value).map((detail) => (
                <div key={detail.label} className="bg-background rounded-xl p-3 border border-border">
                  <p className="text-[10px] text-muted-foreground mb-0.5">{detail.label}</p>
                  <p className="text-sm font-medium text-foreground">{detail.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-background rounded-xl p-4 border border-border">
              <h3 className="font-semibold text-foreground mb-3 text-sm">Vendeur</h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-700 text-sm flex-shrink-0">
                  {item.sellerAvatar}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm">{item.seller}</p>
                  <p className="text-xs text-muted-foreground">{item.sellerSales} ventes · {item.location}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-foreground text-sm">{item.sellerTrustScore}%</p>
                  <p className="text-[10px] text-muted-foreground">Fiabilité</p>
                </div>
              </div>
            </div>

            <Link
              href={`/produit/${item.slug}?type=occasion`}
              className="w-full py-3 rounded-xl border border-primary/40 text-primary text-sm font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5"
            >
              <Icon name="ArrowTopRightOnSquareIcon" size={14} variant="outline" />
              Voir la fiche produit occasion
            </Link>
          </div>
        </div>
      </div>
      {showContact && <ContactModal item={item} onClose={() => setShowContact(false)} />}
    </>
  );
}

const CATEGORIES = ['Tout', 'Cuisine', 'Chaussures', 'Tentes', 'Éclairage', 'Couchage', 'Bâtons', 'Sacs à dos', 'Navigation', 'Vêtements', 'Escalade', 'Sécurité'];

export default function OccasionPage() {
  const [listings, setListings] = useState<OccasionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<OccasionItem | null>(null);
  const [category, setCategory] = useState('Tout');
  const [sortBy, setSortBy] = useState<'recent' | 'price_asc' | 'price_desc' | 'discount'>('recent');
  const [search, setSearch] = useState('');
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellSent, setSellSent] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase
      .from('occasion_items')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error('Occasion fetch error:', error);
          setLoading(false);
          return;
        }
        const mapped: OccasionItem[] = (data ?? []).map((row: Record<string, unknown>) => {
          const condRaw = (row.condition as string) ?? 'bon';
          const validConditions = ['comme_neuf', 'tres_bon', 'bon', 'acceptable'] as const;
          const condition = validConditions.includes(condRaw as typeof validConditions[number])
            ? (condRaw as OccasionItem['condition'])
            : 'bon';
          return {
            id: row.id as string,
            slug: `occasion-${row.id as string}`,
            title: row.title as string,
            seller: 'Vendeur',
            sellerAvatar: 'V',
            sellerTrustScore: 70,
            sellerSales: 0,
            category: 'Matériel',
            price: Number(row.price ?? 0),
            originalPrice: Number(row.original_price ?? 0),
            condition,
            location: (row.location as string) ?? '',
            postedAt: (row.created_at as string) ?? new Date().toISOString(),
            image: (row.image as string) ?? '',
            alt: (row.alt as string) ?? (row.title as string),
            tags: [],
            description: (row.description as string) ?? '',
            negotiable: Boolean(row.negotiable),
            shippingAvailable: Boolean(row.shipping),
          };
        });
        setListings(mapped);
        setLoading(false);
      });
  }, [supabase]);

  const filtered = listings
    .filter((l) => category === 'Tout' || l.category === category)
    .filter((l) => !search || l.title.toLowerCase().includes(search.toLowerCase()) || l.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'discount') return (b.originalPrice > 0 ? (1 - b.price / b.originalPrice) : 0) - (a.originalPrice > 0 ? (1 - a.price / a.originalPrice) : 0);
      return 0;
    });

  const avgDiscount = listings.length > 0
    ? Math.round(listings.filter(l => l.originalPrice > 0).reduce((s, l) => s + (1 - l.price / l.originalPrice) * 100, 0) / Math.max(listings.filter(l => l.originalPrice > 0).length, 1))
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        {/* Hero */}
        <section className="bg-dark-bg text-white py-10 px-4 border-b border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Icon name="TagIcon" size={20} variant="outline" className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs font-mono text-emerald-400/80 tracking-widest uppercase">Marketplace · Seconde main</p>
                    <h1 className="text-2xl font-display font-800 tracking-tight">Matériel d&apos;occasion</h1>
                  </div>
                </div>
                <p className="text-white/60 text-sm max-w-xl">Achetez et vendez du matériel outdoor de qualité. Économisez jusqu&apos;à 70% sur les meilleures marques.</p>
              </div>
              <button
                onClick={() => setShowSellModal(true)}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/20 whitespace-nowrap"
              >
                <Icon name="PlusIcon" size={18} variant="outline" />
                Vendre mon matériel
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6 max-w-sm">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-display font-700 text-emerald-400">{listings.length}</p>
                <p className="text-xs text-white/50">Annonces</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-display font-700 text-amber-400">{avgDiscount}%</p>
                <p className="text-xs text-white/50">Remise moy.</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-display font-700 text-blue-400">{listings.filter((l) => l.condition === 'comme_neuf' || l.condition === 'tres_bon').length}</p>
                <p className="text-xs text-white/50">Très bon état</p>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Icon name="MagnifyingGlassIcon" size={16} variant="outline" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher un article..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-9 w-full"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${category === cat ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
            >
              <option value="recent">Plus récent</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
              <option value="discount">Meilleure remise</option>
            </select>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-72 bg-card border border-border rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Icon name="MagnifyingGlassIcon" size={32} variant="outline" className="mx-auto mb-3 opacity-30" />
              <p>Aucun article trouvé</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((item) => {
                const cond = conditionConfig[item.condition];
                const discount = item.originalPrice > 0 ? Math.round((1 - item.price / item.originalPrice) * 100) : 0;
                return (
                  <div
                    key={item.id}
                    className="topo-card group flex flex-col cursor-pointer hover:border-primary/20 transition-all"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="relative overflow-hidden aspect-[4/3]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image} alt={item.alt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      <div className="absolute top-3 left-3">
                        <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full border ${cond.color}`}>{cond.label}</span>
                      </div>
                      {discount > 0 && (
                        <div className="absolute top-3 right-3 bg-primary rounded-lg px-2 py-1">
                          <span className="text-white text-xs font-700">-{discount}%</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-1 gap-3">
                      <div>
                        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{item.category}</p>
                        <h3 className="font-display font-700 text-foreground text-base leading-tight">{item.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                      <div className="flex items-center gap-2 mt-auto">
                        <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-700 flex-shrink-0">
                          {item.sellerAvatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground font-500 truncate">{item.seller}</p>
                          <p className="text-[10px] text-muted-foreground">{item.location}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-display font-700 text-foreground text-lg">{item.price}€</p>
                          {item.originalPrice > 0 && <p className="text-[10px] text-muted-foreground line-through">{item.originalPrice}€</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedItem(item); }}
                          className="flex-1 py-2 text-xs font-medium bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-all"
                        >
                          Voir l&apos;annonce
                        </button>
                        <Link
                          href={`/produit/${item.slug}?type=occasion`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-2 rounded-lg border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 transition-colors flex items-center"
                        >
                          <Icon name="ArrowTopRightOnSquareIcon" size={13} variant="outline" />
                        </Link>
                        {item.shippingAvailable && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-muted rounded-lg">
                            <Icon name="TruckIcon" size={12} variant="outline" className="text-muted-foreground" />
                            {item.shippingCost && <span className="text-[10px] text-muted-foreground">{item.shippingCost}€</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {selectedItem && <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}

      {/* Sell Modal */}
      {showSellModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSellModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            {!sellSent ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display font-700 text-foreground text-lg">Vendre mon matériel</h3>
                  <button onClick={() => setShowSellModal(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Icon name="XMarkIcon" size={18} /></button>
                </div>
                <div className="space-y-3">
                  <input type="text" className="input-field w-full" placeholder="Titre de l'annonce *" />
                  <input type="text" className="input-field w-full" placeholder="Marque et modèle" />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" className="input-field w-full" placeholder="Prix demandé (€) *" />
                    <input type="number" className="input-field w-full" placeholder="Prix neuf (€)" />
                  </div>
                  <select className="input-field w-full">
                    <option value="">État de l&apos;article *</option>
                    <option>Comme neuf</option>
                    <option>Très bon état</option>
                    <option>Bon état</option>
                    <option>Acceptable</option>
                  </select>
                  <textarea className="input-field w-full resize-none" rows={3} placeholder="Description détaillée *" />
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setShowSellModal(false)} className="btn-secondary flex-1 justify-center py-3">Annuler</button>
                  <button onClick={() => setSellSent(true)} className="btn-primary flex-1 justify-center py-3">Publier l&apos;annonce</button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckIcon" size={28} className="text-emerald-600" />
                </div>
                <h3 className="font-display font-700 text-foreground text-lg mb-2">Annonce publiée !</h3>
                <p className="text-sm text-muted-foreground mb-6">Votre annonce sera visible après validation par notre équipe.</p>
                <button onClick={() => { setShowSellModal(false); setSellSent(false); }} className="btn-primary justify-center px-8 py-3">Fermer</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}