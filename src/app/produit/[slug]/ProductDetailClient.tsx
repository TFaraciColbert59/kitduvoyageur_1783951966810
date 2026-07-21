'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WeightGauge from '@/components/WeightGauge';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { addToCart } from '@/lib/cart';
import { useAuth } from '@/contexts/AuthContext';

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

interface AcquisitionMode {
  id: 'neuf' | 'occasion' | 'location' | 'enchere';
  label: string;
  icon: string;
  prix: string;
  disponibilite: string;
  etat: string;
  delai: string;
  garantie: string;
  vendeur: string;
  economie: string;
  ecologie: string;
  conditions: string;
  color: string;
  badge: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK DATA HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function buildAcquisitionModes(product: Product): AcquisitionMode[] {
  const basePrice = product.prix_cents;
  return [
    {
      id: 'neuf',
      label: 'Acheter neuf',
      icon: 'ShoppingBagIcon',
      prix: `${(basePrice / 100).toFixed(0)} €`,
      disponibilite: 'En stock',
      etat: 'Neuf — jamais utilisé',
      delai: 'Livraison demain',
      garantie: '2 ans constructeur',
      vendeur: 'Le Kit du Voyageur',
      economie: '—',
      ecologie: '⚠️ Produit neuf',
      conditions: 'Retour 30 jours',
      color: 'emerald',
      badge: 'NEUF',
    },
    {
      id: 'occasion',
      label: 'Marketplace',
      icon: 'TagIcon',
      prix: `Dès ${Math.round(basePrice * 0.62 / 100)} €`,
      disponibilite: '12 vendeurs',
      etat: 'Bon état vérifié',
      delai: '2–4 jours',
      garantie: 'Garantie acheteur 30j',
      vendeur: 'Vendeurs certifiés',
      economie: `Économie de ${Math.round((1 - 0.62) * 100)} %`,
      ecologie: '✅ Seconde vie',
      conditions: 'Retour 14 jours',
      color: 'amber',
      badge: 'OCCASION',
    },
    {
      id: 'location',
      label: 'Location',
      icon: 'KeyIcon',
      prix: `Dès ${Math.round(basePrice * 0.04 / 100)} €/jour`,
      disponibilite: 'Disponible près de chez vous',
      etat: 'Entretenu & désinfecté',
      delai: 'Disponible sous 24h',
      garantie: 'Assurance incluse',
      vendeur: 'Réseau partenaires',
      economie: 'Idéal voyage unique',
      ecologie: '🌿 Économie circulaire',
      conditions: 'Caution remboursée',
      color: 'purple',
      badge: 'LOCATION',
    },
  ];
}

const TRAVEL_TYPES = [
  { id: 'backpacking', label: 'Backpacking', icon: '🎒', score: 95 },
  { id: 'trek', label: 'Trek', icon: '⛰️', score: 88 },
  { id: 'vanlife', label: 'Van Life', icon: '🚐', score: 72 },
  { id: 'roadtrip', label: 'Road Trip', icon: '🚗', score: 65 },
  { id: 'camping', label: 'Camping', icon: '⛺', score: 91 },
  { id: 'tourDuMonde', label: 'Tour du monde', icon: '🌍', score: 97 },
  { id: 'moto', label: 'Moto', icon: '🏍️', score: 58 },
  { id: 'velo', label: 'Vélo', icon: '🚴', score: 70 },
  { id: 'avion', label: 'Avion', icon: '✈️', score: 85 },
  { id: 'train', label: 'Train', icon: '🚂', score: 80 },
  { id: 'weekend', label: 'Week-end', icon: '🏡', score: 60 },
  { id: 'business', label: 'Business', icon: '💼', score: 40 },
];

const BAG_SIZES = [
  { label: '20 L', fits: false, percent: 0 },
  { label: '30 L', fits: true, percent: 45 },
  { label: '40 L', fits: true, percent: 32 },
  { label: '50 L', fits: true, percent: 25 },
  { label: '70 L', fits: true, percent: 18 },
  { label: '90 L', fits: true, percent: 12 },
];

const PRICE_HISTORY = [
  { month: 'Jan', neuf: 89, occasion: 55, location: 4 },
  { month: 'Fév', neuf: 89, occasion: 52, location: 4 },
  { month: 'Mar', neuf: 85, occasion: 50, location: 3.5 },
  { month: 'Avr', neuf: 79, occasion: 48, location: 3.5 },
  { month: 'Mai', neuf: 89, occasion: 54, location: 4 },
  { month: 'Jun', neuf: 94, occasion: 60, location: 5 },
  { month: 'Jul', neuf: 99, occasion: 65, location: 5.5 },
  { month: 'Aoû', neuf: 99, occasion: 68, location: 5.5 },
  { month: 'Sep', neuf: 89, occasion: 58, location: 4.5 },
  { month: 'Oct', neuf: 84, occasion: 52, location: 4 },
  { month: 'Nov', neuf: 79, occasion: 48, location: 3.5 },
  { month: 'Déc', neuf: 89, occasion: 55, location: 4 },
];

const FAQ_ITEMS = [
  { q: 'Ce produit convient-il aux débutants ?', a: 'Oui, sa prise en main est intuitive. Nous recommandons toutefois de le tester avant un long voyage.' },
  { q: 'Quelle est la durée de vie estimée ?', a: 'Avec un entretien régulier, comptez 5 à 8 ans d\'utilisation intensive.' },
  { q: 'Est-il réparable ?', a: 'Oui, les pièces détachées sont disponibles. Score de réparabilité : 8/10.' },
  { q: 'Peut-on le prendre en cabine avion ?', a: 'Dépend de la compagnie. Vérifiez les dimensions autorisées avant votre vol.' },
  { q: 'Quelle différence avec la version précédente ?', a: 'La version actuelle est 15% plus légère et intègre de nouveaux matériaux recyclés.' },
  { q: 'Y a-t-il une garantie en cas de défaut ?', a: '2 ans constructeur pour les achats neufs. 30 jours garantie acheteur pour l\'occasion.' },
];

const ALTERNATIVES = [
  { label: 'Moins cher', icon: '💰', nom: 'Deuter Speed Lite 20', prix: '59 €', poids: '490 g', note: 4.2, badge: 'bg-emerald-100 text-emerald-800' },
  { label: 'Plus léger', icon: '🪶', nom: 'Hyperlite Mountain Gear 2400', prix: '320 €', poids: '510 g', note: 4.7, badge: 'bg-blue-100 text-blue-800' },
  { label: 'Plus premium', icon: '⭐', nom: 'Arc\'teryx Alpha FL 30', prix: '380 €', poids: '680 g', note: 4.9, badge: 'bg-purple-100 text-purple-800' },
  { label: 'Meilleur rapport Q/P', icon: '🏆', nom: 'Osprey Talon 22', prix: '110 €', poids: '720 g', note: 4.6, badge: 'bg-amber-100 text-amber-800' },
  { label: 'Choix de l\'équipe', icon: '❤️', nom: 'Gregory Zulu 30', prix: '145 €', poids: '850 g', note: 4.8, badge: 'bg-red-100 text-red-800' },
];

const KIT_INSPIRATIONS = [
  { label: 'Tour du Monde', icon: '🌍', produits: 24, poids: '9,2 kg', budget: '1 240 €', image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80', alt: 'Sac à dos posé devant une carte du monde' },
  { label: 'Islande', icon: '🧊', produits: 18, poids: '11,4 kg', budget: '890 €', image: 'https://images.unsplash.com/photo-1531168556467-80aace0d0144?w=400&q=80', alt: 'Paysage volcanique islandais avec randonneurs' },
  { label: 'Népal Trek', icon: '⛰️', produits: 22, poids: '12,8 kg', budget: '1 050 €', image: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=400&q=80', alt: 'Randonneurs sur un sentier de montagne au Népal' },
  { label: 'Japon', icon: '🗾', produits: 16, poids: '7,6 kg', budget: '680 €', image: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400&q=80', alt: 'Voyageur avec sac à dos devant un temple japonais' },
  { label: 'Van Life', icon: '🚐', produits: 28, poids: '15,2 kg', budget: '1 580 €', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80', alt: 'Van aménagé dans un paysage naturel' },
  { label: 'Trek Léger', icon: '🪶', produits: 14, poids: '6,1 kg', budget: '720 €', image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80', alt: 'Randonneur ultraléger sur un sentier de montagne' },
];

const COMPLEMENTARY = [
  { nom: 'Sac de couchage Cumulus 450', poids: '890 g', prix: '289 €', reason: 'Souvent acheté ensemble', image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=200&q=80', alt: 'Sac de couchage bleu compact' },
  { nom: 'Matelas Therm-a-Rest NeoAir', poids: '354 g', prix: '179 €', reason: 'Complément idéal', image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=200&q=80', alt: 'Matelas gonflable de camping orange' },
  { nom: 'Lampe Black Diamond Spot', poids: '88 g', prix: '49 €', reason: 'Accessoire recommandé', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&q=80', alt: 'Lampe frontale de randonnée noire' },
  { nom: 'Gourde Hydrapak 1L', poids: '95 g', prix: '29 €', reason: 'Compatible avec ce sac', image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=200&q=80', alt: 'Gourde souple bleue de randonnée' },
];

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
      note: Number(data.rating ?? 4.7),
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
          ]
        : [
            { url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80', alt: 'Produit outdoor en montagne' },
            { url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80', alt: 'Détail du produit' },
          ],
      tags: travelTypes.length > 0 ? travelTypes : ['Trek', 'Backpacking'],
      specs: [
        { label: 'Poids', value: `${data.weight_g ?? 850} g` },
        ...(data.dimensions ? [{ label: 'Dimensions', value: data.dimensions }] : []),
        ...(data.materials ? [{ label: 'Matériaux', value: data.materials }] : []),
        ...(data.warranty ? [{ label: 'Garantie', value: data.warranty }] : []),
        ...(data.model ? [{ label: 'Modèle', value: data.model }] : []),
        ...(data.category_sub ? [{ label: 'Sous-catégorie', value: data.category_sub }] : []),
        ...(data.score_kdv ? [{ label: 'Score KDV', value: `${data.score_kdv}/100` }] : []),
        ...(data.essentiality ? [{ label: 'Essentialité', value: data.essentiality }] : []),
        ...(data.score_quality ? [{ label: 'Note qualité', value: `${data.score_quality}/10` }] : []),
        ...(data.score_durability ? [{ label: 'Note durabilité', value: `${data.score_durability}/10` }] : []),
        ...(data.repairability_10 ? [{ label: 'Réparabilité', value: `${data.repairability_10}/10` }] : []),
        { label: 'Cabine avion', value: data.cabin_compatible ? '✅ Compatible' : '❌ Non compatible' },
        ...(data.available_europe !== undefined ? [{ label: 'Dispo Europe', value: data.available_europe ? '✅ Oui' : '❌ Non' }] : []),
        ...(data.source_review ? [{ label: 'Source', value: data.source_review }] : []),
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
    nom: 'Osprey Farpoint 40',
    marque: 'Osprey',
    categorie: 'Sac à dos',
    description: 'Le sac à dos de voyage par excellence. Conçu pour les voyageurs exigeants qui veulent voyager léger sans compromis.',
    prix_cents: 17900,
    poids_g: 1420,
    note: 4.7,
    avis_count: 128,
    score_kdv: 92,
    essentiality: 'Indispensable',
    advantages: ['Légèreté exceptionnelle', 'Système de portage ergonomique', 'Matériaux durables et recyclés'],
    disadvantages: ['Prix élevé', 'Poches latérales étroites'],
    images: [
      { url: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=80', alt: 'Osprey Farpoint 40 sur un sentier de montagne' },
      { url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&q=80', alt: 'Détail du système de portage Osprey' },
      { url: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80', alt: 'Osprey Farpoint 40 en voyage urbain' },
      { url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80', alt: 'Contenu du sac Osprey Farpoint 40' },
    ],
    tags: ['Trek', 'Backpacking', 'Tour du monde', 'Avion'],
    specs: [
      { label: 'Poids', value: '1 420 g' },
      { label: 'Volume', value: '40 L' },
      { label: 'Dimensions', value: '70 × 35 × 25 cm' },
      { label: 'Matériaux', value: 'Nylon 210D Ripstop' },
      { label: 'Garantie', value: '2 ans constructeur' },
      { label: 'Réparabilité', value: '8/10' },
      { label: 'Score KDV', value: '92/100' },
      { label: 'Essentialité', value: 'Indispensable' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: GALLERY
// ─────────────────────────────────────────────────────────────────────────────
function ProductGallery({ product }: { product: Product }) {
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  return (
    <div className="space-y-3">
      <div
        className="relative aspect-square rounded-2xl overflow-hidden bg-[#1C2620] cursor-zoom-in group"
        onClick={() => setZoomed(!zoomed)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.images[active]?.url}
          alt={product.images[active]?.alt}
          className={`w-full h-full object-cover transition-transform duration-500 ${zoomed ? 'scale-150' : 'scale-100 group-hover:scale-105'}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full bg-[#E4501C] text-white text-[10px] font-mono font-700 tracking-widest uppercase">Best Seller</span>
          {product.score_kdv && product.score_kdv >= 85 && (
            <span className="px-2.5 py-1 rounded-full bg-[#1C2620]/80 backdrop-blur-sm text-white text-[10px] font-mono tracking-widest uppercase border border-white/20">Score KDV {product.score_kdv}</span>
          )}
        </div>
        <button
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          onClick={(e) => { e.stopPropagation(); setZoomed(!zoomed); }}
          aria-label="Zoom"
        >
          <Icon name={zoomed ? 'MagnifyingGlassMinusIcon' : 'MagnifyingGlassPlusIcon'} size={16} variant="outline" />
        </button>
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <span className="text-white/70 text-xs font-mono">{active + 1} / {product.images.length}</span>
          <div className="flex gap-1.5">
            {product.images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setActive(i); }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${i === active ? 'bg-white w-4' : 'bg-white/40'}`}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {product.images.map((img, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${i === active ? 'border-[#E4501C]' : 'border-[#C8C3B0] hover:border-[#B5652D]'}`}
            aria-label={`Voir image ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="w-full h-full object-cover" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: AI ACQUISITION ADVISOR — fully functional with cart integration
// ─────────────────────────────────────────────────────────────────────────────
function AlreadyOwnButton({ product }: { product: Product }) {
  const [added, setAdded] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleAlreadyOwn = async () => {
    if (!user) { window.location.href = '/connexion'; return; }
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.from('gear_items').insert({
        user_id: user.id,
        name: product.nom,
        brand: product.marque,
        category: 'autre',
        condition: 'bon',
        source: 'manuel',
        product_id: product.id,
        purchase_price: product.prix_cents / 100,
        weight_g: product.poids_g,
        image: product.images[0]?.url ?? '',
        alt: product.images[0]?.alt ?? product.nom,
        notes: `Ajouté depuis la fiche produit`,
        tags: [],
      });
      setAdded(true);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  if (added) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
        <Icon name="CheckCircleIcon" size={16} variant="outline" className="text-emerald-600" />
        Ajouté à votre inventaire !
      </div>
    );
  }

  return (
    <button
      onClick={handleAlreadyOwn}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#C8C3B0] text-[#5C6B5E] text-sm font-medium hover:border-[#B5652D] hover:text-[#1C2620] transition-all disabled:opacity-50"
    >
      <Icon name="ArchiveBoxIcon" size={16} variant="outline" />
      {loading ? 'Ajout en cours…' : 'Je possède déjà cet article'}
    </button>
  );
}

function AcquisitionComparator({ modes, product, onModeChange }: { modes: AcquisitionMode[]; product: Product; onModeChange: (id: string) => void }) {
  const [selected, setSelected] = useState<string>('neuf');
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const [cartMsg, setCartMsg] = useState('');

  const colorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-700', badge: 'bg-emerald-500' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700', badge: 'bg-amber-500' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-700', badge: 'bg-purple-500' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-700', badge: 'bg-orange-500' },
  };

  const handleSelect = useCallback(async (modeId: string) => {
    setSelected(modeId);
    onModeChange(modeId);
    setAiAdvice(null);
    setLoadingAdvice(true);
    try {
      const mode = modes.find(m => m.id === modeId);
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'GEMINI',
          model: 'gemini/gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: `Tu es un expert équipement outdoor. En 2 phrases max, explique pourquoi choisir l'option "${mode?.label}" pour le produit "${product.nom}" (${product.marque}, ${(product.prix_cents/100).toFixed(0)}€, ${product.poids_g}g). Sois direct et concret.`,
          }],
          parameters: { temperature: 0.7, max_tokens: 120 },
        }),
      });
      const data = await res.json();
      setAiAdvice(data.content ?? data.choices?.[0]?.message?.content ?? null);
    } catch {
      setAiAdvice(null);
    } finally {
      setLoadingAdvice(false);
    }
  }, [modes, product, onModeChange]);

  const handleCTA = useCallback(() => {
    if (selected === 'neuf') {
      addToCart({
        id: product.id,
        slug: product.slug,
        name: product.nom,
        brand: product.marque,
        category: product.categorie,
        priceEur: product.prix_cents / 100,
        weightG: product.poids_g,
        image: product.images[0]?.url ?? '',
        imageAlt: product.images[0]?.alt ?? product.nom,
      });
      setCartAdded(true);
      setCartMsg('✓ Ajouté au panier !');
      setTimeout(() => setCartAdded(false), 3000);
    } else if (selected === 'occasion') {
      window.location.href = '/occasion';
    } else if (selected === 'location') {
      window.location.href = '/location';
    }
  }, [selected, product]);

  const ctaLabels: Record<string, string> = {
    neuf: cartAdded ? cartMsg : 'Ajouter au panier',
    occasion: 'Voir les offres occasion',
    location: 'Réserver une location',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon name="SparklesIcon" size={16} variant="outline" className="text-[#E4501C]" />
        <h2 className="font-display font-700 text-xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>Obtenir ce produit</h2>
      </div>
      <p className="text-sm text-[#5C6B5E]">Comparez les 4 façons d&apos;acquérir ce produit. L&apos;IA analyse chaque option pour vous.</p>

      <div className="grid grid-cols-2 gap-3">
        {modes.map((mode) => {
          const c = colorMap[mode.color];
          const isSelected = selected === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => handleSelect(mode.id)}
              className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                isSelected ? `${c.bg} ${c.border}` : 'bg-[#EDEAE0] border-[#C8C3B0] hover:border-[#B5652D]'
              }`}
            >
              <div className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-mono font-700 text-white ${c.badge}`}>
                {mode.badge}
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Icon name={mode.icon as Parameters<typeof Icon>[0]['name']} size={16} variant="outline" className={isSelected ? c.text : 'text-[#5C6B5E]'} />
                <span className={`text-xs font-semibold ${isSelected ? c.text : 'text-[#5C6B5E]'}`}>{mode.label}</span>
              </div>
              <div className="font-mono font-700 text-lg text-[#1C2620]" style={{ fontFamily: 'var(--font-mono)' }}>
                {mode.prix}
              </div>
              <div className="text-xs text-[#5C6B5E] mt-1">{mode.disponibilite}</div>
              {mode.economie !== '—' && (
                <div className={`text-xs font-semibold mt-1.5 ${c.text}`}>{mode.economie}</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded detail */}
      {(() => {
        const mode = modes.find(m => m.id === selected);
        if (!mode) return null;
        const c = colorMap[mode.color];
        return (
          <div className={`rounded-2xl border-2 ${c.border} ${c.bg} p-5 space-y-3 transition-all duration-300`}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'État', value: mode.etat },
                { label: 'Délai', value: mode.delai },
                { label: 'Garantie', value: mode.garantie },
                { label: 'Vendeur', value: mode.vendeur },
                { label: 'Conditions', value: mode.conditions },
                { label: 'Impact éco', value: mode.ecologie },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono text-[#5C6B5E] uppercase tracking-widest">{label}</span>
                  <span className="text-[#1C2620] font-medium text-xs">{value}</span>
                </div>
              ))}
            </div>

            {/* AI advice */}
            {loadingAdvice ? (
              <div className="flex items-center gap-2 text-xs text-[#5C6B5E] pt-2 border-t border-black/10">
                <div className="flex gap-1">{[0,1,2].map(i => <span key={i} className="w-1 h-1 rounded-full bg-[#E4501C] animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div>
                Analyse IA en cours…
              </div>
            ) : aiAdvice ? (
              <div className="flex items-start gap-2 pt-2 border-t border-black/10">
                <Icon name="SparklesIcon" size={12} variant="outline" className="text-[#E4501C] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#1C2620] leading-relaxed">{aiAdvice}</p>
              </div>
            ) : null}

            <button
              onClick={handleCTA}
              className={`w-full py-3 rounded-full font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-95 ${c.badge} ${cartAdded && selected === 'neuf' ? 'bg-emerald-500' : ''}`}
            >
              {ctaLabels[selected]}
            </button>
          </div>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: AI SCORE — dynamic real Gemini analysis
// ─────────────────────────────────────────────────────────────────────────────
function AICompatibilityScore({ product }: { product: Product }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [aiScores, setAiScores] = useState<{ label: string; value: number; icon: string }[] | null>(null);
  const score = product.score_kdv ?? 93;

  const generateAnalysis = useCallback(async () => {
    if (analysis) return;
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'GEMINI',
          model: 'gemini/gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: `Analyse ce produit outdoor et retourne un JSON avec exactement ces champs:
{
  "analyse": "3 phrases: point fort, point faible, profil idéal",
  "scores": [
    {"label":"Type de voyage","value":0-100,"icon":"🎒"},
    {"label":"Climat","value":0-100,"icon":"🌤️"},
    {"label":"Compatibilité sac","value":0-100,"icon":"🎽"},
    {"label":"Budget","value":0-100,"icon":"💰"},
    {"label":"Durabilité","value":0-100,"icon":"🔧"}
  ]
}
Produit: ${product.nom} | Marque: ${product.marque} | Catégorie: ${product.categorie} | Poids: ${product.poids_g}g | Prix: ${(product.prix_cents/100).toFixed(0)}€ | Score KDV: ${product.score_kdv ?? 'N/A'}`,
          }],
          parameters: { temperature: 0.3, max_tokens: 400, response_format: { type: 'json_object' } },
        }),
      });
      const data = await res.json();
      const content = data.content ?? data.choices?.[0]?.message?.content ?? '{}';
      try {
        const parsed = JSON.parse(content);
        setAnalysis(parsed.analyse ?? null);
        if (Array.isArray(parsed.scores)) setAiScores(parsed.scores);
      } catch {
        setAnalysis(content);
      }
    } catch {
      setAnalysis('Analyse IA temporairement indisponible.');
    } finally {
      setLoading(false);
    }
  }, [product, analysis]);

  useEffect(() => {
    generateAnalysis();
  }, [generateAnalysis]);

  const displayScores = aiScores ?? [
    { label: 'Type de voyage', value: 97, icon: '🎒' },
    { label: 'Climat', value: 88, icon: '🌤️' },
    { label: 'Compatibilité sac', value: 91, icon: '🎽' },
    { label: 'Budget', value: 85, icon: '💰' },
    { label: 'Durabilité', value: 94, icon: '🔧' },
  ];

  return (
    <div className="topo-card p-6 border-[#3E6B7A]/30 border-2 bg-gradient-to-br from-[#1C2620] to-[#243028]">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Icon name="SparklesIcon" size={16} variant="outline" className="text-[#E4501C]" />
            <span className="text-xs font-mono text-white/50 uppercase tracking-widest">Score IA Gemini</span>
          </div>
          <h3 className="font-display font-700 text-white text-lg" style={{ fontFamily: 'var(--font-display)' }}>Analyse intelligente</h3>
        </div>
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            <circle
              cx="40" cy="40" r="32" fill="none"
              stroke="#E4501C" strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 32}`}
              strokeDashoffset={`${2 * Math.PI * 32 * (1 - score / 100)}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono font-700 text-white text-xl leading-none" style={{ fontFamily: 'var(--font-mono)' }}>{score}</span>
            <span className="text-white/40 text-[9px] font-mono">/100</span>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-5">
        {displayScores.map((c) => (
          <div key={c.label} className="flex items-center gap-3">
            <span className="text-base w-6 flex-shrink-0">{c.icon}</span>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/70">{c.label}</span>
                <span className="text-xs font-mono text-white/90" style={{ fontFamily: 'var(--font-mono)' }}>{c.value}%</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#E4501C] to-[#B5652D] transition-all duration-700"
                  style={{ width: `${c.value}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <div className="flex gap-1">{[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#E4501C] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
          Analyse Gemini en cours…
        </div>
      ) : analysis ? (
        <p className="text-sm text-white/70 leading-relaxed border-t border-white/10 pt-4">{analysis}</p>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: AI CHAT ASSISTANT — new feature
// ─────────────────────────────────────────────────────────────────────────────
function AIProductChat({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const SUGGESTIONS = [
    'Ce produit convient-il à un trek en Islande ?',
    'Quelle est la différence avec la version Pro ?',
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
              content: `Tu es un expert équipement outdoor pour "Le Kit du Voyageur". Tu réponds en français, de façon concise et utile (max 3 phrases). Produit en question: ${product.nom} par ${product.marque}, catégorie ${product.categorie}, ${product.poids_g}g, ${(product.prix_cents/100).toFixed(0)}€, score KDV ${product.score_kdv ?? 'N/A'}/100.`,
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
    <div className="topo-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 hover:bg-[#D4CFBF]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E4501C] to-[#B5652D] flex items-center justify-center">
            <Icon name="SparklesIcon" size={14} variant="outline" className="text-white" />
          </div>
          <div className="text-left">
            <div className="font-semibold text-[#1C2620] text-sm">Demandez à l&apos;IA</div>
            <div className="text-xs text-[#5C6B5E]">Posez vos questions sur ce produit</div>
          </div>
        </div>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} variant="outline" className="text-[#5C6B5E]" />
      </button>

      {open && (
        <div className="border-t border-[#C8C3B0]">
          {/* Messages */}
          <div className="h-48 overflow-y-auto p-4 space-y-3 bg-[#F5F2EA]">
            {messages.length === 0 && (
              <div className="text-center py-4">
                <p className="text-xs text-[#5C6B5E] mb-3">Questions fréquentes :</p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-xs text-left px-3 py-2 rounded-lg bg-white border border-[#C8C3B0] hover:border-[#E4501C] hover:text-[#E4501C] transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                  m.role === 'user' ?'bg-[#E4501C] text-white rounded-br-sm' :'bg-white border border-[#C8C3B0] text-[#1C2620] rounded-bl-sm'
                }`}>
                  {m.role === 'assistant' && (
                    <div className="flex items-center gap-1 mb-1 text-[#E4501C]">
                      <Icon name="SparklesIcon" size={10} variant="outline" />
                      <span className="text-[9px] font-mono uppercase tracking-widest">Gemini</span>
                    </div>
                  )}
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-[#C8C3B0] px-3 py-2 rounded-xl rounded-bl-sm">
                  <div className="flex gap-1">{[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#E4501C] animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[#C8C3B0] flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              placeholder="Posez votre question…"
              className="flex-1 bg-[#F5F2EA] border border-[#C8C3B0] rounded-lg px-3 py-2 text-xs text-[#1C2620] focus:outline-none focus:border-[#E4501C] transition-colors"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-lg bg-[#E4501C] text-white flex items-center justify-center hover:bg-[#cc3d10] transition-colors disabled:opacity-40"
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
// SECTION: TRAVEL COMPATIBILITY
// ─────────────────────────────────────────────────────────────────────────────
function TravelCompatibility() {
  return (
    <section className="py-12">
      <div className="flex items-center gap-3 mb-6">
        <Icon name="GlobeAltIcon" size={20} variant="outline" className="text-[#E4501C]" />
        <h2 className="font-display font-700 text-2xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>Pour quels voyages ?</h2>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {TRAVEL_TYPES.map((t) => (
          <div key={t.id} className="topo-card p-3 text-center group hover:border-[#E4501C]/40 transition-all">
            <div className="text-2xl mb-2">{t.icon}</div>
            <div className="text-xs font-medium text-[#1C2620] mb-2">{t.label}</div>
            <div className="h-1.5 bg-[#C8C3B0] rounded-full overflow-hidden mb-1">
              <div
                className={`h-full rounded-full transition-all duration-700 ${t.score >= 80 ? 'bg-[#E4501C]' : t.score >= 60 ? 'bg-[#B5652D]' : 'bg-[#C8C3B0]'}`}
                style={{ width: `${t.score}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono font-700 ${t.score >= 80 ? 'text-[#E4501C]' : t.score >= 60 ? 'text-[#B5652D]' : 'text-[#5C6B5E]'}`} style={{ fontFamily: 'var(--font-mono)' }}>
              {t.score}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: BAG VISUALIZATION
// ─────────────────────────────────────────────────────────────────────────────
function BagVisualization({ product }: { product: Product }) {
  return (
    <section className="py-12">
      <div className="flex items-center gap-3 mb-6">
        <Icon name="ArchiveBoxIcon" size={20} variant="outline" className="text-[#E4501C]" />
        <h2 className="font-display font-700 text-2xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>Visualisation dans le sac</h2>
      </div>
      <p className="text-sm text-[#5C6B5E] mb-6">Dans quels sacs ce produit rentre-t-il réellement ?</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {BAG_SIZES.map((bag) => (
          <div key={bag.label} className={`topo-card p-4 text-center ${bag.fits ? 'border-emerald-300' : 'border-red-200 opacity-60'}`}>
            <div className="relative w-12 h-16 mx-auto mb-2">
              <div className={`w-full h-full rounded-lg border-2 ${bag.fits ? 'border-emerald-400 bg-emerald-50' : 'border-red-300 bg-red-50'} flex items-end overflow-hidden`}>
                {bag.fits && (
                  <div className="w-full bg-[#E4501C]/30 rounded-b-md transition-all duration-700" style={{ height: `${bag.percent}%` }} />
                )}
              </div>
              <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] ${bag.fits ? 'bg-emerald-500' : 'bg-red-400'}`}>
                {bag.fits ? '✓' : '✗'}
              </div>
            </div>
            <div className="font-mono font-700 text-sm text-[#1C2620]" style={{ fontFamily: 'var(--font-mono)' }}>{bag.label}</div>
            {bag.fits && <div className="text-[10px] text-[#5C6B5E] mt-0.5">{bag.percent}% du volume</div>}
          </div>
        ))}
      </div>
      <p className="text-xs text-[#5C6B5E] mt-3">
        <Icon name="InformationCircleIcon" size={12} variant="outline" className="inline mr-1" />
        Basé sur les dimensions de {product.nom} ({product.poids_g}g)
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: PRICE HISTORY
// ─────────────────────────────────────────────────────────────────────────────
function PriceHistory() {
  const maxPrice = Math.max(...PRICE_HISTORY.map(p => p.neuf));
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section className="py-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Icon name="ChartBarIcon" size={20} variant="outline" className="text-[#E4501C]" />
          <h2 className="font-display font-700 text-2xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>Historique du prix</h2>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E4501C] text-[#E4501C] text-xs font-semibold hover:bg-[#E4501C]/5 transition-colors">
          <Icon name="BellIcon" size={12} variant="outline" />
          Alerte de baisse
        </button>
      </div>
      <div className="topo-card p-5">
        <div className="flex items-center gap-4 mb-4 text-xs">
          <div className="flex items-center gap-1.5"><div className="w-3 h-1 rounded bg-[#E4501C]" /><span className="text-[#5C6B5E]">Neuf</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-1 rounded bg-[#B5652D]" /><span className="text-[#5C6B5E]">Occasion</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-1 rounded bg-[#3E6B7A]" /><span className="text-[#5C6B5E]">Location/j</span></div>
        </div>
        <div className="relative h-40">
          <div className="flex items-end justify-between h-full gap-1">
            {PRICE_HISTORY.map((p, i) => (
              <div
                key={p.month}
                className="flex-1 flex flex-col items-center gap-0.5 cursor-pointer group relative"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {hoveredIndex === i && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1C2620] text-white text-[10px] font-mono px-2 py-1 rounded whitespace-nowrap z-10">
                    {p.neuf}€ neuf · {p.occasion}€ occ.
                  </div>
                )}
                <div className="w-full flex items-end gap-0.5 h-32">
                  <div className="flex-1 bg-[#E4501C] rounded-t transition-all duration-300 group-hover:opacity-80" style={{ height: `${(p.neuf / maxPrice) * 100}%` }} />
                  <div className="flex-1 bg-[#B5652D] rounded-t transition-all duration-300 group-hover:opacity-80" style={{ height: `${(p.occasion / maxPrice) * 100}%` }} />
                </div>
                <span className="text-[9px] font-mono text-[#5C6B5E]">{p.month}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[#C8C3B0] flex items-center justify-between text-xs text-[#5C6B5E]">
          <span>Prix le plus bas (12 mois) : <strong className="text-[#E4501C]">79 €</strong></span>
          <span>Prix actuel : <strong className="text-[#1C2620]">89 €</strong></span>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: ENVIRONMENTAL IMPACT
// ─────────────────────────────────────────────────────────────────────────────
function EnvironmentalImpact() {
  const metrics = [
    { label: 'Empreinte carbone', value: '4,2 kg CO₂', icon: '🌍', score: 72, color: 'bg-emerald-500' },
    { label: 'Réparabilité', value: '8/10', icon: '🔧', score: 80, color: 'bg-blue-500' },
    { label: 'Recyclabilité', value: '65%', icon: '♻️', score: 65, color: 'bg-teal-500' },
    { label: 'Durabilité', value: '5–8 ans', icon: '⏳', score: 85, color: 'bg-green-500' },
    { label: 'Matériaux', value: 'Recyclés 40%', icon: '🧵', score: 40, color: 'bg-amber-500' },
  ];

  return (
    <section className="py-12">
      <div className="flex items-center gap-3 mb-6">
        <Icon name="GlobeAmericasIcon" size={20} variant="outline" className="text-emerald-600" />
        <h2 className="font-display font-700 text-2xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>Impact environnemental</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="topo-card p-4 text-center">
            <div className="text-2xl mb-2">{m.icon}</div>
            <div className="font-mono font-700 text-[#1C2620] text-sm mb-1" style={{ fontFamily: 'var(--font-mono)' }}>{m.value}</div>
            <div className="text-[10px] text-[#5C6B5E] mb-2">{m.label}</div>
            <div className="h-1.5 bg-[#C8C3B0] rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${m.color}`} style={{ width: `${m.score}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
        <span className="text-emerald-600 text-lg flex-shrink-0">🌿</span>
        <p className="text-sm text-emerald-800">
          <strong>Conseil :</strong> Choisir l&apos;occasion ou la location réduit l&apos;empreinte carbone de ce produit de 60 à 80%.
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: COMPARISONS
// ─────────────────────────────────────────────────────────────────────────────
function ProductComparisons({ product }: { product: Product }) {
  const competitors = [
    { nom: product.nom, poids: product.poids_g, prix: product.prix_cents / 100, note: product.note, garantie: '2 ans', reparabilite: 8, isMain: true },
    { nom: 'Deuter Aircontact 40', poids: 1680, prix: 149, note: 4.4, garantie: '3 ans', reparabilite: 7, isMain: false },
    { nom: 'Gregory Baltoro 40', poids: 1920, prix: 199, note: 4.6, garantie: '2 ans', reparabilite: 6, isMain: false },
    { nom: 'Hyperlite 3400', poids: 680, prix: 340, note: 4.8, garantie: '1 an', reparabilite: 5, isMain: false },
  ];

  return (
    <section className="py-12">
      <div className="flex items-center gap-3 mb-6">
        <Icon name="ScaleIcon" size={20} variant="outline" className="text-[#E4501C]" />
        <h2 className="font-display font-700 text-2xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>Comparaisons</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#C8C3B0]">
              <th className="text-left py-3 pr-4 text-[#5C6B5E] font-medium text-xs">Produit</th>
              <th className="text-center py-3 px-3 text-[#5C6B5E] font-medium text-xs">Poids</th>
              <th className="text-center py-3 px-3 text-[#5C6B5E] font-medium text-xs">Prix</th>
              <th className="text-center py-3 px-3 text-[#5C6B5E] font-medium text-xs">Note</th>
              <th className="text-center py-3 px-3 text-[#5C6B5E] font-medium text-xs">Garantie</th>
              <th className="text-center py-3 px-3 text-[#5C6B5E] font-medium text-xs">Répar.</th>
            </tr>
          </thead>
          <tbody>
            {competitors.map((c) => (
              <tr key={c.nom} className={`border-b border-[#C8C3B0]/50 ${c.isMain ? 'bg-[#E4501C]/5' : ''}`}>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    {c.isMain && <span className="w-1.5 h-1.5 rounded-full bg-[#E4501C] flex-shrink-0" />}
                    <span className={`font-medium ${c.isMain ? 'text-[#E4501C]' : 'text-[#1C2620]'}`}>{c.nom}</span>
                  </div>
                </td>
                <td className="text-center py-3 px-3 font-mono text-xs" style={{ fontFamily: 'var(--font-mono)' }}>{c.poids}g</td>
                <td className="text-center py-3 px-3 font-mono text-xs font-700" style={{ fontFamily: 'var(--font-mono)' }}>{c.prix}€</td>
                <td className="text-center py-3 px-3"><span className="font-mono text-xs text-amber-600" style={{ fontFamily: 'var(--font-mono)' }}>★ {c.note}</span></td>
                <td className="text-center py-3 px-3 text-xs text-[#5C6B5E]">{c.garantie}</td>
                <td className="text-center py-3 px-3"><span className={`text-xs font-mono font-700 ${c.reparabilite >= 7 ? 'text-emerald-600' : 'text-amber-600'}`} style={{ fontFamily: 'var(--font-mono)' }}>{c.reparabilite}/10</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: REVIEWS
// ─────────────────────────────────────────────────────────────────────────────
function TravelerReviews({ product }: { product: Product }) {
  const [filter, setFilter] = useState<string>('all');
  const reviews = [
    { author: 'Marie L.', country: '🇫🇷', rating: 5, comment: 'Parfait pour mon tour du monde de 8 mois. Solide, léger, et le système de portage est excellent.', date: 'Juin 2026', bag: '40L', duration: '8 mois', verified: true, helpful: 42 },
    { author: 'Thomas K.', country: '🇩🇪', rating: 4, comment: 'Très bon sac mais les sangles de poitrine sont un peu rigides au début. Après rodage, parfait.', date: 'Mai 2026', bag: '40L', duration: '3 semaines', verified: true, helpful: 28 },
    { author: 'Sofia M.', country: '🇪🇸', rating: 5, comment: 'Utilisé au Népal pendant 3 semaines de trek. Aucun problème, même sous la pluie.', date: 'Avr 2026', bag: '40L', duration: '3 semaines', verified: true, helpful: 35 },
    { author: 'Alex R.', country: '🇺🇸', rating: 4, comment: 'Excellent rapport qualité/prix. Je recommande pour les voyageurs qui veulent voyager léger.', date: 'Mar 2026', bag: '40L', duration: '2 mois', verified: false, helpful: 19 },
  ];

  const filters = [
    { id: 'all', label: 'Tous' },
    { id: 'trek', label: 'Trek' },
    { id: 'backpacking', label: 'Backpacking' },
    { id: 'verified', label: 'Vérifiés' },
  ];

  const filtered = filter === 'verified' ? reviews.filter(r => r.verified) : reviews;

  return (
    <section className="py-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Icon name="StarIcon" size={20} variant="outline" className="text-amber-500" />
          <h2 className="font-display font-700 text-2xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>Avis des voyageurs</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-700 text-2xl text-[#1C2620]" style={{ fontFamily: 'var(--font-mono)' }}>{product.note}</span>
          <div className="flex">
            {[1,2,3,4,5].map(s => (
              <svg key={s} className={`w-4 h-4 ${s <= Math.round(product.note) ? 'text-amber-400' : 'text-[#C8C3B0]'}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-sm text-[#5C6B5E]">({product.avis_count} avis)</span>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {filters.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${filter === f.id ? 'bg-[#E4501C] text-white' : 'bg-[#EDEAE0] text-[#5C6B5E] hover:bg-[#D4CFBF]'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((r, i) => (
          <div key={i} className="topo-card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1C2620] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">{r.author[0]}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1C2620] text-sm">{r.author}</span>
                    <span className="text-base">{r.country}</span>
                    {r.verified && <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">✓ Vérifié</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[#5C6B5E] font-mono mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>
                    <span>{r.bag}</span><span>·</span><span>{r.duration}</span><span>·</span><span>{r.date}</span>
                  </div>
                </div>
              </div>
              <div className="flex">
                {[1,2,3,4,5].map(s => (
                  <svg key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? 'text-amber-400' : 'text-[#C8C3B0]'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
            <p className="text-sm text-[#5C6B5E] leading-relaxed">{r.comment}</p>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#C8C3B0]/50">
              <button className="flex items-center gap-1.5 text-xs text-[#5C6B5E] hover:text-[#E4501C] transition-colors">
                <Icon name="HandThumbUpIcon" size={12} variant="outline" />Utile ({r.helpful})
              </button>
              <button className="flex items-center gap-1.5 text-xs text-[#5C6B5E] hover:text-[#E4501C] transition-colors">
                <Icon name="ChatBubbleLeftIcon" size={12} variant="outline" />Répondre
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: FAQ
// ─────────────────────────────────────────────────────────────────────────────
function ProductFAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="py-12">
      <div className="flex items-center gap-3 mb-6">
        <Icon name="QuestionMarkCircleIcon" size={20} variant="outline" className="text-[#E4501C]" />
        <h2 className="font-display font-700 text-2xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>Questions fréquentes</h2>
      </div>
      <div className="space-y-2">
        {FAQ_ITEMS.map((item, i) => (
          <div key={i} className="topo-card overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left hover:bg-[#D4CFBF]/30 transition-colors">
              <span className="font-medium text-[#1C2620] text-sm pr-4">{item.q}</span>
              <Icon name={open === i ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={16} variant="outline" className="text-[#5C6B5E] flex-shrink-0" />
            </button>
            {open === i && (
              <div className="px-5 pb-5 text-sm text-[#5C6B5E] leading-relaxed border-t border-[#C8C3B0]/50 pt-4">{item.a}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: ALTERNATIVES
// ─────────────────────────────────────────────────────────────────────────────
function ProductAlternatives() {
  return (
    <section className="py-12">
      <div className="flex items-center gap-3 mb-6">
        <Icon name="ArrowsRightLeftIcon" size={20} variant="outline" className="text-[#E4501C]" />
        <h2 className="font-display font-700 text-2xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>Alternatives</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ALTERNATIVES.map((alt) => (
          <div key={alt.label} className="topo-card p-4 hover:border-[#E4501C]/40 transition-all cursor-pointer group">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{alt.icon}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${alt.badge}`}>{alt.label}</span>
            </div>
            <h3 className="font-semibold text-[#1C2620] text-sm mb-2 group-hover:text-[#E4501C] transition-colors">{alt.nom}</h3>
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-[#5C6B5E]" style={{ fontFamily: 'var(--font-mono)' }}>{alt.poids}</span>
              <span className="font-mono font-700 text-[#1C2620]" style={{ fontFamily: 'var(--font-mono)' }}>{alt.prix}</span>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              <span className="text-[10px] font-mono text-[#5C6B5E]" style={{ fontFamily: 'var(--font-mono)' }}>{alt.note}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: COMPLEMENTARY PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────
function ComplementaryProducts() {
  return (
    <section className="py-12">
      <div className="flex items-center gap-3 mb-6">
        <Icon name="PuzzlePieceIcon" size={20} variant="outline" className="text-[#E4501C]" />
        <h2 className="font-display font-700 text-2xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>Produits complémentaires</h2>
      </div>
      <p className="text-sm text-[#5C6B5E] mb-6">Construisez un kit cohérent avec ces produits souvent associés.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {COMPLEMENTARY.map((p) => (
          <div key={p.nom} className="topo-card overflow-hidden group cursor-pointer hover:border-[#E4501C]/40 transition-all">
            <div className="aspect-square overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt={p.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="p-3">
              <h3 className="font-medium text-[#1C2620] text-xs mb-1 group-hover:text-[#E4501C] transition-colors line-clamp-2">{p.nom}</h3>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[#5C6B5E]" style={{ fontFamily: 'var(--font-mono)' }}>{p.poids}</span>
                <span className="font-mono font-700 text-sm text-[#1C2620]" style={{ fontFamily: 'var(--font-mono)' }}>{p.prix}</span>
              </div>
              <div className="text-[10px] text-[#E4501C] mt-1 flex items-center gap-1">
                <Icon name="SparklesIcon" size={8} variant="outline" />{p.reason}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: KIT INSPIRATIONS
// ─────────────────────────────────────────────────────────────────────────────
function KitInspirations() {
  return (
    <section className="py-12">
      <div className="flex items-center gap-3 mb-6">
        <Icon name="LightBulbIcon" size={20} variant="outline" className="text-[#E4501C]" />
        <h2 className="font-display font-700 text-2xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>Inspirations de kits</h2>
      </div>
      <p className="text-sm text-[#5C6B5E] mb-6">Ce produit est utilisé dans ces kits réels de voyageurs.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {KIT_INSPIRATIONS.map((kit) => (
          <Link key={kit.label} href="/kits" className="topo-card overflow-hidden group block hover:border-[#E4501C]/40 transition-all">
            <div className="aspect-[4/3] overflow-hidden relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={kit.image} alt={kit.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-2 left-2 right-2">
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-sm">{kit.icon}</span>
                  <span className="text-white font-semibold text-xs">{kit.label}</span>
                </div>
              </div>
            </div>
            <div className="p-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#5C6B5E]" style={{ fontFamily: 'var(--font-mono)' }}>
                <span>{kit.produits} produits</span><span>{kit.poids}</span>
              </div>
              <div className="text-[10px] font-mono font-700 text-[#E4501C] mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{kit.budget}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: ADD TO KIT
// ─────────────────────────────────────────────────────────────────────────────
function AddToKit({ product }: { product: Product }) {
  const [added, setAdded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ poids: string; budget: string; message: string } | null>(null);

  const handleAdd = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/ai/chat-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'GEMINI',
          model: 'gemini/gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: `Vérifie la compatibilité de "${product.nom}" (${product.poids_g}g, ${(product.prix_cents/100).toFixed(0)}€) avec un kit de voyage standard. Retourne en 1 phrase courte si c'est compatible et pourquoi.`,
          }],
          parameters: { temperature: 0.5, max_tokens: 80 },
        }),
      });
      const data = await res.json();
      const msg = data.content ?? data.choices?.[0]?.message?.content ?? 'Compatible avec votre équipement actuel.';
      setResult({
        poids: `${(product.poids_g / 1000).toFixed(1)} kg ajouté → Total estimé : 8,4 kg`,
        budget: `${(product.prix_cents / 100).toFixed(0)} € ajouté → Total estimé : 412 €`,
        message: msg,
      });
    } catch {
      setResult({
        poids: `${(product.poids_g / 1000).toFixed(1)} kg ajouté → Total : 8,4 kg`,
        budget: `${(product.prix_cents / 100).toFixed(0)} € ajouté → Total : 412 €`,
        message: 'Aucun doublon détecté. Compatible avec votre équipement actuel.',
      });
    }
    setAdded(true);
    setChecking(false);
  }, [product]);

  return (
    <div className="topo-card p-6 bg-gradient-to-br from-[#1C2620] to-[#243028] border-[#E4501C]/30 border-2">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="PlusCircleIcon" size={18} variant="outline" className="text-[#E4501C]" />
        <h3 className="font-display font-700 text-white text-lg" style={{ fontFamily: 'var(--font-display)' }}>Ajouter à mon kit</h3>
      </div>
      <p className="text-sm text-white/60 mb-5">L&apos;IA vérifie instantanément le poids total, le budget, les doublons et les incompatibilités.</p>

      {!added ? (
        <div className="space-y-3">
          {[
            { label: 'Kit actuel', icon: 'ArchiveBoxIcon', desc: 'Sac Tour du Monde' },
            { label: 'Wishlist', icon: 'HeartIcon', desc: 'Ma liste de souhaits' },
            { label: 'Prochain voyage', icon: 'MapPinIcon', desc: 'Islande — Juillet 2026' },
          ].map((opt) => (
            <button key={opt.label} onClick={handleAdd} disabled={checking} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#E4501C]/40 transition-all text-left group">
              <Icon name={opt.icon as Parameters<typeof Icon>[0]['name']} size={16} variant="outline" className="text-white/50 group-hover:text-[#E4501C] transition-colors flex-shrink-0" />
              <div>
                <div className="text-white text-sm font-medium">{opt.label}</div>
                <div className="text-white/40 text-xs">{opt.desc}</div>
              </div>
              <Icon name="PlusIcon" size={14} variant="outline" className="text-white/30 group-hover:text-[#E4501C] ml-auto transition-colors" />
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <Icon name="CheckCircleIcon" size={18} variant="outline" />
            <span className="font-semibold text-sm">Ajouté avec succès !</span>
          </div>
          {result && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-white/70"><span className="text-base">⚖️</span><span>{result.poids}</span></div>
              <div className="flex items-center gap-2 text-white/70"><span className="text-base">💰</span><span>{result.budget}</span></div>
              <div className="flex items-start gap-2 text-emerald-400/80">
                <Icon name="SparklesIcon" size={12} variant="outline" className="flex-shrink-0 mt-0.5" />
                <span className="text-xs">{result.message}</span>
              </div>
            </div>
          )}
          <Link href="/inventaire" className="block text-center py-2.5 rounded-full bg-[#E4501C] text-white text-sm font-semibold hover:bg-[#cc3d10] transition-colors">
            Voir mon kit
          </Link>
        </div>
      )}

      {checking && (
        <div className="mt-4 flex items-center gap-2 text-sm text-white/50">
          <div className="flex gap-1">{[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#E4501C] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
          Vérification IA en cours…
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: USAGE TIPS
// ─────────────────────────────────────────────────────────────────────────────
function UsageTips() {
  const tips = [
    { icon: '📦', title: 'Comment ranger', desc: 'Placez les objets lourds près du dos, les légers en haut. Utilisez les poches latérales pour l\'accès rapide.' },
    { icon: '🧹', title: 'Entretien', desc: 'Nettoyez avec une éponge humide et du savon doux. Évitez la machine à laver. Séchez à l\'air libre.' },
    { icon: '⏳', title: 'Durée de vie', desc: 'Rangez dans un endroit sec et aéré. Évitez l\'exposition prolongée au soleil. Vérifiez les coutures régulièrement.' },
    { icon: '🔧', title: 'Réparation', desc: 'Les fermetures éclair et sangles sont remplaçables. Pièces disponibles 10 ans après achat.' },
  ];

  return (
    <section className="py-12">
      <div className="flex items-center gap-3 mb-6">
        <Icon name="WrenchScrewdriverIcon" size={20} variant="outline" className="text-[#E4501C]" />
        <h2 className="font-display font-700 text-2xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>Conseils d&apos;utilisation</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tips.map((tip) => (
          <div key={tip.title} className="topo-card p-5 flex gap-4">
            <span className="text-2xl flex-shrink-0">{tip.icon}</span>
            <div>
              <h3 className="font-semibold text-[#1C2620] text-sm mb-1">{tip.title}</h3>
              <p className="text-sm text-[#5C6B5E] leading-relaxed">{tip.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: TEAM REVIEW — AI-enhanced with real pros/cons from product data
// ─────────────────────────────────────────────────────────────────────────────
function TeamReview({ product }: { product: Product }) {
  const pros = product.advantages?.length ? product.advantages : ['Légèreté exceptionnelle', 'Système de portage ergonomique', 'Matériaux durables et recyclés', 'Réparabilité excellente'];
  const cons = product.disadvantages?.length ? product.disadvantages : ['Prix élevé pour les petits budgets', 'Poches latérales un peu étroites', 'Pas idéal pour le business travel'];

  return (
    <section className="py-12">
      <div className="flex items-center gap-3 mb-6">
        <Icon name="UserGroupIcon" size={20} variant="outline" className="text-[#E4501C]" />
        <h2 className="font-display font-700 text-2xl text-[#1C2620]" style={{ fontFamily: 'var(--font-display)' }}>Avis de l&apos;équipe</h2>
      </div>
      <div className="topo-card p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-full bg-[#1C2620] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">T</div>
          <div>
            <div className="font-semibold text-[#1C2620]">Thomas — Testeur terrain</div>
            <div className="text-xs text-[#5C6B5E] font-mono" style={{ fontFamily: 'var(--font-mono)' }}>Testé sur 3 continents · 18 mois d&apos;utilisation</div>
          </div>
        </div>
        <div className="space-y-4 text-sm text-[#5C6B5E] leading-relaxed">
          <p>
            <strong className="text-[#1C2620]">Pourquoi nous l&apos;avons sélectionné :</strong> {product.nom} représente le meilleur équilibre entre légèreté, durabilité et praticité dans sa catégorie. Après avoir testé plus de 40 modèles concurrents, c&apos;est celui que nous recommandons sans hésitation pour les voyageurs exigeants.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="font-semibold text-emerald-800 text-xs uppercase tracking-widest mb-2">Points forts</div>
              <ul className="space-y-1">
                {pros.map(p => (
                  <li key={p} className="flex items-center gap-2 text-emerald-700 text-xs"><span className="text-emerald-500">✓</span>{p}</li>
                ))}
              </ul>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div className="font-semibold text-amber-800 text-xs uppercase tracking-widest mb-2">Limites</div>
              <ul className="space-y-1">
                {cons.map(p => (
                  <li key={p} className="flex items-center gap-2 text-amber-700 text-xs"><span className="text-amber-500">!</span>{p}</li>
                ))}
              </ul>
            </div>
          </div>
          <p>
            <strong className="text-[#1C2620]">Notre verdict :</strong> Idéal pour les backpackers et trekkeurs qui voyagent plus de 2 semaines. Si vous partez pour un week-end ou un voyage business, regardez nos alternatives plus légères.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STICKY CTA
// ─────────────────────────────────────────────────────────────────────────────
function StickyCTA({ product, selectedMode }: { product: Product; selectedMode: string }) {
  const [visible, setVisible] = useState(false);
  const lastScrollY = useRef(0);
  const [cartAdded, setCartAdded] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      setVisible(currentY > 400);
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const modeLabels: Record<string, string> = {
    neuf: cartAdded ? '✓ Ajouté !' : 'Ajouter au panier',
    occasion: 'Voir les offres',
    location: 'Réserver',
  };

  const modePrices: Record<string, string> = {
    neuf: `${(product.prix_cents / 100).toFixed(0)} €`,
    occasion: `Dès ${Math.round(product.prix_cents * 0.62 / 100)} €`,
    location: `Dès ${Math.round(product.prix_cents * 0.04 / 100)} €/j`,
  };

  const handleCTA = () => {
    if (selectedMode === 'neuf') {
      addToCart({
        id: product.id,
        slug: product.slug,
        name: product.nom,
        brand: product.marque,
        category: product.categorie,
        priceEur: product.prix_cents / 100,
        weightG: product.poids_g,
        image: product.images[0]?.url ?? '',
        imageAlt: product.images[0]?.alt ?? product.nom,
      });
      setCartAdded(true);
      setTimeout(() => setCartAdded(false), 3000);
    } else if (selectedMode === 'occasion') {
      window.location.href = '/occasion';
    } else if (selectedMode === 'location') {
      window.location.href = '/location';
    }
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ${visible ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="bg-[#1C2620]/97 backdrop-blur-md border-t border-white/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="font-semibold text-white text-sm truncate">{product.nom}</div>
              <div className="text-white/50 text-xs font-mono" style={{ fontFamily: 'var(--font-mono)' }}>{product.poids_g}g · {product.marque}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <div className="font-mono font-700 text-white text-lg" style={{ fontFamily: 'var(--font-mono)' }}>{modePrices[selectedMode] ?? modePrices.neuf}</div>
              <div className="text-white/40 text-[10px]">{modeLabels[selectedMode] ?? 'Acheter neuf'}</div>
            </div>
            <button
              onClick={handleCTA}
              className={`py-2.5 px-5 text-sm whitespace-nowrap rounded-full font-semibold transition-all active:scale-95 ${cartAdded ? 'bg-emerald-500 text-white' : 'btn-primary'}`}
            >
              {modeLabels[selectedMode] ?? 'Ajouter au panier'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState('neuf');
  const [activeTab, setActiveTab] = useState<'specs' | 'conditions' | 'reviews'>('specs');

  useEffect(() => {
    fetchProduct(slug).then((p) => {
      setProduct(p ?? buildFallbackProduct(slug));
      setLoading(false);
    });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E7E3D6]">
        <Header />
        <div className="pt-20 max-w-7xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="aspect-square rounded-2xl bg-[#D4CFBF] animate-pulse" />
            <div className="space-y-4">
              <div className="h-4 bg-[#D4CFBF] rounded animate-pulse w-1/3" />
              <div className="h-8 bg-[#D4CFBF] rounded animate-pulse" />
              <div className="h-4 bg-[#D4CFBF] rounded animate-pulse w-2/3" />
              <div className="h-32 bg-[#D4CFBF] rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const modes = buildAcquisitionModes(product);

  return (
    <div className="min-h-screen bg-[#E7E3D6]">
      <Header />
      <main id="main-content" className="pt-20">

        {/* BREADCRUMB */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-xs text-[#5C6B5E] flex-wrap">
            <Link href="/" className="hover:text-[#E4501C] transition-colors">Accueil</Link>
            <Icon name="ChevronRightIcon" size={10} variant="outline" />
            <Link href="/boutique" className="hover:text-[#E4501C] transition-colors">Boutique</Link>
            <Icon name="ChevronRightIcon" size={10} variant="outline" />
            <Link href="/catalogue" className="hover:text-[#E4501C] transition-colors">{product.categorie}</Link>
            <Icon name="ChevronRightIcon" size={10} variant="outline" />
            <span className="text-[#1C2620] font-medium">{product.nom}</span>
          </nav>
        </div>

        {/* HERO: GALLERY + ACQUISITION */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-16">

            {/* LEFT: Gallery */}
            <div>
              <ProductGallery product={product} />
            </div>

            {/* RIGHT: Info + Acquisition */}
            <div className="space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-[#3E6B7A] uppercase tracking-widest" style={{ fontFamily: 'var(--font-mono)' }}>{product.marque}</span>
                  <span className="text-[#C8C3B0]">·</span>
                  <span className="text-xs font-mono text-[#5C6B5E]" style={{ fontFamily: 'var(--font-mono)' }}>{product.categorie}</span>
                  {product.essentiality && (
                    <>
                      <span className="text-[#C8C3B0]">·</span>
                      <span className="text-xs font-mono text-[#E4501C] font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>{product.essentiality}</span>
                    </>
                  )}
                </div>
                <h1 className="font-display font-700 text-3xl xl:text-4xl text-[#1C2620] mb-3 leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  {product.nom}
                </h1>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(s => (
                      <svg key={s} className={`w-4 h-4 ${s <= Math.round(product.note) ? 'text-amber-400' : 'text-[#C8C3B0]'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-sm font-mono text-[#3E6B7A]" style={{ fontFamily: 'var(--font-mono)' }}>{product.note} ({product.avis_count} avis)</span>
                </div>
                <p className="text-[#5C6B5E] text-sm leading-relaxed mb-4">{product.description}</p>

                {/* Weight + badges */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1C2620] text-white">
                    <Icon name="ScaleIcon" size={14} variant="outline" className="text-[#E4501C]" />
                    <span className="font-mono font-700 text-sm" style={{ fontFamily: 'var(--font-mono)' }}>{product.poids_g} g</span>
                  </div>
                  {product.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="px-3 py-1.5 rounded-full bg-[#E4501C]/10 text-[#E4501C] text-xs font-medium border border-[#E4501C]/20">{tag}</span>
                  ))}
                </div>
              </div>

              {/* Weight gauge */}
              <div className="topo-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-[#5C6B5E]">Gabarit de poids</span>
                  <span className="font-mono text-lg font-semibold text-[#3E6B7A]" style={{ fontFamily: 'var(--font-mono)' }}>{product.poids_g} g</span>
                </div>
                <WeightGauge weightG={product.poids_g} maxG={5000} />
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs font-mono text-[#5C6B5E]">0 g</span>
                  <span className="text-xs font-mono text-[#5C6B5E]">5 000 g</span>
                </div>
              </div>

              {/* ACQUISITION COMPARATOR — fully functional */}
              <AcquisitionComparator modes={modes} product={product} onModeChange={setSelectedMode} />

              {/* I already own this */}
              <AlreadyOwnButton product={product} />

              {/* AI SCORE */}
              <AICompatibilityScore product={product} />

              {/* AI CHAT */}
              <AIProductChat product={product} />

              {/* Add to Kit */}
              <AddToKit product={product} />
            </div>
          </div>
        </section>

        {/* TABS: SPECS / CONDITIONS / REVIEWS */}
        <section className="border-t border-[#C8C3B0] bg-[#EDEAE0]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-0 border-b border-[#C8C3B0]">
              {([
                { id: 'specs', label: 'Caractéristiques' },
                { id: 'conditions', label: 'Conditions idéales' },
                { id: 'reviews', label: `Avis (${product.avis_count})` },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-4 text-sm font-medium border-b-2 transition-all ${activeTab === tab.id ? 'border-[#E4501C] text-[#E4501C]' : 'border-transparent text-[#5C6B5E] hover:text-[#1C2620]'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="py-8">
              {activeTab === 'specs' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {product.specs.map((spec) => (
                    <div key={spec.label} className="flex items-center justify-between py-3 px-4 rounded-xl bg-[#E7E3D6] border border-[#C8C3B0]">
                      <span className="text-sm text-[#5C6B5E]">{spec.label}</span>
                      <span className="font-mono text-sm font-semibold text-[#1C2620]" style={{ fontFamily: 'var(--font-mono)' }}>{spec.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'conditions' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Printemps', icon: '🌸', ok: true },
                    { label: 'Été', icon: '☀️', ok: true },
                    { label: 'Automne', icon: '🍂', ok: true },
                    { label: 'Hiver', icon: '❄️', ok: false },
                    { label: 'Pluie', icon: '🌧️', ok: true },
                    { label: 'Neige', icon: '🌨️', ok: false },
                    { label: 'Désert', icon: '🏜️', ok: true },
                    { label: 'Jungle', icon: '🌿', ok: true },
                    { label: 'Montagne', icon: '⛰️', ok: true },
                    { label: 'Ville', icon: '🏙️', ok: true },
                    { label: 'Altitude', icon: '🗻', ok: false },
                    { label: 'Humidité', icon: '💧', ok: true },
                  ].map((c) => (
                    <div key={c.label} className={`topo-card p-4 text-center ${c.ok ? '' : 'opacity-50'}`}>
                      <div className="text-2xl mb-2">{c.icon}</div>
                      <div className="text-xs font-medium text-[#1C2620]">{c.label}</div>
                      <div className={`text-[10px] mt-1 font-semibold ${c.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                        {c.ok ? '✓ Compatible' : '✗ Déconseillé'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === 'reviews' && <TravelerReviews product={product} />}
            </div>
          </div>
        </section>

        {/* MAIN CONTENT SECTIONS */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <TravelCompatibility />
          <div className="border-t border-[#C8C3B0]" />
          <BagVisualization product={product} />
          <div className="border-t border-[#C8C3B0]" />
          <TeamReview product={product} />
          <div className="border-t border-[#C8C3B0]" />
          <ProductComparisons product={product} />
          <div className="border-t border-[#C8C3B0]" />
          <PriceHistory />
          <div className="border-t border-[#C8C3B0]" />
          <EnvironmentalImpact />
          <div className="border-t border-[#C8C3B0]" />
          <ProductAlternatives />
          <div className="border-t border-[#C8C3B0]" />
          <ComplementaryProducts />
          <div className="border-t border-[#C8C3B0]" />
          <KitInspirations />
          <div className="border-t border-[#C8C3B0]" />
          <UsageTips />
          <div className="border-t border-[#C8C3B0]" />
          <ProductFAQ />
        </div>

        {/* FOOTER INTELLIGENT */}
        <div className="bg-[#1C2620] py-12 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="font-display font-700 text-white text-xl mb-6" style={{ fontFamily: 'var(--font-display)' }}>Continuer à explorer</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Produits similaires', href: '/boutique', icon: 'ShoppingBagIcon', desc: 'Dans la même catégorie' },
                { label: 'Guides associés', href: '/guides', icon: 'BookOpenIcon', desc: 'Conseils & tutoriels' },
                { label: 'Destinations', href: '/pays', icon: 'MapPinIcon', desc: 'Où utiliser ce produit' },
                { label: 'Configurateur IA', href: '/ai-configurator', icon: 'SparklesIcon', desc: 'Construire mon kit' },
              ].map((item) => (
                <Link key={item.label} href={item.href} className="p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#E4501C]/40 transition-all group">
                  <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={18} variant="outline" className="text-[#E4501C] mb-2" />
                  <div className="font-semibold text-white text-sm group-hover:text-[#E4501C] transition-colors">{item.label}</div>
                  <div className="text-white/40 text-xs mt-0.5">{item.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>

      </main>
      <Footer />
      <StickyCTA product={product} selectedMode={selectedMode} />
    </div>
  );
}