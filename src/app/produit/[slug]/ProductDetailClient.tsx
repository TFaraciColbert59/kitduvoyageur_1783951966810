'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WeightGauge from '@/components/WeightGauge';
import TopoSeparator from '@/components/TopoSeparator';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { saveCart, getCart } from '@/lib/cart';

// ── Types ──────────────────────────────────────────────────────────────────────
type ListingType = 'neuf' | 'kit' | 'occasion' | 'enchere' | 'location';

interface ProductSpec {
  label: string;
  value: string;
}

interface ProductReview {
  author: string;
  rating: number;
  comment: string;
  date: string;
  verified: boolean;
}

interface KitItem {
  id: string;
  nom: string;
  categorie: string;
  poids_g: number;
  prix_cents: number;
  quantite: number;
  slug: string;
  image: string;
  alt: string;
}

interface Product {
  id: string;
  slug: string;
  nom: string;
  marque: string;
  reference: string;
  prix_cents: number;
  poids_g: number;
  poids_max_g: number;
  categorie: string;
  description: string;
  images: { url: string; alt: string }[];
  specs: ProductSpec[];
  tags: string[];
  stock: number;
  note: number;
  avis_count: number;
  reviews: ProductReview[];
  // Listing-type specific
  listing_type?: ListingType;
  etat?: 'comme_neuf' | 'bon_etat' | 'etat_correct';
  prix_depart_cents?: number;
  enchere_actuelle_cents?: number;
  date_fin_enchere?: string;
  nombre_encherisseurs?: number;
  prix_jour_cents?: number;
  caution_cents?: number;
  composition?: KitItem[];
  vendeur_nom?: string;
  vendeur_trust_score?: number;
}

