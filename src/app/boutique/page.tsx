'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

import { saveCart, getCart } from '@/lib/cart';

type Tab = 'catalogue' | 'kits' | 'occasion' | 'encheres' | 'location' | 'recommandations';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'catalogue', label: 'Catalogue', icon: 'ArchiveBoxIcon' },
  { id: 'kits', label: 'Kits', icon: 'CubeIcon' },
  { id: 'occasion', label: 'Occasion', icon: 'TagIcon' },
  { id: 'encheres', label: 'Enchères', icon: 'BoltIcon' },
  { id: 'location', label: 'Location', icon: 'KeyIcon' },
  { id: 'recommandations', label: 'Recommandations', icon: 'LightBulbIcon' },
];

const CONDITION_LABELS: Record<string, { label: string; color: string }> = {
  comme_neuf: { label: 'Comme neuf', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  tres_bon: { label: 'Très bon', color: 'text-green-600 bg-green-50 border-green-200' },
  bon: { label: 'Bon état', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  acceptable: { label: 'Acceptable', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  excellent: { label: 'Excellent', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
};

const CATEGORIES = ['Tous', 'Sacs', 'Tentes', 'Vêtements', 'Chaussures', 'Éclairage', 'Cuisine', 'Eau', 'Sécurité', 'Sommeil', 'Bâtons'];

// ─── Catalogue Tab ─────────────────────────────────────────────────────────────
function CatalogueTab() {
  const [products, setProducts] = useState<{ id: string; slug: string; name: string; brand: string; category: string; price_eur: number; image: string; image_alt: string; badge?: string }[]>([]);
  const [cat, setCat] = useState('Tous');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.from('products').select('id, slug, name, brand, category, price_eur, image, image_alt, badge').order('featured', { ascending: false }).limit(12).then(({ data }) => {
      setProducts(data ?? []);
      setLoading(false);
    });
  }, [supabase]);

  const filtered = products.filter((p) => (cat === 'Tous' || p.category === cat) && p.name.toLowerCase().includes(search.toLowerCase()));

  const handleAddToCart = (product: typeof products[0]) => {
    const existing = getCart();
    const idx = existing.findIndex((i) => i.id === product.id);
    if (idx >= 0) existing[idx].quantity += 1;
    else existing.push({ id: product.id, slug: product.slug, name: product.name, brand: product.brand, category: product.category, priceEur: product.price_eur, weightG: 0, quantity: 1, image: product.image, imageAlt: product.image_alt });
    saveCart(existing);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5C6B5E]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un produit..." className="w-full pl-9 pr-4 py-2.5 bg-[#EDEAE0] border border-[#C8C3B0] rounded-xl text-sm focus:outline-none focus:border-[#E4501C]" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-3 py-2 rounded-xl text-xs font-600 whitespace-nowrap transition-all ${cat === c ? 'bg-[#1C2620] text-white' : 'bg-[#EDEAE0] border border-[#C8C3B0] text-[#5C6B5E] hover:border-[#1C2620]/30'}`}>{c}</button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-48 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden group">
              <div className="relative h-40 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.image_alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                {p.badge && <span className="absolute top-2 left-2 text-[10px] font-700 bg-[#E4501C] text-white px-2 py-0.5 rounded-full">{p.badge}</span>}
              </div>
              <div className="p-3">
                <p className="text-[10px] text-[#5C6B5E] mb-0.5">{p.brand} · {p.category}</p>
                <p className="font-600 text-sm text-[#1C2620] mb-2 line-clamp-2">{p.name}</p>
                <div className="flex items-center justify-between">
                  <span className="font-display font-700 text-[#1C2620]">{p.price_eur}€</span>
                  <button onClick={() => handleAddToCart(p)} className="p-2 bg-[#E4501C] text-white rounded-xl hover:bg-[#E4501C]/90 transition-all">
                    <Icon name="ShoppingCartIcon" size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="text-center">
        <Link href="/catalogue" className="inline-flex items-center gap-2 px-6 py-3 border border-[#C8C3B0] rounded-xl text-sm font-600 text-[#5C6B5E] hover:text-[#1C2620] hover:border-[#1C2620]/30 transition-all">
          Voir tout le catalogue <Icon name="ArrowRightIcon" size={14} />
        </Link>
      </div>
    </div>
  );
}

// ─── Kits Tab ─────────────────────────────────────────────────────────────────
function KitsTab() {
  const [kits, setKits] = useState<{ id: string; slug: string; nom: string; destination: string; activite: string; nb_articles: number; poids_total_g: number; prix_cents: number; image: string; alt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.from('kits').select('id, slug, nom, destination, activite, nb_articles, poids_total_g, prix_cents, image, alt').order('featured', { ascending: false }).limit(4).then(({ data }) => {
      setKits(data ?? []);
      setLoading(false);
    });
  }, [supabase]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-700 text-xl text-[#1C2620]">Kits prêts à partir</h2>
        <Link href="/ai-configurator" className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          <Icon name="SparklesIcon" size={14} /> Configurateur IA
        </Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-48 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {kits.map((k) => (
            <div key={k.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden">
              <div className="relative h-44 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={k.image} alt={k.alt} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  <p className="text-[10px] text-white/70 mb-0.5">{k.destination} · {k.activite}</p>
                  <h3 className="font-display font-700 text-white">{k.nom}</h3>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-4 mb-3 text-xs text-[#5C6B5E]">
                  <span>{k.nb_articles} articles</span>
                  <span>{(k.poids_total_g / 1000).toFixed(1)} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-display font-700 text-[#1C2620] text-xl">{(k.prix_cents / 100).toLocaleString()}€</span>
                  <Link href={`/kits/${k.slug}`} className="btn-primary px-4 py-2 text-sm">Voir le kit</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Occasion Tab ─────────────────────────────────────────────────────────────
function OccasionTab() {
  const [items, setItems] = useState<{ id: string; title: string; price: number; original_price: number; condition: string; location: string; image: string; alt: string; negotiable: boolean; shipping: boolean; seller?: { full_name: string; trust_score: number } }[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.from('occasion_items').select('*, seller:user_profiles!occasion_items_seller_id_fkey(full_name, trust_score)').eq('status', 'active').order('created_at', { ascending: false }).limit(6).then(({ data }) => {
      setItems(data ?? []);
      setLoading(false);
    });
  }, [supabase]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-700 text-xl text-[#1C2620]">Matériel d&apos;occasion</h2>
          <p className="text-xs text-[#5C6B5E] mt-0.5">Vendeurs vérifiés par Trust Score · Paiement sécurisé</p>
        </div>
        <button className="btn-primary px-4 py-2 text-sm flex items-center gap-2"><Icon name="PlusIcon" size={14} /> Vendre</button>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-48 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-[#5C6B5E]">
          <Icon name="TagIcon" size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun article d&apos;occasion disponible</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => {
            const cond = CONDITION_LABELS[item.condition] ?? CONDITION_LABELS['bon'];
            const discount = item.original_price > 0 ? Math.round((1 - item.price / item.original_price) * 100) : 0;
            const sellerName = item.seller?.full_name ?? 'Vendeur';
            return (
              <div key={item.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden">
                <div className="relative h-40 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image} alt={item.alt} className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full border ${cond.color}`}>{cond.label}</span>
                    {discount > 0 && <span className="text-[10px] font-700 bg-[#E4501C] text-white px-2 py-0.5 rounded-full">-{discount}%</span>}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-600 text-sm text-[#1C2620] mb-2">{item.title}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-[#E4501C]/20 flex items-center justify-center text-[10px] font-700 text-[#E4501C]">{sellerName[0]}</div>
                    <span className="text-xs text-[#5C6B5E]">{sellerName} · Trust {item.seller?.trust_score ?? 70}</span>
                    <span className="ml-auto text-xs text-[#5C6B5E]">📍 {item.location}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3 text-[10px] text-[#5C6B5E]">
                    {item.negotiable && <span className="bg-blue-50 border border-blue-200 text-blue-600 px-2 py-0.5 rounded-full">Négociable</span>}
                    {item.shipping && <span className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-2 py-0.5 rounded-full">Envoi possible</span>}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-display font-700 text-[#1C2620] text-lg">{item.price}€</span>
                      {item.original_price > 0 && <span className="text-xs text-[#5C6B5E] line-through ml-1">{item.original_price}€</span>}
                    </div>
                    <button className="btn-primary px-4 py-1.5 text-sm">Contacter</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Enchères Tab ─────────────────────────────────────────────────────────────
function EncheresTab() {
  const [auctions, setAuctions] = useState<{ id: string; title: string; current_bid: number; buy_now_price: number; condition: string; ends_at: string; bids_count: number; watchers_count: number; image: string; alt: string; seller?: { full_name: string; trust_score: number } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<Record<string, string>>({});
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.from('auction_items').select('*, seller:user_profiles!auction_items_seller_id_fkey(full_name, trust_score)').eq('status', 'active').order('ends_at', { ascending: true }).limit(6).then(({ data }) => {
      setAuctions(data ?? []);
      setLoading(false);
    });
  }, [supabase]);

  useEffect(() => {
    const calc = () => {
      const now = new Date().getTime();
      const updated: Record<string, string> = {};
      auctions.forEach((a) => {
        const diff = new Date(a.ends_at).getTime() - now;
        if (diff <= 0) { updated[a.id] = 'Terminé'; return; }
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        updated[a.id] = `${h}h ${m}m`;
      });
      setTimeLeft(updated);
    };
    calc();
    const t = setInterval(calc, 30000);
    return () => clearInterval(t);
  }, [auctions]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-700 text-xl text-[#1C2620]">Enchères en cours</h2>
        <span className="text-xs text-[#5C6B5E]">{auctions.length} enchère{auctions.length !== 1 ? 's' : ''}</span>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3].map((i) => <div key={i} className="h-48 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
      ) : auctions.length === 0 ? (
        <div className="text-center py-12 text-[#5C6B5E]">
          <Icon name="BoltIcon" size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune enchère en cours</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {auctions.map((a) => {
            const cond = CONDITION_LABELS[a.condition] ?? CONDITION_LABELS['bon'];
            return (
              <div key={a.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden">
                <div className="relative h-40 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.image} alt={a.alt} className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2">
                    <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full border ${cond.color}`}>{cond.label}</span>
                  </div>
                  <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-mono px-2 py-0.5 rounded-full">
                    ⏱ {timeLeft[a.id] ?? '...'}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-600 text-sm text-[#1C2620] mb-3">{a.title}</h3>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[10px] text-[#5C6B5E]">Enchère actuelle</p>
                      <p className="font-display font-700 text-[#1C2620] text-lg">{a.current_bid}€</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#5C6B5E]">Achat immédiat</p>
                      <p className="font-mono font-700 text-[#E4501C]">{a.buy_now_price}€</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#5C6B5E] mb-3">
                    <span>{a.bids_count} enchère{a.bids_count !== 1 ? 's' : ''}</span>
                    <span>{a.watchers_count} observateurs</span>
                  </div>
                  <button className="w-full btn-primary py-2 text-sm">Enchérir</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Location Tab ─────────────────────────────────────────────────────────────
function LocationTab() {
  const [rentals, setRentals] = useState<{ id: string; title: string; price_per_day: number; price_per_week: number; deposit: number; condition: string; location: string; available: boolean; rating: number; reviews_count: number; image: string; alt: string; owner?: { full_name: string; trust_score: number } }[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.from('rental_items').select('*, owner:user_profiles!rental_items_owner_id_fkey(full_name, trust_score)').order('rating', { ascending: false }).limit(6).then(({ data }) => {
      setRentals(data ?? []);
      setLoading(false);
    });
  }, [supabase]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-700 text-xl text-[#1C2620]">Location de matériel</h2>
          <p className="text-xs text-[#5C6B5E] mt-0.5">Matériel vérifié · Caution sécurisée</p>
        </div>
        <button className="btn-primary px-4 py-2 text-sm flex items-center gap-2"><Icon name="PlusIcon" size={14} /> Louer mon matériel</button>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-48 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
      ) : rentals.length === 0 ? (
        <div className="text-center py-12 text-[#5C6B5E]">
          <Icon name="KeyIcon" size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun article en location disponible</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rentals.map((r) => {
            const ownerName = r.owner?.full_name ?? 'Propriétaire';
            return (
              <div key={r.id} className={`bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden ${!r.available ? 'opacity-60' : ''}`}>
                <div className="relative h-40 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.image} alt={r.alt} className="w-full h-full object-cover" />
                  {!r.available && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-700 text-sm">Indisponible</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-600 text-sm text-[#1C2620] mb-2">{r.title}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-[#E4501C]/20 flex items-center justify-center text-[10px] font-700 text-[#E4501C]">{ownerName[0]}</div>
                    <span className="text-xs text-[#5C6B5E]">{ownerName} · Trust {r.owner?.trust_score ?? 70}</span>
                    <span className="ml-auto text-xs text-[#5C6B5E]">📍 {r.location}</span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-display font-700 text-[#1C2620]">{r.price_per_day}€</span>
                      <span className="text-xs text-[#5C6B5E]">/jour</span>
                      {r.price_per_week > 0 && <span className="text-xs text-[#5C6B5E] ml-2">{r.price_per_week}€/sem</span>}
                    </div>
                    <span className="text-xs text-[#5C6B5E]">Caution {r.deposit}€</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-amber-500 text-xs">★</span>
                      <span className="text-xs font-600 text-[#1C2620]">{r.rating}</span>
                      <span className="text-xs text-[#5C6B5E]">({r.reviews_count})</span>
                    </div>
                    <button disabled={!r.available} className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50">Réserver</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Recommandations Tab ──────────────────────────────────────────────────────
function RecommandationsTab() {
  const [products, setProducts] = useState<{ id: string; slug: string; name: string; brand: string; price_eur: number; image: string; image_alt: string; badge?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.from('products').select('id, slug, name, brand, price_eur, image, image_alt, badge').eq('featured', true).limit(4).then(({ data }) => {
      setProducts(data ?? []);
      setLoading(false);
    });
  }, [supabase]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-700 text-xl text-[#1C2620]">Recommandations pour vous</h2>
        <Link href="/ai-configurator" className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
          <Icon name="SparklesIcon" size={14} /> Configurateur IA
        </Link>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-[#C8C3B0]/30 rounded-2xl animate-pulse" />)}</div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 text-[#5C6B5E]">
          <Icon name="LightBulbIcon" size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune recommandation disponible</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((p) => (
            <div key={p.id} className="bg-[#EDEAE0] border border-[#C8C3B0] rounded-2xl overflow-hidden flex gap-4 p-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.image_alt} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[#5C6B5E] mb-0.5">{p.brand}</p>
                <p className="font-600 text-sm text-[#1C2620] mb-1 line-clamp-2">{p.name}</p>
                {p.badge && <span className="text-[10px] font-700 bg-[#E4501C]/10 text-[#E4501C] px-2 py-0.5 rounded-full">{p.badge}</span>}
                <div className="flex items-center justify-between mt-2">
                  <span className="font-display font-700 text-[#1C2620]">{p.price_eur}€</span>
                  <Link href={`/produit/${p.slug}`} className="text-xs text-[#E4501C] font-600 hover:underline">Voir →</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function BoutiquePage() {
  const [activeTab, setActiveTab] = useState<Tab>('catalogue');

  const tabContent: Record<Tab, React.ReactNode> = {
    catalogue: <CatalogueTab />,
    kits: <KitsTab />,
    occasion: <OccasionTab />,
    encheres: <EncheresTab />,
    location: <LocationTab />,
    recommandations: <RecommandationsTab />,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <div className="pt-16 lg:pt-18">
        <section className="bg-dark-bg text-white py-12 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary blur-3xl" />
          </div>
          <div className="max-w-7xl mx-auto relative">
            <div className="flex items-center gap-2 mb-4">
              <span className="tag-badge bg-primary/30 text-orange-300 border border-primary/30 text-[10px]">BOUTIQUE</span>
            </div>
            <h1 className="text-section-title text-white mb-3">La boutique<br /><span className="text-primary">du voyageur</span></h1>
            <p className="text-white/60 text-base max-w-xl">Catalogue, kits, occasion, enchères, location et recommandations IA — tout en un seul endroit.</p>
          </div>
        </section>

        <section className="sticky top-16 z-30 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex gap-0 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-4 text-sm font-600 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon name={tab.icon} size={15} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {tabContent[activeTab]}
        </div>
      </div>
      <Footer />
    </div>
  );
}