'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { addToCart } from '@/lib/cart';
import { useAuth } from '@/contexts/AuthContext';
import NewFooterSection from '@/app/components/home/NewFooterSection';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  slug: string;
  nom: string;
  marque: string;
  categorie: string;
  description: string;
  prix_cents: number;
  poids_g: number;
  note: number;
  avis_count: number;
  images: { url: string; alt: string }[];
  tags: string[];
  specs: { label: string; value: string }[];
  score_kdv?: number;
  essentiality?: string;
  advantages?: string[];
  disadvantages?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE FETCH
// ─────────────────────────────────────────────────────────────────────────────
async function fetchProduct(slug: string): Promise<Product | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('shop_products')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error || !data) return null;

    const advantages: string[] = Array.isArray(data.advantages_array) ? data.advantages_array : [];
    const disadvantages: string[] = Array.isArray(data.disadvantages_array) ? data.disadvantages_array : [];
    const travelTypes: string[] = Array.isArray(data.travel_types_array) ? data.travel_types_array : [];

    return {
      id: data.id,
      slug: data.slug,
      nom: data.name,
      marque: data.brand ?? 'Marque',
      categorie: data.category_main ?? data.category ?? 'Équipement',
      description: data.description_why ?? data.justification_ai ?? '',
      prix_cents: Math.round(Number(data.price_eur ?? 89) * 100),
      poids_g: data.weight_g ?? 850,
      note: Number(data.rating ?? 4.9),
      avis_count: data.review_count ?? 128,
      score_kdv: data.score_kdv,
      essentiality: data.essentiality,
      advantages,
      disadvantages,
      images: data.image
        ? [
            { url: data.image, alt: data.image_alt ?? data.name },
            { url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80', alt: 'Produit en situation terrain' },
            { url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80', alt: 'Détail du produit' },
            { url: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80', alt: 'Produit en voyage' },
          ]
        : [
            { url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80', alt: 'Produit outdoor en montagne' },
            { url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80', alt: 'Détail du produit' },
            { url: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80', alt: 'Produit en voyage' },
            { url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80', alt: 'Contenu du sac' },
          ],
      tags: travelTypes.length > 0 ? travelTypes : ['Trek', 'Backpacking'],
      specs: [
        { label: 'Volume utile', value: `${data.volume_l ?? 45} litres` },
        { label: 'Poids à sec', value: `${data.weight_g ?? 1200} g` },
        { label: 'Toile principale', value: data.materials ?? 'Coton huilé 12 oz' },
        { label: 'Doublure', value: 'Lin biologique 400 g/m²' },
        { label: 'Boucles', value: 'Laiton brossé, France' },
        { label: 'Couture', value: 'Point sellier, fil ciré' },
        { label: 'Dos', value: 'Ergonomique 3 zones' },
        { label: 'Ceinture ventrale', value: 'Réglable, amovible' },
        { label: 'Compartiments', value: '3 · dont 1 rabat + 1 poche sécurisée' },
        { label: 'Accroches', value: 'Tapis, piolet, gourde' },
        { label: 'Imperméabilité', value: 'IP54 · pluie fine' },
        { label: 'Garantie', value: 'À vie · réparable' },
      ],
    };
  } catch {
    return null;
  }
}

function buildFallbackProduct(slug: string): Product {
  return {
    id: slug,
    slug,
    nom: 'Sac 45 L toile cirée',
    marque: 'Le Kit du Voyageur',
    categorie: 'PORTAGE · LE SAC ESSENTIEL',
    description: 'Trois compartiments, une bandoulière ventrale, un point d\'accroche pour tapis de sol. Coton huilé 12 oz, fabriqué dans les Alpes-de-Haute-Provence, réparable à vie.',
    prix_cents: 34000,
    poids_g: 1200,
    note: 4.9,
    avis_count: 128,
    score_kdv: 97,
    essentiality: 'Indispensable',
    advantages: ['Fabriqué en France', 'Réparable à vie', 'Matériaux naturels durables'],
    disadvantages: ['Prix élevé', 'Poids légèrement supérieur aux synthétiques'],
    images: [
      { url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80', alt: 'Sac 45L toile cirée vert forêt' },
      { url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80', alt: 'Sac en situation montagne' },
      { url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80', alt: 'Détail coutures et boucles' },
      { url: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80', alt: 'Sac ouvert avec contenu' },
    ],
    tags: ['Trek', 'Backpacking', 'Montagne'],
    specs: [
      { label: 'Volume utile', value: '45 litres' },
      { label: 'Poids à sec', value: '1 200 g' },
      { label: 'Toile principale', value: 'Coton huilé 12 oz' },
      { label: 'Doublure', value: 'Lin biologique 400 g/m²' },
      { label: 'Boucles', value: 'Laiton brossé, France' },
      { label: 'Couture', value: 'Point sellier, fil ciré' },
      { label: 'Dos', value: 'Ergonomique 3 zones' },
      { label: 'Ceinture ventrale', value: 'Réglable, amovible' },
      { label: 'Compartiments', value: '3 · dont 1 rabat + 1 poche sécurisée' },
      { label: 'Accroches', value: 'Tapis, piolet, gourde' },
      { label: 'Imperméabilité', value: 'IP54 · pluie fine' },
      { label: 'Garantie', value: 'À vie · réparable' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GALLERY COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function ProductGallery({ product }: { product: Product }) {
  const [active, setActive] = useState(0);

  return (
    <div className="flex gap-3">
      {/* Thumbnails column */}
      <div className="flex flex-col gap-2 flex-shrink-0">
        {product.images.map((img, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`w-[72px] h-[72px] rounded-xl overflow-hidden border-2 transition-all duration-200 flex-shrink-0 ${
              i === active
                ? 'border-[#1C2620]'
                : 'border-[#E8E4DA] hover:border-[#C8C3B0]'
            }`}
            aria-label={`Voir image ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          </button>
        ))}
      </div>

      {/* Main image */}
      <div className="flex-1 relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#F0EDE5]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.images[active]?.url}
          alt={product.images[active]?.alt}
          className="w-full h-full object-cover transition-opacity duration-300"
        />
        {/* Badge */}
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm text-[#1C2620] text-[11px] font-semibold tracking-wide border border-[#E8E4DA]">
            + Édition automne
          </span>
        </div>
        {/* Expand */}
        <button
          className="absolute bottom-4 right-4 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-[#1C2620] hover:bg-white transition-colors border border-[#E8E4DA]"
          aria-label="Agrandir l'image"
        >
          <Icon name="ArrowsPointingOutIcon" size={16} variant="outline" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD TO CART BUTTON
// ─────────────────────────────────────────────────────────────────────────────
function AddToCartButton({ product, selectedVolume }: { product: Product; selectedVolume: string }) {
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    addToCart({
      id: product.id,
      slug: product.slug,
      name: `${product.nom} ${selectedVolume}`,
      brand: product.marque,
      category: product.categorie,
      priceEur: product.prix_cents / 100,
      weightG: product.poids_g,
      image: product.images[0]?.url ?? '',
      imageAlt: product.images[0]?.alt ?? product.nom,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <button
      onClick={handleAdd}
      className="flex-1 flex items-center justify-center gap-2 py-4 rounded-full font-semibold text-sm text-white transition-all active:scale-95"
      style={{ background: added ? '#2d6a4f' : '#1C2620' }}
    >
      <Icon name={added ? 'CheckIcon' : 'ShoppingBagIcon'} size={18} variant="outline" />
      {added ? 'Ajouté !' : 'Ajouter au panier'}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRUST BADGES
// ─────────────────────────────────────────────────────────────────────────────
function TrustBadges() {
  const badges = [
    { icon: 'WrenchScrewdriverIcon', title: 'Garantie à vie', sub: 'Réparable à Grenoble' },
    { icon: 'TruckIcon', title: 'Livraison offerte', sub: 'Dès 200 €' },
    { icon: 'ArrowUturnLeftIcon', title: 'Retour 30 jours', sub: 'Frais offerts' },
    { icon: 'MapPinIcon', title: '100 % Europe', sub: 'Alpes-de-Haute-Provence' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {badges.map((b) => (
        <div key={b.title} className="flex items-center gap-3 p-3 rounded-xl bg-[#F5F2EC] border border-[#E8E4DA]">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 border border-[#E8E4DA]">
            <Icon name={b.icon as Parameters<typeof Icon>[0]['name']} size={15} variant="outline" className="text-[#1C2620]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#1C2620] leading-tight">{b.title}</p>
            <p className="text-[10px] text-[#7A7A6E] leading-tight">{b.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SPECS TABLE
// ─────────────────────────────────────────────────────────────────────────────
function SpecsTable({ specs }: { specs: { label: string; value: string }[] }) {
  const half = Math.ceil(specs.length / 2);
  const left = specs.slice(0, half);
  const right = specs.slice(half);

  return (
    <section className="py-16 border-t border-[#E8E4DA]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <h2 className="font-display font-800 text-3xl text-[#1C2620] mb-10" style={{ fontFamily: 'var(--font-display)' }}>
          Spécifications <em className="italic font-normal text-[#7A7A6E]">techniques.</em>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16">
          {[left, right].map((col, ci) => (
            <div key={ci} className="divide-y divide-[#E8E4DA]">
              {col.map((spec) => (
                <div key={spec.label} className="flex items-center justify-between py-4">
                  <span className="text-sm text-[#7A7A6E]">{spec.label}</span>
                  <span className="text-sm font-medium text-[#1C2620] text-right max-w-[55%]">{spec.value}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATED PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────
function RelatedProducts() {
  const products = [
    { categorie: 'COUCHAGE', nom: 'Duvet 3 saisons', prix: '248 €', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=300&q=80', alt: 'Duvet de couchage vert compact 3 saisons', slug: 'duvet-3-saisons' },
    { categorie: 'HYDRATATION', nom: 'Gourde titane 1 L', prix: '68 €', image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=300&q=80', alt: 'Gourde en titane 1 litre couleur sauge', slug: 'gourde-titane-1l' },
    { categorie: 'VÊTEMENT', nom: 'Veste 3 couches', prix: '312 €', image: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=300&q=80', alt: 'Veste technique 3 couches imperméable verte', slug: 'veste-3-couches' },
  ];

  return (
    <section className="py-16 border-t border-[#E8E4DA]">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        <h2 className="font-display font-800 text-3xl text-[#1C2620] mb-10" style={{ fontFamily: 'var(--font-display)' }}>
          Ils vont <em className="italic font-normal text-[#7A7A6E]">avec.</em>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {products.map((p) => (
            <Link key={p.slug} href={`/produit/${p.slug}`} className="group flex items-center gap-4 p-4 rounded-2xl bg-[#F5F2EC] border border-[#E8E4DA] hover:border-[#1C2620] transition-all duration-200">
              <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-[#7A7A6E] uppercase tracking-widest mb-1">{p.categorie}</p>
                <p className="font-semibold text-[#1C2620] text-sm leading-tight">{p.nom}</p>
                <p className="text-sm font-mono font-700 text-[#1C2620] mt-1">{p.prix}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI CHAT ASSISTANT
// ─────────────────────────────────────────────────────────────────────────────
function AIProductChat({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const SUGGESTIONS = [
    'Ce produit convient-il à un trek en Islande ?',
    'Est-il adapté à un voyage de 3 semaines ?',
    'Comment l\'entretenir correctement ?',
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user' as const, content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const history = [...messages, userMsg];
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'GEMINI',
          model: 'gemini/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: `Tu es un expert équipement outdoor pour "Le Kit du Voyageur". Tu réponds en français, de façon concise et utile (max 3 phrases). Produit: ${product.nom} par ${product.marque}, ${product.poids_g}g, ${(product.prix_cents / 100).toFixed(0)}€.`,
            },
            ...history.map(m => ({ role: m.role, content: m.content })),
          ],
          parameters: { temperature: 0.7, max_tokens: 200 },
        }),
      });
      const data = await res.json();
      const reply = data.content ?? data.choices?.[0]?.message?.content ?? 'Désolé, je n\'ai pas pu répondre.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erreur de connexion. Réessayez.' }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, product]);

  return (
    <div className="rounded-2xl border border-[#E8E4DA] overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 hover:bg-[#F5F2EC] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1C2620] flex items-center justify-center">
            <Icon name="SparklesIcon" size={14} variant="outline" className="text-white" />
          </div>
          <div className="text-left">
            <div className="font-semibold text-[#1C2620] text-sm">Demandez à l&apos;IA</div>
            <div className="text-xs text-[#7A7A6E]">Posez vos questions sur ce produit</div>
          </div>
        </div>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} variant="outline" className="text-[#7A7A6E]" />
      </button>

      {open && (
        <div className="border-t border-[#E8E4DA]">
          <div className="h-48 overflow-y-auto p-4 space-y-3 bg-[#F5F2EC]">
            {messages.length === 0 && (
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-xs text-left px-3 py-2 rounded-lg bg-white border border-[#E8E4DA] hover:border-[#1C2620] transition-all text-[#1C2620]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                  m.role === 'user' ? 'bg-[#1C2620] text-white' : 'bg-white border border-[#E8E4DA] text-[#1C2620]'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-[#E8E4DA] px-3 py-2 rounded-xl">
                  <div className="flex gap-1">{[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#1C2620] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-3 border-t border-[#E8E4DA] flex gap-2 bg-white">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              placeholder="Posez votre question…"
              className="flex-1 bg-[#F5F2EC] border border-[#E8E4DA] rounded-lg px-3 py-2 text-xs text-[#1C2620] focus:outline-none focus:border-[#1C2620] transition-colors"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-lg bg-[#1C2620] text-white flex items-center justify-center hover:opacity-80 transition-opacity disabled:opacity-30"
            >
              <Icon name="PaperAirplaneIcon" size={14} variant="outline" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedVolume, setSelectedVolume] = useState('45 L');
  const [selectedSangle, setSelectedSangle] = useState('Ventrale + poitrine');
  const { user } = useAuth();

  const COLORS = [
    { name: 'Vert forêt', hex: '#4A6741' },
    { name: 'Brun tabac', hex: '#8B6914' },
    { name: 'Noir ardoise', hex: '#2C2C2C' },
    { name: 'Gris pierre', hex: '#9E9E8E' },
  ];
  const VOLUMES = ['30 L', '45 L', '60 L', '75 L'];
  const SANGLES = ['Basique', 'Ventrale + poitrine', 'Ventrale + poitrine + porte-piolet'];

  useEffect(() => {
    fetchProduct(slug).then(p => {
      setProduct(p ?? buildFallbackProduct(slug));
      setLoading(false);
    });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F2EC]">
        <Header />
        <div className="pt-24 flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-[#1C2620] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!product) return null;

  const priceEur = product.prix_cents / 100;

  return (
    <div className="min-h-screen" style={{ background: '#F5F2EC', color: '#1C2620' }}>
      <Header />

      {/* Breadcrumb */}
      <div className="pt-20 pb-0">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-4">
          <nav className="flex items-center gap-2 text-xs text-[#7A7A6E]" aria-label="Fil d'Ariane">
            <Link href="/" className="hover:text-[#1C2620] transition-colors">Accueil</Link>
            <span>/</span>
            <Link href="/boutique" className="hover:text-[#1C2620] transition-colors">Boutique</Link>
            <span>/</span>
            <Link href="/boutique" className="hover:text-[#1C2620] transition-colors">{product.categorie.split('·')[0].trim()}</Link>
            <span>/</span>
            <span className="text-[#1C2620] font-medium">{product.nom}</span>
          </nav>
        </div>
      </div>

      {/* ── HERO PRODUCT SECTION ── */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">

          {/* LEFT: Gallery */}
          <div>
            <ProductGallery product={product} />
          </div>

          {/* RIGHT: Product info */}
          <div className="flex flex-col gap-6">
            {/* Category badge */}
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#1C2620]/20 text-[11px] font-mono font-600 text-[#1C2620] uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4A6741]" />
                {product.categorie}
              </span>
            </div>

            {/* Title */}
            <div>
              <h1 className="font-display font-800 text-4xl lg:text-5xl text-[#1C2620] leading-tight tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {product.nom.includes('toile') || product.nom.includes('titane') || product.nom.includes('saisons') ? (
                  <>
                    {product.nom.split(' ').slice(0, -2).join(' ')}{' '}
                    <em className="italic font-normal">{product.nom.split(' ').slice(-2).join(' ')}.</em>
                  </>
                ) : (
                  <>{product.nom}.</>
                )}
              </h1>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(i => (
                  <svg key={i} className={`w-3.5 h-3.5 ${i <= Math.round(product.note) ? 'text-[#E4501C]' : 'text-[#C8C3B0]'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-sm font-semibold text-[#1C2620]">{product.note}</span>
              <span className="text-sm text-[#7A7A6E]">· {product.avis_count} avis · {Math.round(product.avis_count * 0.37)} testeurs terrain</span>
            </div>

            {/* Description */}
            <p className="text-sm text-[#5C6B5E] leading-relaxed">{product.description || 'Trois compartiments, une bandoulière ventrale, un point d\'accroche pour tapis de sol. Coton huilé 12 oz, fabriqué dans les Alpes-de-Haute-Provence, réparable à vie.'}</p>

            {/* Color selector */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-[#7A7A6E] uppercase tracking-widest">Coloris</span>
                <span className="text-xs text-[#1C2620] font-medium">{COLORS[selectedColor].name}</span>
              </div>
              <div className="flex items-center gap-2">
                {COLORS.map((c, i) => (
                  <button
                    key={c.name}
                    onClick={() => setSelectedColor(i)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${i === selectedColor ? 'border-[#1C2620] scale-110' : 'border-transparent hover:border-[#C8C3B0]'}`}
                    style={{ background: c.hex }}
                    aria-label={c.name}
                  />
                ))}
              </div>
            </div>

            {/* Volume selector */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-[#7A7A6E] uppercase tracking-widest">Volume</span>
                <span className="text-xs text-[#7A7A6E]">{selectedVolume} · idéal 3–5 jours</span>
              </div>
              <div className="flex items-center gap-2">
                {VOLUMES.map((v) => (
                  <button
                    key={v}
                    onClick={() => setSelectedVolume(v)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                      v === selectedVolume
                        ? 'bg-[#1C2620] text-white border-[#1C2620]'
                        : 'bg-white text-[#1C2620] border-[#E8E4DA] hover:border-[#1C2620]'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Sangles selector */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-[#7A7A6E] uppercase tracking-widest">Sangles</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {SANGLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSangle(s)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                      s === selectedSangle
                        ? 'bg-[#1C2620] text-white border-[#1C2620]'
                        : 'bg-white text-[#1C2620] border-[#E8E4DA] hover:border-[#1C2620]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Price + stock */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-display font-800 text-4xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>
                  {priceEur.toFixed(0)} €
                </span>
                <span className="text-xs text-[#7A7A6E] ml-2">TVA incluse</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#4A6741] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#4A6741]" />
                En stock · expédié sous 48 h
              </div>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-3">
              <AddToCartButton product={product} selectedVolume={selectedVolume} />
              <button
                className="w-12 h-12 rounded-full border border-[#E8E4DA] bg-white flex items-center justify-center hover:border-[#1C2620] transition-colors flex-shrink-0"
                aria-label="Ajouter aux favoris"
              >
                <Icon name="HeartIcon" size={18} variant="outline" className="text-[#1C2620]" />
              </button>
            </div>

            {/* Trust badges */}
            <TrustBadges />

            {/* AI Chat */}
            <AIProductChat product={product} />
          </div>
        </div>
      </section>

      {/* ── STORYTELLING FABRICATION ── */}
      <section className="py-20 border-t border-[#E8E4DA]" style={{ background: '#F5F2EC' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Image */}
            <div className="rounded-2xl overflow-hidden aspect-[4/3]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80"
                alt="Atelier de fabrication artisanale avec outils et matériaux"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Text */}
            <div>
              <p className="text-xs font-mono text-[#7A7A6E] uppercase tracking-widest mb-4">FABRICATION</p>
              <h2 className="font-display font-800 text-4xl lg:text-5xl text-[#1C2620] leading-tight mb-6" style={{ fontFamily: 'var(--font-display)' }}>
                Cousu à <em className="italic font-normal">Manosque,</em>
                <br />par cinq mains.
              </h2>
              <p className="text-sm text-[#5C6B5E] leading-relaxed mb-10">
                Cinq artisans travaillant la toile cirée chaque semaine dans un atelier des Alpes-de-Haute-Provence. Un sac demande six heures de couture, une heure d&apos;huilage, une nuit de séchage.
              </p>

              {/* Stats */}
              <div className="flex items-center gap-10">
                <div>
                  <p className="font-display font-800 text-4xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>
                    6 <em className="italic font-normal text-2xl">h</em>
                  </p>
                  <p className="text-[10px] font-mono text-[#7A7A6E] uppercase tracking-widest mt-1">COUTURE</p>
                </div>
                <div>
                  <p className="font-display font-800 text-4xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>
                    1 200 <em className="italic font-normal text-2xl">g</em>
                  </p>
                  <p className="text-[10px] font-mono text-[#7A7A6E] uppercase tracking-widest mt-1">POIDS À SEC</p>
                </div>
                <div>
                  <p className="font-display font-800 text-4xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>
                    45 <em className="italic font-normal text-2xl">L</em>
                  </p>
                  <p className="text-[10px] font-mono text-[#7A7A6E] uppercase tracking-widest mt-1">VOLUME UTILE</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SPECS TABLE ── */}
      <SpecsTable specs={product.specs} />

      {/* ── RELATED PRODUCTS ── */}
      <RelatedProducts />

      {/* ── FOOTER ── */}
      <NewFooterSection />

      {/* ── MOBILE STICKY CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-[#E8E4DA] px-4 py-3 flex items-center gap-3 shadow-lg">
        <div className="flex-1">
          <p className="text-xs text-[#7A7A6E] font-mono uppercase tracking-widest">{product.categorie.split('·')[0].trim()}</p>
          <p className="font-semibold text-[#1C2620] text-sm leading-tight">{product.nom}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(i => (
                <svg key={i} className={`w-3 h-3 ${i <= Math.round(product.note) ? 'text-[#E4501C]' : 'text-[#C8C3B0]'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-xs text-[#7A7A6E]">{product.avis_count} avis</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-display font-800 text-xl text-[#1C2620]">{priceEur.toFixed(0)} €</p>
            <p className="text-[10px] text-[#7A7A6E]">TTC</p>
          </div>
          <AddToCartButton product={product} selectedVolume={selectedVolume} />
        </div>
      </div>
      {/* Spacer for mobile sticky bar */}
      <div className="h-20 lg:hidden" />
    </div>
  );
}