const ETAT_LABELS: Record<string, { label: string; cls: string }> = {
  comme_neuf: { label: 'Comme neuf', cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
  bon_etat: { label: 'Bon état', cls: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
  etat_correct: { label: 'État correct', cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
};

const TYPE_LABELS: Record<ListingType, string> = {
  neuf: 'Neuf',
  kit: 'Kit assemblé',
  occasion: 'Occasion',
  enchere: 'Enchère',
  location: 'Location',
};

// ── Mock product (fallback) ────────────────────────────────────────────────────
const mockProduct: Product = {
  id: '1',
  slug: 'sac-a-dos-osprey-atmos-65',
  nom: 'Osprey Atmos AG 65',
  marque: 'Osprey',
  reference: 'OSP-ATM65-M-GRN',
  prix_cents: 34900,
  poids_g: 2180,
  poids_max_g: 4000,
  categorie: 'Sacs à dos',
  description: "Le sac à dos de randonnée ultime pour les longues distances. Le système Anti-Gravity d'Osprey offre un confort exceptionnel même chargé, grâce à son dos en filet tendu qui laisse circuler l'air.",
  images: [
    { url: 'https://img.rocket.new/generatedImages/rocket_gen_img_1de5a8766-1772222096368.png', alt: 'Sac à dos Osprey Atmos AG 65 vert forêt, vue de face avec bretelles ergonomiques' },
    { url: 'https://img.rocket.new/generatedImages/rocket_gen_img_1850f09c6-176554483.png', alt: 'Détail du système de dos Anti-Gravity Osprey avec filet aéré' },
    { url: 'https://images.unsplash.com/photo-1723825001909-1e45b76a9555', alt: 'Randonneur portant le sac Osprey en montagne avec vue panoramique' },
  ],
  specs: [
    { label: 'Volume', value: '65 L' },
    { label: 'Poids', value: '2 180 g' },
    { label: 'Matière', value: 'Nylon 100D / 210D' },
    { label: 'Dos', value: 'Anti-Gravity AG' },
    { label: 'Ceinture', value: 'Réglable, amovible' },
    { label: 'Accès', value: 'Haut + bas + côté' },
    { label: 'Poche hydratation', value: '3 L compatible' },
    { label: 'Taille', value: 'M/L (dos 46–51 cm)' },
    { label: 'Garantie', value: 'À vie (All Mighty)' },
    { label: 'Origine', value: 'Conçu aux USA' },
  ],
  tags: ['Randonnée', 'Trekking', 'Multi-jours', 'Montagne'],
  stock: 8,
  note: 4.8,
  avis_count: 247,
  reviews: [
    { author: 'Marie L.', rating: 5, comment: 'Utilisé 3 semaines sur le GR20 avec 14 kg. Aucune douleur dorsale, le système AG est bluffant.', date: '2024-08-12', verified: true },
    { author: 'Thomas R.', rating: 5, comment: "Confort incroyable même en longue journée. L'accès bas est très pratique.", date: '2024-07-03', verified: true },
    { author: 'Sophie M.', rating: 4, comment: 'Excellent sac, léger pour sa capacité. Juste un peu cher mais la qualité justifie le prix.', date: '2024-06-18', verified: false },
  ],
  listing_type: 'neuf',
};

const relatedProducts = [
  { id: '2', nom: 'Tente MSR Hubba Hubba NX', prix_cents: 54900, poids_g: 1540, image: 'https://images.unsplash.com/photo-1722607731217-31b4aee4b2d4', alt: 'Tente légère MSR Hubba Hubba NX orange montée en bivouac montagne', reason: 'Complément idéal pour votre trek multi-jours' },
  { id: '3', nom: 'Sac de couchage Cumulus Panyam 450', prix_cents: 28900, poids_g: 890, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_175618416-1783673001212.png', alt: 'Sac de couchage duvet Cumulus Panyam 450 bleu compact', reason: 'Souvent acheté ensemble' },
  { id: '4', nom: 'Bâtons Black Diamond Trail Ergo', prix_cents: 8900, poids_g: 510, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_102d3d253-1767017230132.png', alt: 'Paire de bâtons de randonnée Black Diamond Trail Ergo en aluminium', reason: 'Accessoire recommandé pour la catégorie' },
];

// ── Countdown hook ─────────────────────────────────────────────────────────────
function useCountdown(endDate?: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!endDate) return;
    const update = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return; }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  return timeLeft;
}

// ── Action Zone Components ─────────────────────────────────────────────────────
function ActionZoneNeuf({ product, onAddToCart, added }: { product: Product; onAddToCart: () => void; added: boolean }) {
  const [quantity, setQuantity] = useState(1);
  const formatPrice = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €';

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-display font-700 text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{formatPrice(product.prix_cents)}</p>
          <p className="text-sm text-muted-foreground mt-0.5">TVA incluse · Livraison gratuite dès 50 €</p>
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
          <span className={`w-2 h-2 rounded-full ${product.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
          {product.stock > 0 ? `${product.stock} en stock` : 'Rupture de stock'}
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex items-center border border-border rounded-full overflow-hidden">
          <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-11 h-11 flex items-center justify-center hover:bg-muted transition-colors" aria-label="Diminuer">
            <Icon name="MinusIcon" size={16} variant="outline" />
          </button>
          <span className="w-10 text-center font-mono text-sm font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>{quantity}</span>
          <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="w-11 h-11 flex items-center justify-center hover:bg-muted transition-colors" aria-label="Augmenter">
            <Icon name="PlusIcon" size={16} variant="outline" />
          </button>
        </div>
        <button
          onClick={onAddToCart}
          disabled={product.stock === 0}
          className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all min-h-[44px] ${added ? 'bg-green-600 text-white' : 'bg-primary hover:bg-primary/90 text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Icon name={added ? 'CheckIcon' : 'ShoppingBagIcon'} size={18} variant="outline" />
          {added ? 'Ajouté au panier !' : 'Ajouter au panier'}
        </button>
      </div>
    </div>
  );
}

function ActionZoneOccasion({ product }: { product: Product }) {
  const formatPrice = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €';
  const etatInfo = ETAT_LABELS[product.etat ?? 'bon_etat'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 rounded-full text-xs font-600 border ${etatInfo.cls}`}>{etatInfo.label}</span>
        <span className="text-xs text-muted-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>Certifié authentique</span>
      </div>
      <div className="topo-card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Prix occasion</span>
          <span className="text-2xl font-display font-700 text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{formatPrice(product.prix_cents)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Prix neuf estimé</span>
          <span className="line-through font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{formatPrice(Math.round(product.prix_cents * 1.6))}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <Icon name="ArrowTrendingDownIcon" size={12} variant="outline" />
          Économie de {Math.round((1 - 1 / 1.6) * 100)}% vs neuf
        </div>
      </div>
      {product.vendeur_nom && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon name="UserCircleIcon" size={14} variant="outline" />
          Vendu par <span className="text-foreground font-medium">{product.vendeur_nom}</span>
          {product.vendeur_trust_score && (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono text-[10px]" style={{ fontFamily: 'var(--font-mono)' }}>
              Trust {product.vendeur_trust_score}
            </span>
          )}
        </div>
      )}
      <button className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all min-h-[44px]">
        <Icon name="ShoppingBagIcon" size={18} variant="outline" />
        Acheter cet article d&apos;occasion
      </button>
      <button className="w-full flex items-center justify-center gap-2 py-2.5 px-6 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 text-sm transition-all">
        <Icon name="ShieldCheckIcon" size={14} variant="outline" />
        Voir le certificat d&apos;authenticité
      </button>
    </div>
  );
}

function ActionZoneEnchere({ product }: { product: Product }) {
  const [offerAmount, setOfferAmount] = useState('');
  const countdown = useCountdown(product.date_fin_enchere);
  const formatPrice = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €';
  const currentBid = product.enchere_actuelle_cents ?? product.prix_depart_cents ?? 0;
  const minNext = currentBid + (product.prix_depart_cents ? Math.round(product.prix_depart_cents * 0.05) : 500);

  return (
    <div className="space-y-4">
      <div className="topo-card p-4 border-orange-500/20 border">
        <p className="text-xs font-mono text-orange-400 uppercase tracking-widest mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Enchère en cours</p>
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Enchère actuelle</p>
            <p className="text-3xl font-display font-700 text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{formatPrice(currentBid)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-0.5">{product.nombre_encherisseurs ?? 0} enchérisseurs</p>
            <p className="text-xs font-mono text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>Départ : {formatPrice(product.prix_depart_cents ?? 0)}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { val: countdown.days, label: 'j' },
            { val: countdown.hours, label: 'h' },
            { val: countdown.minutes, label: 'min' },
            { val: countdown.seconds, label: 's' },
          ].map(({ val, label }) => (
            <div key={label} className="bg-background rounded-lg py-2">
              <p className="font-mono text-xl font-700 text-orange-400" style={{ fontFamily: 'var(--font-mono)' }}>{String(val).padStart(2, '0')}</p>
              <p className="text-[10px] text-muted-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          value={offerAmount}
          onChange={(e) => setOfferAmount(e.target.value)}
          placeholder={`Min. ${(minNext / 100).toFixed(0)} €`}
          className="flex-1 px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
        />
        <button className="flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all">
          <Icon name="BoltIcon" size={16} variant="outline" />
          Enchérir
        </button>
      </div>
      <p className="text-xs text-muted-foreground text-center">Incrément minimum : {formatPrice(minNext - currentBid)}</p>
    </div>
  );
}

function ActionZoneLocation({ product }: { product: Product }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const formatPrice = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €';

  const nbDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const diff = new Date(endDate).getTime() - new Date(startDate).getTime();
    return Math.max(0, Math.ceil(diff / 86400000));
  }, [startDate, endDate]);

  const totalPrice = nbDays * (product.prix_jour_cents ?? 0);

  return (
    <div className="space-y-4">
      <div className="topo-card p-4 border-purple-500/20 border">
        <p className="text-xs font-mono text-purple-400 uppercase tracking-widest mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Tarifs location</p>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Prix / jour</span>
          <span className="font-mono text-xl font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{formatPrice(product.prix_jour_cents ?? 0)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Caution</span>
          <span className="font-mono font-600 text-yellow-400" style={{ fontFamily: 'var(--font-mono)' }}>{formatPrice(product.caution_cents ?? 0)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Début</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1.5">Fin</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary" />
        </div>
      </div>
      {nbDays > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary/5 border border-primary/20">
          <span className="text-sm text-muted-foreground">{nbDays} jour{nbDays > 1 ? 's' : ''}</span>
          <span className="font-mono font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{formatPrice(totalPrice)} + {formatPrice(product.caution_cents ?? 0)} caution</span>
        </div>
      )}
      <button className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm transition-all min-h-[44px]">
        <Icon name="CalendarDaysIcon" size={18} variant="outline" />
        Réserver ces dates
      </button>
      <p className="text-xs text-muted-foreground text-center">
        <Icon name="ShieldCheckIcon" size={12} variant="outline" className="inline mr-1" />
        Caution restituée après retour vérifié
      </p>
    </div>
  );
}

