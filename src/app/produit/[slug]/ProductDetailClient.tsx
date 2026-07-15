'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WeightGauge from '@/components/WeightGauge';
import TopoSeparator from '@/components/TopoSeparator';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';

import AuctionZone from '@/components/AuctionZone';
import NewProductZone from '@/components/NewProductZone';
import OccasionProductZone from '@/components/OccasionProductZone';
import { createClient } from '@/lib/supabase/client';

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
  stock_statut?: 'en_stock' | 'rupture' | 'reappro';
  reappro_date?: string;
  note: number;
  avis_count: number;
  reviews: ProductReview[];
  listing_type?: ListingType;
  listing_id?: string;
  etat?: 'comme_neuf' | 'bon_etat' | 'etat_correct';
  prix_depart_cents?: number;
  enchere_actuelle_cents?: number;
  increment_min_cents?: number;
  date_fin_enchere?: string;
  nombre_encherisseurs?: number;
  prix_jour_cents?: number;
  caution_cents?: number;
  vendeur_nom?: string;
  vendeur_trust_score?: number;
  vendeur_nb_ventes?: number;
  vendeur_delai_reponse_heures?: number;
  occasion_statut?: 'en_attente_moderation' | 'active' | 'vendue' | 'retiree' | 'litige';
  faire_offre_active?: boolean;
  historique_produit?: {
    date_achat_origine?: string;
    nombre_proprietaires?: number;
    usage_declare?: string;
  };
  certificat_authenticite?: {
    numero?: string;
    date_emission?: string;
    verifie_par?: string;
  };
  photos_defauts?: { url: string; alt: string; description?: string }[];
  vendeur?: {
    id: string;
    nom: string;
    trust_score: number;
    nb_ventes: number;
    delai_reponse_heures?: number;
    avatar?: string;
  };
  produit_id?: string;
}

const TYPE_LABELS: Record<ListingType, string> = {
  neuf: 'Neuf',
  kit: 'Kit assemblé',
  occasion: 'Occasion',
  enchere: 'Enchère',
  location: 'Location',
};

