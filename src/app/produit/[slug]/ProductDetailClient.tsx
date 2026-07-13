'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WeightGauge from '@/components/WeightGauge';
import TopoSeparator from '@/components/TopoSeparator';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';

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
  images: {url: string;alt: string;}[];
  specs: ProductSpec[];
  tags: string[];
  stock: number;
  note: number;
  avis_count: number;
  reviews: ProductReview[];
}

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
  description:
  "Le sac à dos de randonnée ultime pour les longues distances. Le système Anti-Gravity d'Osprey offre un confort exceptionnel même chargé, grâce à son dos en filet tendu qui laisse circuler l'air. Idéal pour les treks de plusieurs jours, le GR20 ou les expéditions en altitude.",
  images: [
  {
    url: 'https://img.rocket.new/generatedImages/rocket_gen_img_1de5a8766-1772222096368.png',
    alt: 'Sac à dos Osprey Atmos AG 65 vert forêt, vue de face avec bretelles ergonomiques'
  },
  {
    url: "https://img.rocket.new/generatedImages/rocket_gen_img_1850f09c6-176554483.png",
    alt: 'Détail du système de dos Anti-Gravity Osprey avec filet aéré'
  },
  {
    url: 'https://images.unsplash.com/photo-1723825001909-1e45b76a9555',
    alt: 'Randonneur portant le sac Osprey en montagne avec vue panoramique'
  }],

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
  { label: 'Origine', value: 'Conçu aux USA' }],

  tags: ['Randonnée', 'Trekking', 'Multi-jours', 'Montagne'],
  stock: 8,
  note: 4.8,
  avis_count: 247,
  reviews: [
  {
    author: 'Marie L.',
    rating: 5,
    comment:
    'Utilisé 3 semaines sur le GR20 avec 14 kg. Aucune douleur dorsale, le système AG est bluffant. Le meilleur investissement de mon équipement.',
    date: '2024-08-12',
    verified: true
  },
  {
    author: 'Thomas R.',
    rating: 5,
    comment:
    "Confort incroyable même en longue journée. L'accès bas est très pratique pour récupérer la tente sans tout vider.",
    date: '2024-07-03',
    verified: true
  },
  {
    author: 'Sophie M.',
    rating: 4,
    comment:
    'Excellent sac, léger pour sa capacité. Juste un peu cher mais la qualité justifie le prix. Garantie à vie rassurante.',
    date: '2024-06-18',
    verified: false
  }]

};

const relatedProducts = [
{
  id: '2',
  nom: 'Tente MSR Hubba Hubba NX',
  prix_cents: 54900,
  poids_g: 1540,
  image: 'https://images.unsplash.com/photo-1722607731217-31b4aee4b2d4',
  alt: 'Tente légère MSR Hubba Hubba NX orange montée en bivouac montagne'
},
{
  id: '3',
  nom: 'Sac de couchage Cumulus Panyam 450',
  prix_cents: 28900,
  poids_g: 890,
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_175618416-1783673001212.png',
  alt: 'Sac de couchage duvet Cumulus Panyam 450 bleu compact'
},
{
  id: '4',
  nom: 'Bâtons Black Diamond Trail Ergo',
  prix_cents: 8900,
  poids_g: 510,
  image: 'https://img.rocket.new/generatedImages/rocket_gen_img_102d3d253-1767017230132.png',
  alt: 'Paire de bâtons de randonnée Black Diamond Trail Ergo en aluminium'
}];