function ActionZoneKit({ product }: { product: Product }) {
  const formatPrice = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €';

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-display font-700 text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{formatPrice(product.prix_cents)}</p>
          <p className="text-sm text-muted-foreground mt-0.5">Kit complet · Livraison gratuite</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-600 bg-blue-500/15 text-blue-400 border border-blue-500/30">Kit assemblé</span>
      </div>
      <button className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all min-h-[44px]">
        <Icon name="ShoppingBagIcon" size={18} variant="outline" />
        Ajouter le kit au panier
      </button>
      <p className="text-xs text-muted-foreground text-center">Tous les articles du kit expédiés ensemble</p>
    </div>
  );
}

// ── AI Panels ──────────────────────────────────────────────────────────────────
function AIDescriptionPanel({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (result) { setOpen(true); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Génère une description enrichie et engageante pour ce produit outdoor en français. Ton cohérent, professionnel, orienté terrain. 3-4 phrases max.\n\nProduit: ${product.nom}\nMarque: ${product.marque}\nCatégorie: ${product.categorie}\nSpécifications: ${product.specs.map(s => `${s.label}: ${s.value}`).join(', ')}\nDescription brute: ${product.description}`,
          }],
          model: 'gemini-2.0-flash',
        }),
      });
      const data = await res.json();
      setResult(data.content ?? data.message ?? 'Description non disponible.');
    } catch {
      setResult('Description IA temporairement indisponible.');
    } finally {
      setLoading(false);
    }
  }, [product, result]);

  return (
    <div className="topo-card p-5 border-info/20 border">
      <button onClick={generate} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <Icon name="SparklesIcon" size={16} variant="outline" className="text-info flex-shrink-0" />
          <span className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Description enrichie par IA</span>
        </div>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} variant="outline" className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="mt-4 pt-4 border-t border-border">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">{[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-info animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
              Génération en cours…
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed">{result}</p>
          )}
        </div>
      )}
    </div>
  );
}

function AIComparatorPanel({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (result) { setOpen(true); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Génère un tableau de comparaison entre ce produit et 2-3 alternatives comparables (même catégorie, gamme de prix proche). Format: lignes avec critères clés (poids, prix, confort, garantie). Inclus un verdict final en 1 phrase. En français.\n\nProduit: ${product.nom} (${product.marque})\nCatégorie: ${product.categorie}\nPrix: ${(product.prix_cents / 100).toFixed(0)}€\nSpecs: ${product.specs.slice(0, 5).map(s => `${s.label}: ${s.value}`).join(', ')}`,
          }],
          model: 'gemini-2.0-flash',
        }),
      });
      const data = await res.json();
      setResult(data.content ?? data.message ?? 'Comparaison non disponible.');
    } catch {
      setResult('Comparateur IA temporairement indisponible.');
    } finally {
      setLoading(false);
    }
  }, [product, result]);

  return (
    <div className="topo-card p-5 border-info/20 border">
      <button onClick={generate} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <Icon name="ArrowsRightLeftIcon" size={16} variant="outline" className="text-info flex-shrink-0" />
          <span className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Comparateur intelligent IA</span>
        </div>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} variant="outline" className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="mt-4 pt-4 border-t border-border">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">{[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-info animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
              Analyse des alternatives en cours…
            </div>
          ) : (
            <div className="space-y-1">
              {result?.split('\n').map((line, i) => (
                <p key={i} className={`text-sm ${line.toLowerCase().includes('verdict') ? 'font-semibold text-foreground mt-3 pt-3 border-t border-border' : 'text-muted-foreground'}`}>
                  {line.replace(/\*\*/g, '')}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AIFAQPanel({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [faqs, setFaqs] = useState<{ q: string; a: string }[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const generate = useCallback(async () => {
    if (faqs.length) { setOpen(true); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Génère 4 questions-réponses FAQ pertinentes pour ce produit outdoor, basées sur ses specs réelles et les avis clients. Questions concrètes, réponses courtes (2-3 phrases). Format JSON: [{"q":"...","a":"..."}]. En français.\n\nProduit: ${product.nom}\nSpecs: ${product.specs.map(s => `${s.label}: ${s.value}`).join(', ')}\nAvis: ${product.reviews.map(r => r.comment).join(' | ')}`,
          }],
          model: 'gemini-2.0-flash',
        }),
      });
      const data = await res.json();
      const text = data.content ?? data.message ?? '[]';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) setFaqs(JSON.parse(match[0]));
      else setFaqs([{ q: 'FAQ temporairement indisponible', a: 'Veuillez réessayer.' }]);
    } catch {
      setFaqs([{ q: 'FAQ temporairement indisponible', a: 'Veuillez réessayer.' }]);
    } finally {
      setLoading(false);
    }
  }, [product, faqs]);

  return (
    <div className="topo-card p-5 border-info/20 border">
      <button onClick={generate} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <Icon name="QuestionMarkCircleIcon" size={16} variant="outline" className="text-info flex-shrink-0" />
          <span className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>FAQ générée par IA</span>
        </div>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} variant="outline" className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">{[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-info animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
              Génération des questions…
            </div>
          ) : faqs.map((faq, i) => (
            <div key={i} className="border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{faq.q}</span>
                <Icon name={openIdx === i ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={12} variant="outline" className="text-muted-foreground flex-shrink-0" />
              </button>
              {openIdx === i && (
                <div className="px-4 pb-3 text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">{faq.a}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AIReviewSummaryPanel({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ pros: string[]; cons: string[]; verdict: string } | null>(null);

  const generate = useCallback(async () => {
    if (result) { setOpen(true); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `Analyse ces avis clients et génère un résumé structuré. Format JSON: {"pros":["...","..."],"cons":["..."],"verdict":"..."}. 2-3 points forts, 1-2 points faibles, verdict 1 phrase. En français.\n\nAvis: ${product.reviews.map(r => `${r.rating}/5 - ${r.comment}`).join('\n')}`,
          }],
          model: 'gemini-2.0-flash',
        }),
      });
      const data = await res.json();
      const text = data.content ?? data.message ?? '{}';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) setResult(JSON.parse(match[0]));
      else setResult({ pros: ['Qualité reconnue'], cons: ['Prix élevé'], verdict: 'Produit recommandé.' });
    } catch {
      setResult({ pros: ['Qualité reconnue'], cons: ['Prix élevé'], verdict: 'Résumé temporairement indisponible.' });
    } finally {
      setLoading(false);
    }
  }, [product, result]);

  return (
    <div className="topo-card p-5 border-info/20 border">
      <button onClick={generate} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <Icon name="ChatBubbleLeftRightIcon" size={16} variant="outline" className="text-info flex-shrink-0" />
          <span className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Résumé IA des avis clients</span>
        </div>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} variant="outline" className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="mt-4 pt-4 border-t border-border">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">{[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-info animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
              Analyse des avis…
            </div>
          ) : result && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Points forts</p>
                {result.pros.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground mb-1">
                    <Icon name="CheckCircleIcon" size={14} variant="outline" className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    {p}
                  </div>
                ))}
              </div>
              {result.cons.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-red-400 uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Points faibles</p>
                  {result.cons.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground mb-1">
                      <Icon name="ExclamationCircleIcon" size={14} variant="outline" className="text-red-400 flex-shrink-0 mt-0.5" />
                      {c}
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-2 border-t border-border">
                <p className="text-sm font-medium text-foreground">{result.verdict}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ProductDetailClient() {
  const product = mockProduct;
  const [activeImage, setActiveImage] = useState(0);
  const [addedToCart, setAddedToCart] = useState(false);
  const [activeTab, setActiveTab] = useState<'specs' | 'reviews' | 'composition'>('specs');

  const listingType: ListingType = product.listing_type ?? 'neuf';

  const formatPrice = (cents: number) => (cents / 100).toFixed(2).replace('.', ',') + ' €';

  const handleAddToCart = useCallback(() => {
    const existing = getCart();
    const idx = existing.findIndex((i) => i.id === product.id);
    if (idx >= 0) existing[idx].quantity += 1;
    else existing.push({
      id: product.id,
      slug: product.slug,
      name: product.nom,
      brand: product.marque,
      category: product.categorie,
      priceEur: product.prix_cents / 100,
      weightG: product.poids_g,
      quantity: 1,
      image: product.images[0]?.url ?? '',
      imageAlt: product.images[0]?.alt ?? '',
    });
    saveCart(existing);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2500);
  }, [product]);

  // Show composition tab for kits
  useEffect(() => {
    if (listingType === 'kit') setActiveTab('composition');
  }, [listingType]);

  const weightPercent = Math.round((product.poids_g / product.poids_max_g) * 100);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main id="main-content" className="pt-20">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/" className="hover:text-foreground transition-colors">Accueil</Link>
            <Icon name="ChevronRightIcon" size={14} variant="outline" aria-hidden="true" />
            <Link href="/shop" className="hover:text-foreground transition-colors">Shop</Link>
            <Icon name="ChevronRightIcon" size={14} variant="outline" aria-hidden="true" />
            {listingType !== 'neuf' && (
              <>
                <Link href={`/shop?type=${listingType}`} className="hover:text-foreground transition-colors capitalize">
                  {TYPE_LABELS[listingType]}
                </Link>
                <Icon name="ChevronRightIcon" size={14} variant="outline" aria-hidden="true" />
              </>
            )}
            <span className="text-foreground font-medium truncate max-w-[200px]" aria-current="page">{product.nom}</span>
          </nav>
        </div>

        {/* Product Main */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

            {/* Images Gallery */}
            <div className="space-y-4">
              <div className="aspect-square rounded-2xl overflow-hidden bg-card border border-border relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.images[activeImage]?.url} alt={product.images[activeImage]?.alt} className="w-full h-full object-cover" />
                {/* Type badge overlay */}
                {listingType !== 'neuf' && (
                  <div className="absolute top-4 left-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-600 backdrop-blur-sm ${
                      listingType === 'kit' ? 'bg-blue-500/80 text-white' :
                      listingType === 'occasion' ? 'bg-yellow-500/80 text-white' :
                      listingType === 'enchere'? 'bg-orange-500/80 text-white' : 'bg-purple-500/80 text-white'
                    }`}>
                      {TYPE_LABELS[listingType]}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${activeImage === i ? 'border-primary' : 'border-border hover:border-accent'}`}
                    aria-label={`Voir image ${i + 1}`}
                    aria-pressed={activeImage === i}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="w-full h-full object-cover" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-info uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>{product.marque}</span>
                  <span className="text-muted-foreground" aria-hidden="true">·</span>
                  <span className="text-xs font-mono text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{product.reference}</span>
                </div>
                <h1 className="font-display font-700 text-3xl text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>{product.nom}</h1>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1" aria-label={`Note : ${product.note} sur 5`}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <svg key={s} className={`w-4 h-4 ${s <= Math.round(product.note) ? 'text-yellow-400' : 'text-border'}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-sm font-mono text-info" style={{ fontFamily: 'var(--font-mono)' }}>{product.note} ({product.avis_count} avis)</span>
                </div>
              </div>

              {/* Weight Gauge — common to all types */}
              <div className="topo-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Gabarit de poids</span>
                  <span className="font-mono text-lg font-semibold text-info" style={{ fontFamily: 'var(--font-mono)' }}>{product.poids_g} g</span>
                </div>
                <WeightGauge weightG={product.poids_g} maxG={product.poids_max_g} />
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs font-mono text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>0 g</span>
                  <span className="text-xs font-mono text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{product.poids_max_g} g</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{weightPercent}% du poids de référence · {product.categorie}</p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2" aria-label="Catégories">
                {product.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">{tag}</span>
                ))}
              </div>

              {/* ── CONDITIONAL ACTION ZONE ── */}
              {listingType === 'neuf' && <ActionZoneNeuf product={product} onAddToCart={handleAddToCart} added={addedToCart} />}
              {listingType === 'kit' && <ActionZoneKit product={product} />}
              {listingType === 'occasion' && <ActionZoneOccasion product={product} />}
              {listingType === 'enchere' && <ActionZoneEnchere product={product} />}
              {listingType === 'location' && <ActionZoneLocation product={product} />}
            </div>
          </div>
        </section>

        {/* ── AI PANELS (all types) ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="SparklesIcon" size={16} variant="outline" className="text-info" />
            <h2 className="font-display font-700 text-lg text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Intelligence artificielle</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AIDescriptionPanel product={product} />
            <AIComparatorPanel product={product} />
            <AIFAQPanel product={product} />
            <AIReviewSummaryPanel product={product} />
          </div>
        </section>

        <TopoSeparator />

        {/* Tabs: Specs / Reviews / Composition */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex gap-1 mb-8 border-b border-border" role="tablist" aria-label="Informations produit">
            {listingType === 'kit' && (
              <button
                role="tab"
                aria-selected={activeTab === 'composition'}
                onClick={() => setActiveTab('composition')}
                className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${activeTab === 'composition' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                Composition du kit
              </button>
            )}
            <button
              role="tab"
              aria-selected={activeTab === 'specs'}
              onClick={() => setActiveTab('specs')}
              className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${activeTab === 'specs' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              Caractéristiques
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'reviews'}
              onClick={() => setActiveTab('reviews')}
              className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${activeTab === 'reviews' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              Avis ({product.avis_count})
            </button>
          </div>

          {/* Composition tab — kit only */}
          {activeTab === 'composition' && listingType === 'kit' && (
            <div role="tabpanel" aria-label="Composition du kit">
              {(product.composition ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Composition non disponible.</p>
              ) : (
                <div className="space-y-3">
                  {(product.composition ?? []).map((item) => (
                    <Link key={item.id} href={`/produit/${item.slug}`} className="flex items-center gap-4 p-4 topo-card hover:border-primary/30 transition-colors group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image} alt={item.alt} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider" style={{ fontFamily: 'var(--font-mono)' }}>{item.categorie}</p>
                        <p className="font-display font-700 text-sm text-foreground group-hover:text-primary transition-colors" style={{ fontFamily: 'var(--font-display)' }}>{item.nom}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{item.poids_g} g · Qté : {item.quantite}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-mono font-700 text-foreground text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{formatPrice(item.prix_cents)}</p>
                        <Icon name="ChevronRightIcon" size={14} variant="outline" className="text-muted-foreground mt-1 ml-auto" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Specs tab */}
          {activeTab === 'specs' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="tabpanel" aria-label="Caractéristiques">
              {product.specs.map((spec) => (
                <div key={spec.label} className="flex items-center justify-between py-3 px-4 rounded-xl bg-card border border-border">
                  <span className="text-sm text-muted-foreground">{spec.label}</span>
                  <span className="font-mono text-sm font-semibold text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{spec.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Reviews tab */}
          {activeTab === 'reviews' && (
            <div className="space-y-4" role="tabpanel" aria-label="Avis clients">
              {product.reviews.map((review, i) => (
                <div key={i} className="topo-card p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-semibold text-foreground text-sm">{review.author}</span>
                      {review.verified && <span className="ml-2 text-xs text-green-600 font-medium">✓ Achat vérifié</span>}
                    </div>
                    <div className="flex items-center gap-1" aria-label={`Note : ${review.rating} sur 5`}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <svg key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? 'text-yellow-400' : 'text-border'}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                  <p className="text-xs font-mono text-muted-foreground mt-2" style={{ fontFamily: 'var(--font-mono)' }}>{review.date}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <TopoSeparator inverted />

        {/* Recommendations — multi-signal */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-display font-700 text-2xl text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Complétez votre kit</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {relatedProducts.map((p) => (
              <Link key={p.id} href={`/produit/${p.id}`} className="topo-card group overflow-hidden block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl">
                <div className="aspect-[4/3] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt={p.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground text-sm mb-2 group-hover:text-primary transition-colors">{p.nom}</h3>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-sm font-semibold text-info" style={{ fontFamily: 'var(--font-mono)' }}>{p.poids_g} g</span>
                    <span className="font-display font-700 text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{formatPrice(p.prix_cents)}</span>
                  </div>
                  {/* Recommendation reason */}
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                    <Icon name="SparklesIcon" size={10} variant="outline" className="text-info flex-shrink-0" />
                    {p.reason}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}