const relatedProducts = [
  { id: '2', nom: 'Tente MSR Hubba Hubba NX', prix_cents: 54900, poids_g: 1540, image: 'https://images.unsplash.com/photo-1722607731217-31b4aee4b2d4', alt: 'Tente légère MSR Hubba Hubba NX orange montée en bivouac montagne', reason: 'Complément idéal pour votre trek multi-jours' },
  { id: '3', nom: 'Sac de couchage Cumulus Panyam 450', prix_cents: 28900, poids_g: 890, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_175618416-1783673001212.png', alt: 'Sac de couchage duvet Cumulus Panyam 450 bleu compact', reason: 'Souvent acheté ensemble' },
  { id: '4', nom: 'Bâtons Black Diamond Trail Ergo', prix_cents: 8900, poids_g: 510, image: 'https://img.rocket.new/generatedImages/rocket_gen_img_102d3d253-1767017230132.png', alt: 'Paire de bâtons de randonnée Black Diamond Trail Ergo en aluminium', reason: 'Accessoire recommandé pour la catégorie' },
];

// ── Supabase fetch ─────────────────────────────────────────────────────────────
async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const supabase = createClient();

  // Fetch product + its listings
  const { data: productData, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .single();

  if (productError || !productData) return null;

  // Fetch all listings for this product
  const { data: listingsData } = await supabase
    .from('listings')
    .select('*')
    .eq('produit_id', productData.id)
    .order('created_at', { ascending: true });

  const listing = listingsData?.[0] ?? null;

  // Build specs from product fields
  const specs: ProductSpec[] = [
    { label: 'Catégorie', value: productData.category ?? 'N/A' },
    { label: 'Marque', value: productData.brand ?? 'N/A' },
    { label: 'Poids', value: productData.weight_g ? `${productData.weight_g} g` : 'N/A' },
    { label: 'Prix', value: productData.price_eur ? `${Number(productData.price_eur).toFixed(2)} €` : 'N/A' },
  ];

  const product: Product = {
    id: productData.id,
    slug: productData.slug,
    nom: productData.name,
    marque: productData.brand ?? '',
    reference: productData.slug?.toUpperCase().slice(0, 12) ?? '',
    prix_cents: listing?.prix_cents ?? Math.round(Number(productData.price_eur ?? 0) * 100),
    poids_g: productData.weight_g ?? 0,
    poids_max_g: Math.max((productData.weight_g ?? 0) * 2, 5000),
    categorie: productData.category ?? 'Autre',
    description: productData.description ?? '',
    images: productData.image
      ? [{ url: productData.image, alt: productData.image_alt ?? productData.name }]
      : [{ url: 'https://images.unsplash.com/photo-1723825001909-1e45b76a9555', alt: productData.name }],
    specs,
    tags: productData.activity ?? [],
    stock: productData.stock ?? 10,
    stock_statut: listing?.stock_statut ?? productData.stock_statut ?? 'en_stock',
    reappro_date: listing?.reappro_date ?? productData.reappro_date,
    note: 4.5,
    avis_count: 0,
    reviews: [],
    listing_type: listing?.listing_type ?? 'neuf',
    listing_id: listing?.id,
    produit_id: productData.id,
    // Occasion
    etat: listing?.etat ?? 'bon_etat',
    occasion_statut: (listing?.occasion_statut as Product['occasion_statut']) ?? 'active',
    faire_offre_active: listing?.faire_offre_active ?? false,
    historique_produit: listing?.historique_produit ?? undefined,
    certificat_authenticite: listing?.certificat_authenticite ?? undefined,
    photos_defauts: listing?.photos_defauts ?? undefined,
    // Enchère
    prix_depart_cents: listing?.prix_depart_cents ?? 0,
    enchere_actuelle_cents: listing?.enchere_actuelle_cents ?? listing?.prix_depart_cents ?? 0,
    increment_min_cents: listing?.increment_min_cents ?? 500,
    date_fin_enchere: listing?.date_fin_enchere ?? new Date(Date.now() + 7 * 86400000).toISOString(),
    nombre_encherisseurs: listing?.nombre_encherisseurs ?? 0,
    // Location
    prix_jour_cents: listing?.prix_jour_cents ?? 0,
    caution_cents: listing?.caution_cents ?? 0,
    // Vendeur
    vendeur_trust_score: listing?.vendeur_trust_score ?? 0,
    vendeur_nb_ventes: listing?.vendeur_nb_ventes ?? 0,
    vendeur_delai_reponse_heures: listing?.vendeur_delai_reponse_heures ?? undefined,
  };

  return product;
}

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

// ── Location Action Zone ───────────────────────────────────────────────────────
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
            content: `Génère une description enrichie et engageante pour ce produit outdoor en français. Ton cohérent, professionnel, orienté terrain. 3-4 phrases max.\n\nProduit: ${product.nom}\nMarque: ${product.marque}\nCatégorie: ${product.categorie}\nDescription brute: ${product.description}`,
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

// ── Shared: Product Gallery + Info Header ──────────────────────────────────────
function ProductGallery({ product, listingType }: { product: Product; listingType: ListingType }) {
  const [activeImage, setActiveImage] = useState(0);

  const badgeColors: Record<ListingType, string> = {
    neuf: 'bg-emerald-500/80 text-white',
    kit: 'bg-blue-500/80 text-white',
    occasion: 'bg-yellow-500/80 text-white',
    enchere: 'bg-orange-500/80 text-white',
    location: 'bg-purple-500/80 text-white',
  };

  return (
    <div className="space-y-4">
      <div className="aspect-square rounded-2xl overflow-hidden bg-card border border-border relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={product.images[activeImage]?.url} alt={product.images[activeImage]?.alt} className="w-full h-full object-cover" />
        <div className="absolute top-4 left-4">
          <span className={`px-3 py-1 rounded-full text-xs font-600 backdrop-blur-sm ${badgeColors[listingType]}`}>
            {TYPE_LABELS[listingType]}
          </span>
        </div>
      </div>
      {product.images.length > 1 && (
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
      )}
    </div>
  );
}

function ProductInfoHeader({ product }: { product: Product }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono text-info uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>{product.marque}</span>
        <span className="text-muted-foreground" aria-hidden="true">·</span>
        <span className="text-xs font-mono text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{product.reference}</span>
      </div>
      <h1 className="font-display font-700 text-3xl text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>{product.nom}</h1>
      {product.avis_count > 0 && (
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
      )}
    </div>
  );
}

function ProductWeightCard({ product }: { product: Product }) {
  const weightPercent = Math.round((product.poids_g / product.poids_max_g) * 100);
  return (
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
  );
}

function ProductTags({ tags }: { tags: string[] }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-2" aria-label="Catégories">
      {tags.map((tag) => (
        <span key={tag} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">{tag}</span>
      ))}
    </div>
  );
}

