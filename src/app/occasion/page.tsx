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
import { Badge, Button, Card, EmptyState, Modal, SearchField, Tabs, type BadgeTone } from '@/components/ui';
import ProductCard from '@/components/produit/ProductCard';

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

const conditionConfig: Record<OccasionItem['condition'], { label: string; tone: BadgeTone }> = {
  comme_neuf: { label: 'Comme neuf', tone: 'sage' },
  tres_bon: { label: 'Très bon état', tone: 'info' },
  bon: { label: 'Bon état', tone: 'warn' },
  acceptable: { label: 'Acceptable', tone: 'danger' },
};

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

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
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Faire une offre"
    >
      {!sent ? (
        <>
          <Card variant="compact" className="mb-[var(--space-4)] p-[var(--space-3)]">
            <p className="mb-0.5 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">Article</p>
            <p className="text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">{item.title}</p>
            <p className="text-[length:var(--lkv-text-body-sm)] font-bold text-[color:var(--lkv-secondary)]">{item.price} € (prix affiché)</p>
          </Card>
          <div className="mb-[var(--space-4)]">
            <label htmlFor="offer-amount" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption)] font-medium text-[color:var(--lkv-text-muted)]">Votre offre (€)</label>
            <input
              id="offer-amount"
              type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)}
              className={`${FIELD_CLASS} text-[length:var(--lkv-text-headline)] font-bold`}
            />
            <p className="mt-[var(--space-1)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
              Le vendeur pourra accepter ou refuser votre offre en 1 tap.
            </p>
          </div>
          <div className="flex gap-[var(--space-3)]">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={saving || !amount} loading={saving}>
              {saving ? 'Envoi…' : 'Envoyer l\'offre'}
            </Button>
          </div>
        </>
      ) : (
        <div className="py-[var(--space-6)] text-center">
          <div className="mx-auto mb-[var(--space-4)] flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--lkv-surface-muted)]">
            <Icon name="CheckIcon" size={28} className="text-[color:var(--lkv-secondary)]" />
          </div>
          <h3 className="mb-[var(--space-2)] font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">Offre envoyée !</h3>
          <p className="mb-[var(--space-6)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">Le vendeur vous répondra rapidement.</p>
          <Button onClick={onClose} className="px-[var(--space-8)]">Fermer</Button>
        </div>
      )}
    </Modal>
  );
}

// ─── Contact Modal ────────────────────────────────────────────────────────────