export default function ProductDetailClient() {
  const product = mockProduct;
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [comparatorOpen, setComparatorOpen] = useState(false);
  const [comparatorLoading, setComparatorLoading] = useState(false);
  const [comparatorResult, setComparatorResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'specs' | 'reviews'>('specs');

  const formatPrice = (cents: number) =>
  (cents / 100).toFixed(2).replace('.', ',') + ' €';

  const handleAddToCart = () => {
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2500);
  };

  const handleComparator = () => {
    setComparatorOpen(true);
    setComparatorLoading(true);
    setComparatorResult(null);
    setTimeout(() => {
      setComparatorLoading(false);
      setComparatorResult(
        `**Osprey Atmos AG 65 vs Deuter Aircontact Lite 65+10**\n\n` +
        `• **Poids** : Osprey 2 180 g vs Deuter 2 350 g → Osprey -170 g ✓\n` +
        `• **Confort dos** : Osprey AG (filet tendu) vs Deuter Aircontact (mousse) → Osprey meilleur en chaleur\n` +
        `• **Prix** : Osprey 349 € vs Deuter 289 € → Deuter -60 € ✓\n` +
        `• **Garantie** : Osprey à vie vs Deuter 3 ans → Osprey ✓\n\n` +
        `**Verdict IA** : Pour un trek estival de 7+ jours, l'Osprey Atmos AG 65 est recommandé pour son système de ventilation supérieur et sa garantie à vie. Le Deuter convient mieux aux budgets serrés ou aux treks hivernaux.`
      );
    }, 2200);
  };

  const weightPercent = Math.round(product.poids_g / product.poids_max_g * 100);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main id="main-content" className="pt-20">
        {/* Breadcrumb */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">Accueil</Link>
            <Icon name="ChevronRightIcon" size={14} variant="outline" aria-hidden="true" />
            <Link href="/catalogue" className="hover:text-foreground transition-colors">Catalogue</Link>
            <Icon name="ChevronRightIcon" size={14} variant="outline" aria-hidden="true" />
            <span className="text-foreground font-medium truncate max-w-[200px]" aria-current="page">{product.nom}</span>
          </nav>
        </div>

        {/* Product Main */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

            {/* Images */}
            <div className="space-y-4">
              <div className="aspect-square rounded-2xl overflow-hidden bg-card border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.images[activeImage].url}
                  alt={product.images[activeImage].alt}
                  className="w-full h-full object-cover" />
                
              </div>
              <div className="flex gap-3">
                {product.images.map((img, i) =>
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  activeImage === i ? 'border-primary' : 'border-border hover:border-accent'}`
                  }
                  aria-label={`Voir image ${i + 1} : ${img.alt}`}
                  aria-pressed={activeImage === i}>
                  
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="w-full h-full object-cover" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-info uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>
                    {product.marque}
                  </span>
                  <span className="text-muted-foreground" aria-hidden="true">·</span>
                  <span className="text-xs font-mono text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                    {product.reference}
                  </span>
                </div>
                <h1 className="font-display font-700 text-3xl text-foreground mb-3" style={{ fontFamily: 'var(--font-display)' }}>{product.nom}</h1>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1" aria-label={`Note : ${product.note} sur 5`}>
                    {[1, 2, 3, 4, 5].map((s) =>
                    <svg key={s} className={`w-4 h-4 ${s <= Math.round(product.note) ? 'text-yellow-400' : 'text-border'}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-mono text-info" style={{ fontFamily: 'var(--font-mono)' }}>
                    {product.note} ({product.avis_count} avis)
                  </span>
                </div>
              </div>

              {/* Weight Gauge */}
              <div className="topo-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Gabarit de poids</span>
                  <span className="font-mono text-lg font-semibold text-info" style={{ fontFamily: 'var(--font-mono)' }}>
                    {product.poids_g} g
                  </span>
                </div>
                <WeightGauge weightG={product.poids_g} maxG={product.poids_max_g} />
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs font-mono text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>0 g</span>
                  <span className="text-xs font-mono text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{product.poids_max_g} g</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {weightPercent}% du poids de référence catégorie · Catégorie : {product.categorie}
                </p>
              </div>

              {/* Price & Stock */}
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-display font-700 text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                    {formatPrice(product.prix_cents)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">TVA incluse · Livraison gratuite dès 50 €</p>
                </div>
                <div className={`flex items-center gap-1.5 text-sm font-medium ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${product.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`} aria-hidden="true" />
                  {product.stock > 0 ? `${product.stock} en stock` : 'Rupture de stock'}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2" aria-label="Catégories">
                {product.tags.map((tag) =>
                <span key={tag} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
                    {tag}
                  </span>
                )}
              </div>

              {/* Add to Cart */}
              <div className="flex gap-3">
                <div className="flex items-center border border-border rounded-full overflow-hidden" role="group" aria-label="Quantité">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-11 h-11 flex items-center justify-center hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label="Diminuer la quantité">
                    
                    <Icon name="MinusIcon" size={16} variant="outline" />
                  </button>
                  <span className="w-10 text-center font-mono text-sm font-semibold" style={{ fontFamily: 'var(--font-mono)' }} aria-live="polite">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="w-11 h-11 flex items-center justify-center hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label="Augmenter la quantité">
                    
                    <Icon name="PlusIcon" size={16} variant="outline" />
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={product.stock === 0}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  addedToCart ?
                  'bg-green-600 hover:bg-green-600 text-white' : 'bg-primary hover:bg-primary/90 text-white'} disabled:opacity-50 disabled:cursor-not-allowed`
                  }
                  aria-live="polite">
                  
                  <Icon name={addedToCart ? 'CheckIcon' : 'ShoppingBagIcon'} size={18} variant="outline" />
                  {addedToCart ? 'Ajouté au panier !' : 'Ajouter au panier'}
                </button>
              </div>

              {/* AI Comparator CTA */}
              <button
                onClick={handleComparator}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full border-2 border-info/30 text-info hover:bg-info/5 hover:border-info/60 transition-all font-medium text-sm min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
                aria-label="Comparer avec l'IA">
                
                <Icon name="SparklesIcon" size={16} variant="outline" />
                Comparer avec l&apos;IA (Atmos AG 65 vs alternatives)
              </button>
            </div>
          </div>
        </section>

        {/* AI Comparator Panel */}
        {comparatorOpen &&
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10" aria-label="Comparateur IA">
            <div className="topo-card p-6 border-info/30 border-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Icon name="SparklesIcon" size={20} variant="outline" className="text-info" aria-hidden="true" />
                  <h2 className="font-display font-700 text-lg text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                    Comparateur IA
                  </h2>
                </div>
                <button
                onClick={() => setComparatorOpen(false)}
                className="p-2 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Fermer le comparateur">
                
                  <Icon name="XMarkIcon" size={18} variant="outline" />
                </button>
              </div>

              {comparatorLoading ?
            <div className="flex items-center gap-3 py-6" aria-live="polite" aria-busy="true">
                  <div className="flex gap-1" aria-hidden="true">
                    {[0, 1, 2].map((i) =>
                <span key={i} className="w-2 h-2 rounded-full bg-info animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                )}
                  </div>
                  <span className="text-sm text-muted-foreground font-mono" style={{ fontFamily: 'var(--font-mono)' }}>
                    Analyse en cours…
                  </span>
                </div> :
            comparatorResult ?
            <div className="space-y-1" aria-live="polite">
                  {comparatorResult.split('\n').map((line, i) =>
              <p key={i} className={`text-sm ${line.startsWith('**Verdict') ? 'font-semibold text-foreground mt-3' : 'text-muted-foreground'} mb-1`}>
                      {line.replace(/\*\*/g, '')}
                    </p>
              )}
                </div> :
            null}
            </div>
          </section>
        }

        <TopoSeparator />

        {/* Tabs: Specs & Reviews */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex gap-1 mb-8 border-b border-border" role="tablist" aria-label="Informations produit">
            {(['specs', 'reviews'] as const).map((tab) =>
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-semibold transition-all border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === tab ?
              'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`
              }>
              
                {tab === 'specs' ? 'Caractéristiques' : `Avis (${product.avis_count})`}
              </button>
            )}
          </div>

          {activeTab === 'specs' &&
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="tabpanel" aria-label="Caractéristiques">
              {product.specs.map((spec) =>
            <div key={spec.label} className="flex items-center justify-between py-3 px-4 rounded-xl bg-card border border-border">
                  <span className="text-sm text-muted-foreground">{spec.label}</span>
                  <span className="font-mono text-sm font-semibold text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>
                    {spec.value}
                  </span>
                </div>
            )}
            </div>
          }

          {activeTab === 'reviews' &&
          <div className="space-y-4" role="tabpanel" aria-label="Avis clients">
              {product.reviews.map((review, i) =>
            <div key={i} className="topo-card p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-semibold text-foreground text-sm">{review.author}</span>
                      {review.verified &&
                  <span className="ml-2 text-xs text-green-600 font-medium">✓ Achat vérifié</span>
                  }
                    </div>
                    <div className="flex items-center gap-1" aria-label={`Note : ${review.rating} sur 5`}>
                      {[1, 2, 3, 4, 5].map((s) =>
                  <svg key={s} className={`w-3.5 h-3.5 ${s <= review.rating ? 'text-yellow-400' : 'text-border'}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                  )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                  <p className="text-xs font-mono text-muted-foreground mt-2" style={{ fontFamily: 'var(--font-mono)' }}>
                    {review.date}
                  </p>
                </div>
            )}
            </div>
          }
        </section>

        <TopoSeparator inverted />

        {/* Related Products */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-16">
          <h2 className="font-display font-700 text-2xl text-foreground mb-8" style={{ fontFamily: 'var(--font-display)' }}>Complétez votre kit</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {relatedProducts.map((p) =>
            <Link key={p.id} href={`/produit/${p.id}`} className="topo-card group overflow-hidden block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl">
                <div className="aspect-[4/3] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                  src={p.image}
                  alt={p.alt}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-foreground text-sm mb-2 group-hover:text-primary transition-colors">{p.nom}</h3>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-info" style={{ fontFamily: 'var(--font-mono)' }}>
                      {p.poids_g} g
                    </span>
                    <span className="font-display font-700 text-foreground" style={{ fontFamily: 'var(--font-display)' }}>
                      {formatPrice(p.prix_cents)}
                    </span>
                  </div>
                </div>
              </Link>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>);

}