function ProductSpecsTab({ product }: { product: Product }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="tabpanel" aria-label="Caractéristiques">
      {product.specs.map((spec) => (
        <div key={spec.label} className="flex items-center justify-between py-3 px-4 rounded-xl bg-card border border-border">
          <span className="text-sm text-muted-foreground">{spec.label}</span>
          <span className="font-mono text-sm font-semibold text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{spec.value}</span>
        </div>
      ))}
    </div>
  );
}

function ProductReviewsTab({ product }: { product: Product }) {
  if (!product.reviews?.length) {
    return <p className="text-sm text-muted-foreground">Aucun avis pour ce produit.</p>;
  }
  return (
    <div className="space-y-4" role="tabpanel" aria-label="Avis clients">
      {product.reviews.map((review, i) => (
        <div key={i} className="topo-card p-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <span className="font-semibold text-foreground text-sm">{review.author}</span>
              {review.verified && <span className="ml-2 text-xs text-green-600 font-medium">✓ Achat vérifié</span>}
            </div>
            <div className="flex items-center gap-1">
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
  );
}

function RelatedProducts({ formatPrice }: { formatPrice: (c: number) => string }) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-16">
      <h2 className="font-display font-700 text-2xl text-foreground mb-8" style={{ fontFamily: 'var(--font-display)' }}>Complétez votre kit</h2>
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
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                <Icon name="SparklesIcon" size={10} variant="outline" className="text-info flex-shrink-0" />
                {p.reason}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── TEMPLATE: NEUF ─────────────────────────────────────────────────────────────
function TemplateNeuf({ product }: { product: Product }) {
  const formatPrice = (cents: number) => (cents / 100).toFixed(2).replace('.', ',') + ' €';
  const [activeTab, setActiveTab] = useState<'specs' | 'reviews'>('specs');

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
            <span className="text-foreground font-medium truncate max-w-[200px]" aria-current="page">{product.nom}</span>
          </nav>
        </div>

        {/* Hero banner — Neuf accent */}
        <div className="bg-gradient-to-r from-emerald-900/30 to-transparent border-b border-emerald-500/10 mb-2">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2">
            <Icon name="SparklesIcon" size={14} variant="outline" className="text-emerald-400" />
            <span className="text-xs text-emerald-400 font-mono uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>Produit neuf · Garantie constructeur · Livraison rapide</span>
          </div>
        </div>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            <ProductGallery product={product} listingType="neuf" />
            <div className="space-y-6">
              <ProductInfoHeader product={product} />
              <ProductWeightCard product={product} />
              <ProductTags tags={product.tags} />
              <NewProductZone
                product={{
                  id: product.id,
                  slug: product.slug,
                  nom: product.nom,
                  marque: product.marque,
                  reference: product.reference,
                  categorie: product.categorie,
                  prix_cents: product.prix_cents,
                  poids_g: product.poids_g,
                  stock: product.stock,
                  stock_statut: product.stock_statut,
                  reappro_date: product.reappro_date,
                  description: product.description,
                  specs: product.specs,
                  tags: product.tags,
                  note: product.note,
                  avis_count: product.avis_count,
                  reviews: product.reviews,
                  images: product.images,
                }}
              />
            </div>
          </div>
        </section>

        <TopoSeparator />

        {/* Tabs */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex gap-1 mb-8 border-b border-border" role="tablist">
            {(['specs', 'reviews'] as const).map((tab) => (
              <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${activeTab === tab ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {tab === 'specs' ? 'Caractéristiques' : `Avis (${product.avis_count})`}
              </button>
            ))}
          </div>
          {activeTab === 'specs' && <ProductSpecsTab product={product} />}
          {activeTab === 'reviews' && <ProductReviewsTab product={product} />}
        </section>

        <TopoSeparator inverted />
        <RelatedProducts formatPrice={formatPrice} />
      </main>
      <Footer />
    </div>
  );
}

// ── TEMPLATE: ENCHÈRE ──────────────────────────────────────────────────────────
function TemplateEnchere({ product }: { product: Product }) {
  const formatPrice = (cents: number) => (cents / 100).toFixed(2).replace('.', ',') + ' €';
  const [activeTab, setActiveTab] = useState<'specs' | 'reviews'>('specs');
  const countdown = useCountdown(product.date_fin_enchere);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main-content" className="pt-20">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/" className="hover:text-foreground transition-colors">Accueil</Link>
            <Icon name="ChevronRightIcon" size={14} variant="outline" aria-hidden="true" />
            <Link href="/encheres" className="hover:text-foreground transition-colors">Enchères</Link>
            <Icon name="ChevronRightIcon" size={14} variant="outline" aria-hidden="true" />
            <span className="text-foreground font-medium truncate max-w-[200px]" aria-current="page">{product.nom}</span>
          </nav>
        </div>

        {/* Urgency banner — Enchère */}
        <div className="bg-gradient-to-r from-orange-900/40 to-transparent border-b border-orange-500/20 mb-2">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="BoltIcon" size={14} variant="outline" className="text-orange-400" />
              <span className="text-xs text-orange-400 font-mono uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>Enchère en cours · {product.nombre_encherisseurs ?? 0} enchérisseurs</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-orange-300" style={{ fontFamily: 'var(--font-mono)' }}>
              <span>Fin dans :</span>
              <span className="font-700">{countdown.days}j {countdown.hours}h {countdown.minutes}m {countdown.seconds}s</span>
            </div>
          </div>
        </div>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            <ProductGallery product={product} listingType="enchere" />
            <div className="space-y-6">
              <ProductInfoHeader product={product} />

              {/* Prix actuel enchère */}
              <div className="topo-card p-4 border-orange-500/30 border bg-orange-500/5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-orange-400 uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>Enchère actuelle</span>
                  <span className="text-xs text-muted-foreground">Départ : {formatPrice(product.prix_depart_cents ?? 0)}</span>
                </div>
                <p className="text-4xl font-display font-700 text-orange-400" style={{ fontFamily: 'var(--font-display)' }}>
                  {formatPrice(product.enchere_actuelle_cents ?? product.prix_depart_cents ?? 0)}
                </p>
              </div>

              <ProductWeightCard product={product} />
              <ProductTags tags={product.tags} />

              <AuctionZone
                listing={{
                  id: product.listing_id ?? product.id,
                  produit_id: product.id,
                  prix_depart_cents: product.prix_depart_cents ?? 0,
                  enchere_actuelle_cents: product.enchere_actuelle_cents ?? product.prix_depart_cents ?? 0,
                  increment_min_cents: product.increment_min_cents ?? 500,
                  date_fin_enchere: product.date_fin_enchere ?? new Date(Date.now() + 7 * 86400000).toISOString(),
                  nombre_encherisseurs: product.nombre_encherisseurs ?? 0,
                  statut: 'actif',
                  vendeur_id: undefined,
                }}
              />

              {/* Description */}
              {product.description && (
                <div className="topo-card p-4">
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Description</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* AI Panel */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
          <div className="mb-4 flex items-center gap-2">
            <Icon name="SparklesIcon" size={16} variant="outline" className="text-info" />
            <h2 className="font-display font-700 text-lg text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Intelligence artificielle</h2>
          </div>
          <AIDescriptionPanel product={product} />
        </section>

        <TopoSeparator />

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex gap-1 mb-8 border-b border-border" role="tablist">
            {(['specs', 'reviews'] as const).map((tab) => (
              <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${activeTab === tab ? 'border-orange-500 text-orange-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {tab === 'specs' ? 'Caractéristiques' : `Avis (${product.avis_count})`}
              </button>
            ))}
          </div>
          {activeTab === 'specs' && <ProductSpecsTab product={product} />}
          {activeTab === 'reviews' && <ProductReviewsTab product={product} />}
        </section>

        <TopoSeparator inverted />
        <RelatedProducts formatPrice={formatPrice} />
      </main>
      <Footer />
    </div>
  );
}

// ── TEMPLATE: LOCATION ─────────────────────────────────────────────────────────
function TemplateLocation({ product }: { product: Product }) {
  const formatPrice = (cents: number) => (cents / 100).toFixed(2).replace('.', ',') + ' €';
  const [activeTab, setActiveTab] = useState<'specs' | 'reviews'>('specs');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main-content" className="pt-20">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/" className="hover:text-foreground transition-colors">Accueil</Link>
            <Icon name="ChevronRightIcon" size={14} variant="outline" aria-hidden="true" />
            <Link href="/location" className="hover:text-foreground transition-colors">Location</Link>
            <Icon name="ChevronRightIcon" size={14} variant="outline" aria-hidden="true" />
            <span className="text-foreground font-medium truncate max-w-[200px]" aria-current="page">{product.nom}</span>
          </nav>
        </div>

        {/* Location banner */}
        <div className="bg-gradient-to-r from-purple-900/40 to-transparent border-b border-purple-500/20 mb-2">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2">
            <Icon name="CalendarDaysIcon" size={14} variant="outline" className="text-purple-400" />
            <span className="text-xs text-purple-400 font-mono uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>
              Location · {formatPrice(product.prix_jour_cents ?? 0)}/jour · Caution {formatPrice(product.caution_cents ?? 0)}
            </span>
          </div>
        </div>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            <ProductGallery product={product} listingType="location" />
            <div className="space-y-6">
              <ProductInfoHeader product={product} />

              {/* Pricing summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="topo-card p-4 border-purple-500/20 border text-center">
                  <p className="text-xs text-muted-foreground mb-1">Prix / jour</p>
                  <p className="text-2xl font-display font-700 text-purple-400" style={{ fontFamily: 'var(--font-display)' }}>{formatPrice(product.prix_jour_cents ?? 0)}</p>
                </div>
                <div className="topo-card p-4 border-yellow-500/20 border text-center">
                  <p className="text-xs text-muted-foreground mb-1">Caution</p>
                  <p className="text-2xl font-display font-700 text-yellow-400" style={{ fontFamily: 'var(--font-display)' }}>{formatPrice(product.caution_cents ?? 0)}</p>
                </div>
              </div>

              <ProductWeightCard product={product} />
              <ProductTags tags={product.tags} />
              <ActionZoneLocation product={product} />

              {/* Conditions de location */}
              <div className="topo-card p-4 space-y-2">
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-3" style={{ fontFamily: 'var(--font-mono)' }}>Conditions de location</p>
                {[
                  { icon: 'ShieldCheckIcon', text: 'Caution restituée après retour vérifié' },
                  { icon: 'TruckIcon', text: 'Livraison et retour inclus dans le prix' },
                  { icon: 'ClockIcon', text: 'Réservation minimum 2 jours' },
                  { icon: 'WrenchScrewdriverIcon', text: 'Matériel vérifié et entretenu' },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon name={icon} size={14} variant="outline" className="text-purple-400 flex-shrink-0" />
                    {text}
                  </div>
                ))}
              </div>

              {product.description && (
                <div className="topo-card p-4">
                  <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-mono)' }}>Description</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <TopoSeparator />

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex gap-1 mb-8 border-b border-border" role="tablist">
            {(['specs', 'reviews'] as const).map((tab) => (
              <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${activeTab === tab ? 'border-purple-500 text-purple-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {tab === 'specs' ? 'Caractéristiques' : `Avis (${product.avis_count})`}
              </button>
            ))}
          </div>
          {activeTab === 'specs' && <ProductSpecsTab product={product} />}
          {activeTab === 'reviews' && <ProductReviewsTab product={product} />}
        </section>

        <TopoSeparator inverted />
        <RelatedProducts formatPrice={formatPrice} />
      </main>
      <Footer />
    </div>
  );
}

// ── TEMPLATE: OCCASION ─────────────────────────────────────────────────────────
function TemplateOccasion({ product }: { product: Product }) {
  const formatPrice = (cents: number) => (cents / 100).toFixed(2).replace('.', ',') + ' €';
  const [activeTab, setActiveTab] = useState<'specs' | 'reviews'>('specs');

  const ETAT_LABELS: Record<string, { label: string; cls: string }> = {
    comme_neuf: { label: 'Comme neuf', cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30' },
    bon_etat: { label: 'Bon état', cls: 'text-blue-400 bg-blue-400/10 border-blue-400/30' },
    etat_correct: { label: 'État correct', cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' },
  };
  const etatInfo = ETAT_LABELS[product.etat ?? 'bon_etat'];
  const savings = Math.round((1 - 1 / 1.6) * 100);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main id="main-content" className="pt-20">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Link href="/" className="hover:text-foreground transition-colors">Accueil</Link>
            <Icon name="ChevronRightIcon" size={14} variant="outline" aria-hidden="true" />
            <Link href="/occasion" className="hover:text-foreground transition-colors">Occasion</Link>
            <Icon name="ChevronRightIcon" size={14} variant="outline" aria-hidden="true" />
            <span className="text-foreground font-medium truncate max-w-[200px]" aria-current="page">{product.nom}</span>
          </nav>
        </div>

        {/* Occasion banner */}
        <div className="bg-gradient-to-r from-yellow-900/30 to-transparent border-b border-yellow-500/10 mb-2">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3">
            <Icon name="TagIcon" size={14} variant="outline" className="text-yellow-400" />
            <span className={`px-2 py-0.5 rounded-full text-xs font-600 border ${etatInfo.cls}`}>{etatInfo.label}</span>
            <span className="text-xs text-yellow-400 font-mono" style={{ fontFamily: 'var(--font-mono)' }}>Économisez {savings}% vs neuf · Certifié authentique</span>
          </div>
        </div>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            <ProductGallery product={product} listingType="occasion" />
            <div className="space-y-6">
              <ProductInfoHeader product={product} />

              {/* Price comparison */}
              <div className="topo-card p-4 border-yellow-500/20 border">
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Prix occasion</p>
                    <p className="text-3xl font-display font-700 text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{formatPrice(product.prix_cents)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Prix neuf estimé</p>
                    <p className="text-sm line-through text-muted-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{formatPrice(Math.round(product.prix_cents * 1.6))}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <Icon name="ArrowTrendingDownIcon" size={12} variant="outline" />
                  Économie de {savings}% vs neuf
                </div>
              </div>

              <ProductWeightCard product={product} />
              <ProductTags tags={product.tags} />

              <OccasionProductZone
                product={{
                  id: product.id,
                  listing_id: product.listing_id ?? product.id,
                  slug: product.slug,
                  nom: product.nom,
                  marque: product.marque,
                  reference: product.reference,
                  categorie: product.categorie,
                  prix_cents: product.prix_cents,
                  poids_g: product.poids_g,
                  description: product.description,
                  specs: product.specs,
                  tags: product.tags,
                  note: product.note,
                  avis_count: product.avis_count,
                  reviews: product.reviews,
                  images: product.images,
                  etat: product.etat ?? 'bon_etat',
                  statut: product.occasion_statut ?? 'active',
                  faire_offre_active: product.faire_offre_active ?? false,
                  historique: product.historique_produit,
                  certificat: product.certificat_authenticite,
                  photos_defauts: product.photos_defauts,
                  vendeur: product.vendeur,
                  produit_id: product.produit_id,
                }}
              />
            </div>
          </div>
        </section>

        <TopoSeparator />

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex gap-1 mb-8 border-b border-border" role="tablist">
            {(['specs', 'reviews'] as const).map((tab) => (
              <button key={tab} role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${activeTab === tab ? 'border-yellow-500 text-yellow-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
                {tab === 'specs' ? 'Caractéristiques' : `Avis (${product.avis_count})`}
              </button>
            ))}
          </div>
          {activeTab === 'specs' && <ProductSpecsTab product={product} />}
          {activeTab === 'reviews' && <ProductReviewsTab product={product} />}
        </section>

        <TopoSeparator inverted />
        <RelatedProducts formatPrice={formatPrice} />
      </main>
      <Footer />
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────
function ProductSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="aspect-square rounded-2xl bg-muted animate-pulse" />
            <div className="space-y-4">
              <div className="h-6 w-32 rounded bg-muted animate-pulse" />
              <div className="h-10 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-24 rounded bg-muted animate-pulse" />
              <div className="h-12 rounded-full bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ── Not Found ──────────────────────────────────────────────────────────────────
function ProductNotFound({ slug }: { slug: string }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 px-4">
          <Icon name="ExclamationCircleIcon" size={48} variant="outline" className="text-muted-foreground mx-auto" />
          <h1 className="font-display font-700 text-2xl text-foreground" style={{ fontFamily: 'var(--font-display)' }}>Produit introuvable</h1>
          <p className="text-muted-foreground">Le produit &quot;{slug}&quot; n&apos;existe pas ou a été retiré.</p>
          <Link href="/shop" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-all">
            <Icon name="ArrowLeftIcon" size={16} variant="outline" />
            Retour au shop
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const data = await fetchProductBySlug(slug);
      if (cancelled) return;
      if (!data) {
        setNotFound(true);
      } else {
        setProduct(data);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return <ProductSkeleton />;
  if (notFound || !product) return <ProductNotFound slug={slug} />;

  const listingType = product.listing_type ?? 'neuf';

  // Route to the correct template based on listing_type
  if (listingType === 'enchere') return <TemplateEnchere product={product} />;
  if (listingType === 'location') return <TemplateLocation product={product} />;
  if (listingType === 'occasion') return <TemplateOccasion product={product} />;

  // Default: neuf (and kit)
  return <TemplateNeuf product={product} />;
}