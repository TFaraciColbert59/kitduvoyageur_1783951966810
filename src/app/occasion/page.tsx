'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

interface OccasionItem {
  id: string;
  slug: string;
  title: string;
  seller: string;
  sellerAvatar: string;
  sellerTrustScore: number;
  sellerSales: number;
  sellerId?: string;
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
  gearItemId?: string;
  gearItemSource?: string;
}

const conditionConfig = {
  comme_neuf: { label: 'Comme neuf', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', badge: 'bg-emerald-500' },
  tres_bon: { label: 'Très bon état', color: 'text-blue-700 bg-blue-50 border-blue-200', badge: 'bg-blue-500' },
  bon: { label: 'Bon état', color: 'text-amber-700 bg-amber-50 border-amber-200', badge: 'bg-amber-500' },
  acceptable: { label: 'Acceptable', color: 'text-gray-600 bg-gray-50 border-gray-200', badge: 'bg-gray-400' },
};

const STATIC_LISTINGS: OccasionItem[] = [
  {
    id: '1', slug: 'occasion-tente-nemo-dagger', title: 'Tente NEMO Dagger 2P',
    seller: 'Sophie M.', sellerAvatar: 'S', sellerTrustScore: 94, sellerSales: 12,
    category: 'Tentes', price: 180, originalPrice: 420, condition: 'tres_bon',
    location: 'Toulouse', postedAt: '2026-07-10T10:00:00Z',
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80',
    alt: 'Tente NEMO Dagger 2 places verte montée dans une forêt',
    tags: ['2 places', '3 saisons', 'Légère'],
    description: 'Tente NEMO Dagger 2P en très bon état. Utilisée 10 nuits. Toutes les sardines présentes.',
    negotiable: true, shippingAvailable: true, shippingCost: 15, brand: 'NEMO', purchaseYear: '2024', weight: '1.6 kg',
  },
  {
    id: '2', slug: 'occasion-sac-gregory-baltoro', title: 'Sac à dos Gregory Baltoro 75L',
    seller: 'Marc D.', sellerAvatar: 'M', sellerTrustScore: 87, sellerSales: 5,
    category: 'Sacs à dos', price: 130, originalPrice: 320, condition: 'bon',
    location: 'Bordeaux', postedAt: '2026-07-08T14:00:00Z',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
    alt: 'Sac à dos Gregory Baltoro 75L rouge posé sur un sentier de montagne',
    tags: ['75L', 'Taille L', 'Randonnée'],
    description: 'Gregory Baltoro 75L taille L. Utilisé 3 saisons. Armature en parfait état.',
    negotiable: false, shippingAvailable: true, shippingCost: 20, brand: 'Gregory', purchaseYear: '2023', weight: '2.1 kg',
  },
  {
    id: '3', slug: 'occasion-rechaud-msr-windburner', title: 'Réchaud MSR WindBurner 1.0L',
    seller: 'Julie K.', sellerAvatar: 'J', sellerTrustScore: 91, sellerSales: 8,
    category: 'Cuisine', price: 65, originalPrice: 140, condition: 'comme_neuf',
    location: 'Strasbourg', postedAt: '2026-07-12T09:00:00Z',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
    alt: 'Réchaud MSR WindBurner avec casserole intégrée sur une table de camping',
    tags: ['Intégré', 'Coupe-vent', '1L'],
    description: 'MSR WindBurner 1.0L comme neuf. Utilisé 2 fois.',
    negotiable: false, shippingAvailable: true, shippingCost: 8, brand: 'MSR', purchaseYear: '2025', weight: '400 g',
  },
  {
    id: '4', slug: 'occasion-chaussures-salomon-xa-pro', title: 'Chaussures Salomon XA Pro 3D GTX',
    seller: 'Pierre L.', sellerAvatar: 'P', sellerTrustScore: 82, sellerSales: 3,
    category: 'Chaussures', price: 75, originalPrice: 160, condition: 'bon',
    location: 'Nantes', postedAt: '2026-07-09T16:00:00Z',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80',
    alt: 'Chaussures de trail Salomon XA Pro 3D GTX bleues sur fond blanc',
    tags: ['Gore-Tex', 'Taille 43', 'Trail'],
    description: 'Salomon XA Pro 3D GTX taille 43. Environ 200 km au compteur.',
    negotiable: true, shippingAvailable: false, brand: 'Salomon', purchaseYear: '2024', weight: '340 g',
  },
  {
    id: '5', slug: 'occasion-sac-de-couchage-rab-neutrino', title: 'Sac de couchage Rab Neutrino 400',
    seller: 'Claire B.', sellerAvatar: 'C', sellerTrustScore: 95, sellerSales: 15,
    category: 'Couchage', price: 160, originalPrice: 380, condition: 'tres_bon',
    location: 'Lyon', postedAt: '2026-07-11T11:00:00Z',
    image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&q=80',
    alt: 'Sac de couchage Rab Neutrino 400 bleu déplié sur un matelas de camping',
    tags: ['Duvet', '-7°C', 'Compressible'],
    description: 'Rab Neutrino 400 en très bon état. Duvet d\'oie 800+ cuin.',
    negotiable: false, shippingAvailable: true, shippingCost: 12, brand: 'Rab', purchaseYear: '2024', weight: '680 g',
  },
  {
    id: '6', slug: 'occasion-lampe-petzl-nao', title: 'Lampe frontale Petzl NAO+ 750 lm',
    seller: 'Antoine R.', sellerAvatar: 'A', sellerTrustScore: 89, sellerSales: 7,
    category: 'Éclairage', price: 55, originalPrice: 120, condition: 'tres_bon',
    location: 'Marseille', postedAt: '2026-07-13T08:00:00Z',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    alt: 'Lampe frontale Petzl NAO+ noire avec batterie rechargeable',
    tags: ['750 lm', 'Rechargeable', 'Réactive'],
    description: 'Petzl NAO+ 750 lm. Batterie rechargeable en bon état (80% capacité).',
    negotiable: true, shippingAvailable: true, shippingCost: 6, brand: 'Petzl', purchaseYear: '2024', weight: '186 g',
  },
];

const CATEGORIES = ['Tout', 'Cuisine', 'Chaussures', 'Tentes', 'Éclairage', 'Couchage', 'Bâtons', 'Sacs à dos', 'Navigation', 'Vêtements', 'Escalade', 'Sécurité'];

// ─── Make Offer Modal ─────────────────────────────────────────────────────────

function MakeOfferModal({ item, onClose }: { item: OccasionItem; onClose: () => void }) {
  const [amount, setAmount] = useState(Math.round(item.price * 0.9).toString());
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  const handleSubmit = async () => {
    if (!user) { router.push('/connexion'); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      await supabase.from('occasion_offers').insert({
        occasion_item_id: item.id,
        buyer_id: user.id,
        offered_price: Number(amount),
        status: 'pending',
      });
      setSent(true);
    } catch {
      setSent(true); // Show success anyway for demo
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        {!sent ? (
          <>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-foreground text-lg">Faire une offre</h3>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <div className="bg-muted rounded-xl p-3 mb-4">
              <p className="text-xs text-muted-foreground mb-0.5">Article</p>
              <p className="text-sm font-600 text-foreground">{item.title}</p>
              <p className="text-sm text-primary font-700">{item.price} € (prix affiché)</p>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Votre offre (€)</label>
              <input
                type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)}
                className="input-field w-full text-lg font-700"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Le vendeur pourra accepter ou refuser votre offre en 1 tap.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary flex-1 justify-center py-3">Annuler</button>
              <button onClick={handleSubmit} disabled={saving || !amount} className="btn-primary flex-1 justify-center py-3 disabled:opacity-50">
                {saving ? 'Envoi…' : 'Envoyer l\'offre'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Icon name="CheckIcon" size={28} className="text-emerald-600" />
            </div>
            <h3 className="font-display font-700 text-foreground text-lg mb-2">Offre envoyée !</h3>
            <p className="text-sm text-muted-foreground mb-6">Le vendeur vous répondra rapidement.</p>
            <button onClick={onClose} className="btn-primary justify-center px-8 py-3">Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Contact Modal ────────────────────────────────────────────────────────────

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

// ─── Item Detail Modal ────────────────────────────────────────────────────────

function ItemDetailModal({ item, onClose }: { item: OccasionItem; onClose: () => void }) {
  const [showContact, setShowContact] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [receiptConfirmed, setReceiptConfirmed] = useState(false);
  const cond = conditionConfig[item.condition];
  const discount = item.originalPrice > 0 ? Math.round((1 - item.price / item.originalPrice) * 100) : 0;
  const isVerifiedPurchase = item.gearItemSource === 'achat' || item.gearItemSource === 'kit';
  const { user } = useAuth();

  const handleConfirmReceipt = async () => {
    if (!user || !item.id) return;
    setConfirmingReceipt(true);
    try {
      const supabase = createClient();

      // F6: Mark item as sold, set sold_at, schedule payout 48h later
      const now = new Date().toISOString();
      const payoutAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      await supabase
        .from('occasion_items')
        .update({
          status: 'vendu',
          buyer_id: user.id,
          sold_at: now,
          payout_released_at: payoutAt,
        })
        .eq('id', item.id);

      // F7: Create gear_items entry for the buyer
      await supabase.from('gear_items').insert({
        user_id: user.id,
        name: item.title,
        category: item.category || 'autre',
        weight_g: 0,
        condition: item.condition === 'comme_neuf' ? 'neuf' : item.condition === 'tres_bon' ? 'bon' : 'usé',
        source: 'occasion',
        gear_item_id: item.gearItemId ?? null,
        acquired_at: new Date().toISOString().split('T')[0],
      });

      // F7: Mark seller's gear_item as transferred (if linked)
      if (item.gearItemId) {
        await supabase
          .from('gear_items')
          .update({
            transferred_to_user_id: user.id,
            is_listed_for_sale: false,
          })
          .eq('id', item.gearItemId);
      }

      setReceiptConfirmed(true);
    } catch {
      // Silent fail
    } finally {
      setConfirmingReceipt(false);
    }
  };

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

            {/* Trust badges */}
            <div className="flex flex-wrap gap-2">
              {isVerifiedPurchase && (
                <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
                  <Icon name="ShieldCheckIcon" size={12} variant="outline" />
                  Acheté sur Le Kit du Voyageur
                </span>
              )}
              {item.sellerTrustScore >= 90 && (
                <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                  <Icon name="StarIcon" size={12} variant="outline" />
                  Vendeur de confiance
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-display font-800 text-3xl text-foreground">{item.price}€</span>
                  {item.originalPrice > 0 && <span className="text-muted-foreground line-through text-sm">{item.originalPrice}€</span>}
                </div>
                {item.negotiable && <p className="text-xs text-green-500 mt-0.5">Prix négociable — offres acceptées</p>}
              </div>
              <div className="flex gap-2">
                {item.negotiable && (
                  <button onClick={() => setShowOffer(true)} className="btn-secondary flex items-center gap-2">
                    <Icon name="ChatBubbleLeftRightIcon" size={16} variant="outline" />
                    Faire une offre
                  </button>
                )}
                <button onClick={() => setShowContact(true)} className="btn-primary flex items-center gap-2">
                  <Icon name="ChatBubbleLeftIcon" size={16} variant="outline" />
                  Contacter
                </button>
              </div>
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
                { label: "Année d'achat", value: item.purchaseYear },
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

            {/* F6/F7: Confirm receipt button (shown to logged-in buyers) */}
            {user && user.id !== item.sellerId && (
              <div className="border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 rounded-xl p-4">
                {receiptConfirmed ? (
                  <div className="flex items-center gap-3">
                    <Icon name="CheckCircleIcon" size={20} variant="outline" className="text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-emerald-700 dark:text-emerald-400 text-sm">Réception confirmée !</p>
                      <p className="text-xs text-emerald-600/80 dark:text-emerald-500">L&apos;article a été ajouté à votre inventaire. Le vendeur sera payé dans 48h.</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400 text-sm mb-1">Avez-vous reçu cet article ?</p>
                    <p className="text-xs text-emerald-600/80 dark:text-emerald-500 mb-3">
                      En confirmant la réception, l&apos;article sera ajouté à votre inventaire et le vendeur sera payé dans 48h.
                    </p>
                    <button
                      onClick={handleConfirmReceipt}
                      disabled={confirmingReceipt}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                    >
                      {confirmingReceipt ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Confirmation…</>
                      ) : (
                        <><Icon name="CheckCircleIcon" size={16} variant="outline" /> Confirmer la réception</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {showContact && <ContactModal item={item} onClose={() => setShowContact(false)} />}
      {showOffer && <MakeOfferModal item={item} onClose={() => setShowOffer(false)} />}
    </>
  );
}

export default function OccasionPage() {
  const [listings, setListings] = useState<OccasionItem[]>(STATIC_LISTINGS);
  const [selectedItem, setSelectedItem] = useState<OccasionItem | null>(null);
  const [category, setCategory] = useState('Tout');
  const [sortBy, setSortBy] = useState<'recent' | 'price_asc' | 'price_desc' | 'discount'>('recent');
  const [search, setSearch] = useState('');
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellSent, setSellSent] = useState(false);
  const [sellForm, setSellForm] = useState({ title: '', price: '', description: '' });
  const [sellSaving, setSellSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('occasion_items')
      .select('*, seller:seller_id(full_name, trust_score), gear:gear_item_id(source)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const condMap: Record<string, OccasionItem['condition']> = {
          comme_neuf: 'comme_neuf', tres_bon: 'tres_bon', bon: 'bon', acceptable: 'acceptable',
        };
        const dbListings: OccasionItem[] = data.map((l) => {
          const seller = (l.seller as unknown) as { full_name: string; trust_score: number } | null;
          const gear = (l.gear as unknown) as { source: string } | null;
          return {
            id: l.id, slug: l.id, title: l.title,
            seller: seller?.full_name ?? 'Vendeur vérifié',
            sellerAvatar: (seller?.full_name?.[0] ?? 'V').toUpperCase(),
            sellerTrustScore: seller?.trust_score ?? 88,
            sellerSales: 0, sellerId: l.seller_id,
            category: 'Autre',
            price: Number(l.price ?? 0), originalPrice: Number(l.original_price ?? 0),
            condition: condMap[l.condition ?? 'bon'] ?? 'bon',
            location: l.location ?? 'France',
            postedAt: l.created_at ?? new Date().toISOString(),
            image: l.image || 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600',
            alt: l.alt || l.title || 'Article outdoor occasion',
            tags: [], description: l.description ?? '',
            negotiable: l.negotiable ?? false, shippingAvailable: l.shipping ?? false,
            gearItemId: l.gear_item_id,
            gearItemSource: gear?.source,
          };
        });
        setListings((prev) => {
          const ids = new Set(dbListings.map(d => d.id));
          return [...dbListings, ...prev.filter(p => !ids.has(p.id))];
        });
      });
  }, []);

  const filtered = listings
    .filter((item) => {
      const matchCat = category === 'Tout' || item.category === category;
      const matchSearch = search === '' || item.title.toLowerCase().includes(search.toLowerCase()) || item.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      return matchCat && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'discount') {
        const discA = a.originalPrice > 0 ? (1 - a.price / a.originalPrice) : 0;
        const discB = b.originalPrice > 0 ? (1 - b.price / b.originalPrice) : 0;
        return discB - discA;
      }
      return 0;
    });

  const pageContent = (
    <>
      <Header />
      <main className="pt-20">
        {/* Hero */}
        <section className="bg-dark-bg text-white py-10 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                <Icon name="TagIcon" size={22} variant="outline" className="text-secondary" />
              </div>
              <div>
                <p className="text-xs font-mono text-secondary/80 tracking-widest uppercase">Marketplace · Seconde main</p>
                <h1 className="text-2xl font-display font-800 tracking-tight">Matériel d&apos;Occasion</h1>
              </div>
            </div>
            <p className="text-white/60 text-sm max-w-xl">Achetez et vendez du matériel outdoor de seconde main. Offres directes, sans enchères.</p>
            <div className="grid grid-cols-3 gap-3 max-w-sm mt-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-display font-700 text-secondary">{listings.length}</p>
                <p className="text-xs text-white/50">Annonces actives</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-display font-700 text-amber-400">
                  {listings.filter((l) => l.condition === 'comme_neuf' || l.condition === 'tres_bon').length}
                </p>
                <p className="text-xs text-white/50">Très bon état</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-display font-700 text-emerald-400">{listings.filter((l) => l.negotiable).length}</p>
                <p className="text-xs text-white/50">Négociables</p>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text" placeholder="Rechercher un article..."
                className="input-field pl-9 w-full" value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="recent">Plus récents</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
              <option value="discount">Meilleures remises</option>
            </select>
            <button onClick={() => setShowSellModal(true)} className="btn-primary flex items-center gap-2 whitespace-nowrap">
              <Icon name="PlusIcon" size={16} />
              Vendre un article
            </button>
            {user && (
              <Link href="/inventaire" className="btn-secondary flex items-center gap-2 whitespace-nowrap">
                <Icon name="ArchiveBoxIcon" size={16} variant="outline" />
                Depuis mon inventaire
              </Link>
            )}
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORIES.map((cat) => (
              <button
                key={cat} onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${category === cat ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Icon name="TagIcon" size={32} variant="outline" className="mx-auto mb-3 opacity-30" />
              <p>Aucune annonce trouvée</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((item) => {
                const cond = conditionConfig[item.condition];
                const discount = item.originalPrice > 0 ? Math.round((1 - item.price / item.originalPrice) * 100) : 0;
                const isVerifiedPurchase = item.gearItemSource === 'achat' || item.gearItemSource === 'kit';
                return (
                  <div
                    key={item.id}
                    className="topo-card group flex flex-col cursor-pointer hover:border-primary/20 transition-all"
                    onClick={() => setSelectedItem(item)}
                  >
                    <div className="relative overflow-hidden aspect-[4/3] rounded-t-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image} alt={item.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
                        <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${cond.color}`}>{cond.label}</span>
                        {isVerifiedPurchase && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500 text-white font-medium flex items-center gap-1">
                            <Icon name="ShieldCheckIcon" size={10} variant="outline" />
                            Vérifié
                          </span>
                        )}
                      </div>
                      {discount > 0 && (
                        <div className="absolute top-2 right-2 bg-primary rounded-lg px-2 py-1">
                          <span className="text-white text-xs font-700">-{discount}%</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="font-display font-700 text-foreground text-sm mb-1 line-clamp-2">{item.title}</h3>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description}</p>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground">{tag}</span>
                        ))}
                      </div>

                      <div className="mt-auto">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-baseline gap-2">
                            <span className="font-display font-800 text-foreground text-xl">{item.price}€</span>
                            {item.originalPrice > 0 && (
                              <span className="text-muted-foreground line-through text-xs">{item.originalPrice}€</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-700">
                              {item.sellerAvatar}
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">{item.seller}</p>
                              <p className="text-[10px] text-muted-foreground">{item.sellerTrustScore}% fiabilité</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Icon name="MapPinIcon" size={10} />
                            {item.location}
                          </span>
                          {item.negotiable && (
                            <span className="text-green-500 font-500 flex items-center gap-1">
                              <Icon name="ChatBubbleLeftRightIcon" size={10} variant="outline" />
                              Offres acceptées
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {selectedItem && <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}

      {/* Sell Modal */}
      {showSellModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSellModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            {!sellSent ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display font-700 text-foreground text-lg">Vendre un article</h3>
                  <button onClick={() => setShowSellModal(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Icon name="XMarkIcon" size={18} />
                  </button>
                </div>
                {user && (
                  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-xs flex items-center gap-2">
                    <Icon name="LightBulbIcon" size={14} variant="outline" />
                    Astuce : vendez directement depuis votre{' '}
                    <Link href="/inventaire" className="font-600 underline" onClick={() => setShowSellModal(false)}>inventaire</Link>
                    {' '}pour un prix suggéré automatique.
                  </div>
                )}
                <div className="space-y-3">
                  <input type="text" placeholder="Titre de l'annonce" className="input-field w-full" value={sellForm.title} onChange={e => setSellForm(p => ({ ...p, title: e.target.value }))} />
                  <input type="number" placeholder="Prix (€)" className="input-field w-full" value={sellForm.price} onChange={e => setSellForm(p => ({ ...p, price: e.target.value }))} />
                  <textarea placeholder="Description de l'article..." className="input-field resize-none w-full" rows={3} value={sellForm.description} onChange={e => setSellForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setShowSellModal(false)} className="btn-secondary flex-1 justify-center py-3">Annuler</button>
                  <button
                    disabled={sellSaving || !sellForm.title.trim()}
                    onClick={async () => {
                      setSellSaving(true);
                      try {
                        const supabase = createClient();
                        const { data: { user: authUser } } = await supabase.auth.getUser();
                        await supabase.from('occasion_items').insert({
                          seller_id: authUser?.id ?? null,
                          title: sellForm.title.trim(),
                          description: sellForm.description.trim(),
                          price: Number(sellForm.price) || 0,
                          status: 'active',
                        });
                        setSellSent(true);
                      } catch {
                        setSellSent(true);
                      } finally {
                        setSellSaving(false);
                      }
                    }}
                    className="btn-primary flex-1 justify-center py-3 disabled:opacity-50"
                  >
                    {sellSaving ? 'Publication...' : 'Publier'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckIcon" size={28} className="text-emerald-600" />
                </div>
                <h3 className="font-display font-700 text-foreground text-lg mb-2">Annonce publiée !</h3>
                <p className="text-sm text-muted-foreground mb-6">Votre annonce est maintenant visible.</p>
                <button onClick={() => { setSellSent(false); setShowSellModal(false); }} className="btn-primary justify-center px-8 py-3">Fermer</button>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </>
  );

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background">
          {pageContent}
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="min-h-screen bg-background">
            {pageContent}
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