function ContactModal({ item, onClose }: { item: OccasionItem; onClose: () => void }) {
  const [message, setMessage] = useState(`Bonjour ${item.seller.split(' ')[0]}, je suis intéressé(e) par votre annonce "${item.title}". Est-il toujours disponible ?`);
  const [sent, setSent] = useState(false);
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Contacter le vendeur"
      description={item.seller}
    >
      {!sent ? (
        <>
          <Card variant="compact" className="mb-[var(--space-4)] p-[var(--space-3)]">
            <p className="mb-[var(--space-1)] text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-muted)]">Annonce</p>
            <p className="text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">{item.title}</p>
            <p className="text-[length:var(--lkv-text-body-sm)] font-bold text-[color:var(--lkv-secondary)]">{item.price}€</p>
          </Card>
          <label htmlFor="contact-message" className="mb-[var(--space-2)] block text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-text-muted)]">Votre message</label>
          <textarea id="contact-message" className={`${FIELD_CLASS} resize-none`} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          <div className="mt-[var(--space-4)] flex gap-[var(--space-3)]">
            <Button variant="secondary" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button className="flex-1" onClick={() => setSent(true)} icon={<Icon name="PaperAirplaneIcon" size={16} />}>
              Envoyer
            </Button>
          </div>
        </>
      ) : (
        <div className="py-[var(--space-6)] text-center">
          <div className="mx-auto mb-[var(--space-4)] flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--lkv-surface-muted)]">
            <Icon name="CheckIcon" size={28} className="text-[color:var(--lkv-secondary)]" />
          </div>
          <h3 className="mb-[var(--space-2)] font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">Message envoyé !</h3>
          <p className="mb-[var(--space-6)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">{item.seller.split(' ')[0]} vous répondra par email.</p>
          <Button onClick={onClose} className="px-[var(--space-8)]">Fermer</Button>
        </div>
      )}
    </Modal>
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
      <Modal
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        title={item.title}
        size="lg"
      >
        <div className="space-y-[var(--space-5)]">
          <div className="relative aspect-video overflow-hidden rounded-[var(--lkv-radius-lg)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image} alt={item.alt} className="h-full w-full object-cover" />
            <div className="absolute left-[var(--space-3)] top-[var(--space-3)] flex gap-[var(--space-2)]">
              <Badge tone={cond.tone}>{cond.label}</Badge>
            </div>
            {discount > 0 && (
              <div className="absolute right-[var(--space-3)] top-[var(--space-3)]">
                <Badge tone="warn"><span className="font-bold">-{discount}%</span></Badge>
              </div>
            )}
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-[var(--space-2)]">
            {isVerifiedPurchase && (
              <Badge tone="info" className="gap-[var(--space-1)]">
                <Icon name="ShieldCheckIcon" size={12} variant="outline" />
                Acheté sur Le Kit du Voyageur
              </Badge>
            )}
            {item.sellerTrustScore >= 90 && (
              <Badge tone="stone" className="gap-[var(--space-1)]">
                <Icon name="StarIcon" size={12} variant="outline" />
                Vendeur de confiance
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between gap-[var(--space-3)]">
            <div>
              <div className="flex items-baseline gap-[var(--space-2)]">
                <span className="font-mono text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-text-primary)]">{item.price}€</span>
                {item.originalPrice > 0 && <span className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)] line-through">{item.originalPrice}€</span>}
              </div>
              {item.negotiable && <p className="mt-0.5 text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-secondary)]">Prix négociable — offres acceptées</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-[var(--space-2)]">
              {item.negotiable && (
                <Button variant="secondary" onClick={() => setShowOffer(true)} icon={<Icon name="ChatBubbleLeftRightIcon" size={16} variant="outline" />}>
                  Faire une offre
                </Button>
              )}
              <Button onClick={() => setShowContact(true)} icon={<Icon name="ChatBubbleLeftIcon" size={16} variant="outline" />}>
                Contacter
              </Button>
            </div>
          </div>

          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-[var(--space-2)]">
              {item.tags.map((tag) => (
                <Badge key={tag} tone="stone">{tag}</Badge>
              ))}
            </div>
          )}

          <div>
            <h3 className="mb-[var(--space-2)] text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">Description</h3>
            <p className="text-[length:var(--lkv-text-body-sm)] leading-[var(--leading-relaxed)] text-[color:var(--lkv-text-muted)]">{item.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-[var(--space-3)]">
            {[
              { label: 'Marque', value: item.brand },
              { label: "Année d'achat", value: item.purchaseYear },
              { label: 'Poids', value: item.weight },
              { label: 'Dimensions', value: item.dimensions },
              { label: 'Livraison', value: item.shippingAvailable ? `Disponible${item.shippingCost ? ` (${item.shippingCost}€)` : ''}` : 'Remise en main propre' },
              { label: 'Localisation', value: item.location },
            ].filter((d) => d.value).map((detail) => (
              <Card key={detail.label} variant="compact" className="p-[var(--space-3)]">
                <p className="mb-0.5 text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{detail.label}</p>
                <p className="text-[length:var(--lkv-text-body-sm)] font-medium text-[color:var(--lkv-text-primary)]">{detail.value}</p>
              </Card>
            ))}
          </div>

          <Card variant="compact" className="p-[var(--space-4)]">
            <h3 className="mb-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">Vendeur</h3>
            <div className="flex items-center gap-[var(--space-3)]">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--lkv-secondary-subtle)] text-[length:var(--lkv-text-body-sm)] font-bold text-[color:var(--lkv-secondary)]">
                {item.sellerAvatar}
              </div>
              <div className="flex-1">
                <p className="text-[length:var(--lkv-text-body-sm)] font-medium text-[color:var(--lkv-text-primary)]">{item.seller}</p>
                <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">{item.sellerSales} ventes · {item.location}</p>
              </div>
              <div className="text-right">
                <p className="text-[length:var(--lkv-text-body-sm)] font-bold text-[color:var(--lkv-text-primary)]">{item.sellerTrustScore}%</p>
                <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Fiabilité</p>
              </div>
            </div>
          </Card>

          {/* F6/F7: Confirm receipt button (shown to logged-in buyers) */}
          {user && user.id !== item.sellerId && (
            <Card tone="sage" className="p-[var(--space-4)]">
              {receiptConfirmed ? (
                <div className="flex items-center gap-[var(--space-3)]">
                  <Icon name="CheckCircleIcon" size={20} variant="outline" className="flex-shrink-0 text-[color:var(--lkv-secondary)]" />
                  <div>
                    <p className="text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">Réception confirmée !</p>
                    <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">L&apos;article a été ajouté à votre inventaire. Le vendeur sera payé dans 48h.</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="mb-[var(--space-1)] text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">Avez-vous reçu cet article ?</p>
                  <p className="mb-[var(--space-3)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">
                    En confirmant la réception, l&apos;article sera ajouté à votre inventaire et le vendeur sera payé dans 48h.
                  </p>
                  <Button
                    onClick={handleConfirmReceipt}
                    disabled={confirmingReceipt}
                    loading={confirmingReceipt}
                    fullWidth
                    icon={<Icon name="CheckCircleIcon" size={16} variant="outline" />}
                  >
                    {confirmingReceipt ? 'Confirmation…' : 'Confirmer la réception'}
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </Modal>
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

  const sortOptions = (
    <select
      value={sortBy}
      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
      aria-label="Trier les annonces"
      className={`${FIELD_CLASS} w-auto shrink-0`}
    >
      <option value="recent">Plus récents</option>
      <option value="price_asc">Prix croissant</option>
      <option value="price_desc">Prix décroissant</option>
      <option value="discount">Meilleures remises</option>
    </select>
  );

  const sellButton = (
    <Button
      onClick={() => setShowSellModal(true)}
      icon={<Icon name="PlusIcon" size={16} />}
      className="whitespace-nowrap"
    >
      Vendre un article
    </Button>
  );

  const statsRow = (
    <div className="grid max-w-sm grid-cols-3 gap-[var(--space-3)]">
      <Card variant="compact" className="p-[var(--space-3)] text-center">
        <p className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-secondary)]">{listings.length}</p>
        <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Annonces actives</p>
      </Card>
      <Card variant="compact" className="p-[var(--space-3)] text-center">
        <p className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-warning)]">
          {listings.filter((l) => l.condition === 'comme_neuf' || l.condition === 'tres_bon').length}
        </p>
        <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Très bon état</p>
      </Card>
      <Card variant="compact" className="p-[var(--space-3)] text-center">
        <p className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">{listings.filter((l) => l.negotiable).length}</p>
        <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Négociables</p>
      </Card>
    </div>
  );

  const sellModal = showSellModal && (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) setShowSellModal(false);
      }}
      title="Vendre un article"
    >
      {!sellSent ? (
        <>
          {user && (
            <div className="mb-[var(--space-4)] flex items-center gap-[var(--space-2)] rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-info-bg)] bg-[color:var(--lkv-info-bg)] p-[var(--space-3)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-info)]">
              <Icon name="LightBulbIcon" size={14} variant="outline" />
              Astuce : vendez directement depuis votre{' '}
              <Link href="/compte" className="font-semibold underline" onClick={() => setShowSellModal(false)}>compte</Link>
              {' '}pour un prix suggéré automatique.
            </div>
          )}
          <div className="space-y-[var(--space-3)]">
            <input type="text" placeholder="Titre de l'annonce" aria-label="Titre de l'annonce" className={FIELD_CLASS} value={sellForm.title} onChange={e => setSellForm(p => ({ ...p, title: e.target.value }))} />
            <input type="number" placeholder="Prix (€)" aria-label="Prix" className={FIELD_CLASS} value={sellForm.price} onChange={e => setSellForm(p => ({ ...p, price: e.target.value }))} />
            <textarea placeholder="Description de l'article..." aria-label="Description" className={`${FIELD_CLASS} resize-none`} rows={3} value={sellForm.description} onChange={e => setSellForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="mt-[var(--space-4)] flex gap-[var(--space-3)]">
            <Button variant="secondary" className="flex-1" onClick={() => setShowSellModal(false)}>Annuler</Button>
            <Button
              className="flex-1"
              disabled={sellSaving || !sellForm.title.trim()}
              loading={sellSaving}
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
            >
              {sellSaving ? 'Publication...' : 'Publier'}
            </Button>
          </div>
        </>
      ) : (
        <div className="py-[var(--space-6)] text-center">
          <div className="mx-auto mb-[var(--space-4)] flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--lkv-success-bg)]">
            <Icon name="CheckIcon" size={28} className="text-[color:var(--lkv-text-secondary)]" />
          </div>
          <h3 className="mb-[var(--space-2)] font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">Annonce publiée !</h3>
          <p className="mb-[var(--space-6)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">Votre annonce est maintenant visible.</p>
          <Button onClick={() => { setSellSent(false); setShowSellModal(false); }} className="px-[var(--space-8)]">Fermer</Button>
        </div>
      )}
    </Modal>
  );

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-transparent">
          <Header />
          <main className="pt-20">
            {/* Hero */}
            <section className="bg-[color:var(--lkv-primary)] px-[var(--space-4)] py-[var(--space-10)] text-[color:var(--lkv-text-inverted)]">
              <div className="mx-auto max-w-7xl">
                <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-3)]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-secondary-subtle)]">
                    <Icon name="TagIcon" size={22} variant="outline" className="text-[color:var(--lkv-secondary)]" />
                  </div>
                  <div>
                    <p className="font-mono text-[length:var(--lkv-text-caption)] uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-secondary)]">Marketplace · Seconde main</p>
                    <h1 className="font-display text-[length:var(--lkv-text-title-sm)] font-extrabold tracking-[var(--lkv-tracking-title)]">Matériel d&apos;Occasion</h1>
                  </div>
                </div>
                <p className="max-w-xl text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-inverted)] opacity-60">Achetez et vendez du matériel outdoor de seconde main. Offres directes, sans enchères.</p>
                <div className="mt-[var(--space-4)]">{statsRow}</div>
              </div>
            </section>

            <div className="mx-auto max-w-7xl px-[var(--space-4)] py-[var(--space-8)]">
              {/* Search & Filters */}
              <div className="mb-[var(--space-6)] flex flex-col gap-[var(--space-3)] sm:flex-row">
                <SearchField
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch('')}
                  placeholder="Rechercher un article..."
                  containerClassName="flex-1"
                />
                {sortOptions}
                {sellButton}
                {user && (
                  <Link
                    href="/compte"
                    className="inline-flex min-h-[var(--control-height-md)] items-center gap-[var(--space-2)] whitespace-nowrap rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-4)] text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--card-content)] transition-colors hover:bg-[color:var(--lkv-hover-surface)]"
                  >
                    <Icon name="ArchiveBoxIcon" size={16} variant="outline" />
                    Depuis mon compte
                  </Link>
                )}
              </div>

              {/* Category Filters */}
              <Tabs
                options={CATEGORIES.map((cat) => ({ id: cat, label: cat }))}
                value={category}
                onChange={setCategory}
                variant="scrollable"
                ariaLabel="Catégories d'occasion"
                className="mb-[var(--space-6)]"
              />

              {/* Grid */}
              {filtered.length === 0 ? (
                <EmptyState
                  icon={<Icon name="TagIcon" size={32} variant="outline" />}
                  title="Aucune annonce trouvée"
                  description="Modifiez votre recherche ou choisissez une autre catégorie."
                />
              ) : (
                <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((item) => {
                    const cond = conditionConfig[item.condition];
                    const discount = item.originalPrice > 0 ? Math.round((1 - item.price / item.originalPrice) * 100) : 0;
                    const isVerifiedPurchase = item.gearItemSource === 'achat' || item.gearItemSource === 'kit';
                    return (
                      <ProductCard
                        key={item.id}
                        image={item.image}
                        imageAlt={item.alt}
                        badges={
                          <>
                            <Badge tone={cond.tone}>{cond.label}</Badge>
                            {isVerifiedPurchase && (
                              <Badge tone="info" className="gap-[var(--space-1)]">
                                <Icon name="ShieldCheckIcon" size={10} variant="outline" />
                                Acheté sur Le Kit du Voyageur
                              </Badge>
                            )}
                          </>
                        }
                        corner={discount > 0 ? <Badge tone="warn"><span className="font-bold">-{discount}%</span></Badge> : undefined}
                        title={item.title}
                        secondary={item.description}
                        tags={item.tags}
                        price={`${item.price}€`}
                        aside={
                          <>
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--lkv-primary-subtle)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-primary)]">
                              {item.sellerAvatar}
                            </span>
                            <span className="text-right">
                              <span className="block text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">{item.seller}</span>
                              <span className="block text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{item.sellerTrustScore}% fiabilité</span>
                            </span>
                          </>
                        }
                        meta={
                          <>
                            <span className="flex items-center gap-[var(--space-1)]">
                              <Icon name="MapPinIcon" size={10} />
                              {item.location}
                            </span>
                            {item.negotiable && (
                              <span className="flex items-center gap-[var(--space-1)] font-medium text-[color:var(--lkv-success)]">
                                <Icon name="ChatBubbleLeftRightIcon" size={10} variant="outline" />
                                Offres acceptées
                              </span>
                            )}
                          </>
                        }
                        ctaLabel="Voir l'annonce"
                        onClick={() => setSelectedItem(item)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </main>

          {selectedItem && <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}

          {sellModal}

          <Footer />
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="min-h-screen bg-transparent">
            <div className="px-[var(--space-4)] pb-[var(--space-4)] pt-[var(--space-4)]">
              <div className="mb-[var(--space-4)] flex items-center gap-[var(--space-3)]">
                <div className="flex h-9 w-9 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-primary)] text-[color:var(--lkv-text-inverted)]">
                  <Icon name="TagIcon" size={16} variant="outline" />
                </div>
                <div>
                  <p className="m-0 mb-0.5 font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-caps)] text-[color:var(--lkv-text-muted)]">Occasion</p>
                  <h1 className="m-0 text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">Matériel d&apos;Occasion</h1>
                </div>
              </div>

              <div className="mb-[var(--space-4)] flex gap-[var(--space-2)]">
                <SearchField
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClear={() => setSearch('')}
                  placeholder="Rechercher..."
                  containerClassName="flex-1"
                />
                {sortOptions}
              </div>

              <div className="mb-[var(--space-4)]">{statsRow}</div>

              <Tabs
                options={CATEGORIES.map((cat) => ({ id: cat, label: cat }))}
                value={category}
                onChange={setCategory}
                variant="scrollable"
                ariaLabel="Catégories d'occasion"
                className="mb-[var(--space-3)]"
              />

              {filtered.length === 0 ? (
                <Card className="p-[var(--space-10)] text-center">
                  <p className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">Aucune annonce trouvée</p>
                </Card>
              ) : (
                <div className="flex flex-col gap-[var(--space-3)]">
                  {filtered.map((item) => {
                    const cond = conditionConfig[item.condition];
                    const discount = item.originalPrice > 0 ? Math.round((1 - item.price / item.originalPrice) * 100) : 0;
                    const isVerifiedPurchase = item.gearItemSource === 'achat' || item.gearItemSource === 'kit';
                    return (
                      <ProductCard
                        key={item.id}
                        image={item.image}
                        imageAlt={item.alt}
                        badges={
                          <>
                            <Badge tone={cond.tone}>{cond.label}</Badge>
                            {isVerifiedPurchase && (
                              <Badge tone="info" className="gap-[var(--space-1)]">
                                <Icon name="ShieldCheckIcon" size={10} variant="outline" />
                                Acheté sur Le Kit du Voyageur
                              </Badge>
                            )}
                          </>
                        }
                        corner={discount > 0 ? <Badge tone="warn"><span className="font-bold">-{discount}%</span></Badge> : undefined}
                        title={item.title}
                        secondary={item.description}
                        tags={item.tags}
                        price={`${item.price}€`}
                        aside={
                          <>
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--lkv-primary-subtle)] text-[length:var(--lkv-text-caption)] font-bold text-[color:var(--lkv-primary)]">
                              {item.sellerAvatar}
                            </span>
                            <span className="text-right">
                              <span className="block text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">{item.seller}</span>
                              <span className="block text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{item.sellerTrustScore}% fiabilité</span>
                            </span>
                          </>
                        }
                        meta={
                          <>
                            <span className="flex items-center gap-[var(--space-1)]">
                              <Icon name="MapPinIcon" size={10} />
                              {item.location}
                            </span>
                            {item.negotiable && (
                              <span className="flex items-center gap-[var(--space-1)] font-medium text-[color:var(--lkv-success)]">
                                <Icon name="ChatBubbleLeftRightIcon" size={10} variant="outline" />
                                Offres acceptées
                              </span>
                            )}
                          </>
                        }
                        ctaLabel="Voir l'annonce"
                        onClick={() => setSelectedItem(item)}
                      />
                    );
                  })}
                </div>
              )}

              <Button fullWidth className="mt-[var(--space-4)]" onClick={() => setShowSellModal(true)}>
                + Vendre un article
              </Button>
            </div>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
