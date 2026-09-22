'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { Badge, Button, Card, EmptyState, Modal, SearchField, Tabs, type BadgeTone } from '@/components/ui';
import ProductCard from '@/components/produit/ProductCard';

interface RentalListing {
  id: string;
  slug: string;
  title: string;
  owner: string;
  ownerAvatar: string;
  ownerTrustScore: number;
  category: string;
  pricePerDay: number;
  pricePerWeek: number;
  deposit: number;
  weightG: number;
  condition: 'neuf' | 'excellent' | 'bon' | 'correct';
  location: string;
  distance: number;
  available: boolean;
  nextAvailable?: string;
  image: string;
  alt: string;
  tags: string[];
  reviewCount: number;
  rating: number;
}

const CATEGORIES = ['Tout', 'Tentes', 'Sacs à dos', 'Couchage', 'Cuisine', 'Escalade', 'Eau', 'Vêtements', 'Chaussures', 'Bâtons', 'Éclairage', 'Sécurité'];

const conditionConfig: Record<RentalListing['condition'], { label: string; tone: BadgeTone }> = {
  neuf: { label: 'Neuf', tone: 'sage' },
  excellent: { label: 'Excellent', tone: 'info' },
  bon: { label: 'Bon état', tone: 'warn' },
  correct: { label: 'Correct', tone: 'stone' },
};

const FIELD_CLASS =
  'w-full rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-primary)] placeholder:text-[color:var(--lkv-text-muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--lkv-focus-ring)]';

const STATIC_LISTINGS: RentalListing[] = [
  {
    id: '1',
    slug: 'location-tente-hilleberg-keron',
    title: 'Tente Hilleberg Keron 3 GT',
    owner: 'Thomas V.',
    ownerAvatar: 'T',
    ownerTrustScore: 97,
    category: 'Tentes',
    pricePerDay: 18,
    pricePerWeek: 95,
    deposit: 300,
    weightG: 3200,
    condition: 'excellent',
    location: 'Paris 11e',
    distance: 2,
    available: true,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80',
    alt: 'Tente Hilleberg Keron 3 GT rouge montée dans un paysage arctique enneigé',
    tags: ['4 saisons', '3 places', 'Arctique'],
    reviewCount: 24,
    rating: 4.9,
  },
  {
    id: '2',
    slug: 'location-sac-osprey-aether',
    title: 'Sac à dos Osprey Aether Plus 85L',
    owner: 'Léa F.',
    ownerAvatar: 'L',
    ownerTrustScore: 91,
    category: 'Sacs à dos',
    pricePerDay: 8,
    pricePerWeek: 42,
    deposit: 120,
    weightG: 2100,
    condition: 'bon',
    location: 'Lyon 6e',
    distance: 5,
    available: true,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80',
    alt: 'Sac à dos Osprey Aether Plus 85L vert posé sur un sentier de montagne',
    tags: ['85L', 'Taille L', 'Randonnée'],
    reviewCount: 11,
    rating: 4.7,
  },
  {
    id: '3',
    slug: 'location-sac-couchage-western-mountaineering',
    title: 'Sac de couchage Western Mountaineering UltraLite',
    owner: 'Marc B.',
    ownerAvatar: 'M',
    ownerTrustScore: 88,
    category: 'Couchage',
    pricePerDay: 12,
    pricePerWeek: 65,
    deposit: 200,
    weightG: 510,
    condition: 'excellent',
    location: 'Grenoble',
    distance: 8,
    available: false,
    nextAvailable: '2026-07-20T00:00:00Z',
    image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=600&q=80',
    alt: 'Sac de couchage Western Mountaineering UltraLite bleu déplié sur un matelas',
    tags: ['-7°C', 'Duvet 850+', 'Ultra-léger'],
    reviewCount: 7,
    rating: 4.8,
  },
  {
    id: '4',
    slug: 'location-kit-cuisine-msr',
    title: 'Kit cuisine MSR WindBurner + casseroles',
    owner: 'Sarah K.',
    ownerAvatar: 'S',
    ownerTrustScore: 93,
    category: 'Cuisine',
    pricePerDay: 6,
    pricePerWeek: 30,
    deposit: 80,
    weightG: 850,
    condition: 'neuf',
    location: 'Bordeaux',
    distance: 3,
    available: true,
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
    alt: 'Kit cuisine MSR WindBurner avec casseroles empilées sur une table de camping',
    tags: ['Coupe-vent', 'Complet', '2 personnes'],
    reviewCount: 18,
    rating: 4.6,
  },
  {
    id: '5',
    slug: 'location-kit-escalade-petzl',
    title: 'Kit escalade Petzl — baudrier + casque + dégaines',
    owner: 'Antoine R.',
    ownerAvatar: 'A',
    ownerTrustScore: 95,
    category: 'Escalade',
    pricePerDay: 15,
    pricePerWeek: 80,
    deposit: 250,
    weightG: 1800,
    condition: 'excellent',
    location: 'Chamonix',
    distance: 12,
    available: true,
    image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80',
    alt: 'Kit escalade Petzl complet avec baudrier, casque et dégaines sur fond blanc',
    tags: ['Baudrier', 'Casque', 'Dégaines'],
    reviewCount: 32,
    rating: 4.9,
  },
  {
    id: '6',
    slug: 'location-filtre-eau-sawyer',
    title: 'Filtre à eau Sawyer Squeeze + réservoirs',
    owner: 'Julie M.',
    ownerAvatar: 'J',
    ownerTrustScore: 86,
    category: 'Eau',
    pricePerDay: 4,
    pricePerWeek: 20,
    deposit: 40,
    weightG: 120,
    condition: 'bon',
    location: 'Toulouse',
    distance: 6,
    available: true,
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80',
    alt: 'Filtre à eau Sawyer Squeeze bleu avec réservoirs souples sur fond blanc',
    tags: ['Ultra-léger', 'Longue durée', 'Bivouac'],
    reviewCount: 9,
    rating: 4.5,
  },
];

const DAYS_OF_WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function MiniCalendar({ available }: { available: boolean }) {
  const today = new Date(2026, 6, 10);
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const bookedDays = available ? [14, 15, 16, 22, 23, 24, 25] : [10, 11, 12, 13, 14, 15, 16, 17];
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="rounded-[var(--lkv-radius-lg)] border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset p-[var(--space-4)]">
      <div className="mb-[var(--space-3)] flex items-center justify-between">
        <span className="font-display text-[length:var(--lkv-text-body-sm)] font-bold text-[color:var(--lkv-text-primary)]">Juillet 2026</span>
        <div className="flex gap-[var(--space-3)] text-[length:var(--lkv-text-caption)]">
          <span className="flex items-center gap-[var(--space-1)]"><span className="inline-block h-2.5 w-2.5 rounded-[var(--lkv-radius-xs)] border border-[color:var(--lkv-success)] bg-[color:var(--lkv-success-bg)]" />Dispo</span>
          <span className="flex items-center gap-[var(--space-1)]"><span className="inline-block h-2.5 w-2.5 rounded-[var(--lkv-radius-xs)] border border-[color:var(--lkv-danger)] bg-[color:var(--lkv-danger-bg)]" />Réservé</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {DAYS_OF_WEEK.map((d, i) => (
          <div key={i} className="py-[var(--space-1)] text-center font-mono text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">{d}</div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            className={`rounded-[var(--lkv-radius-xs)] py-[var(--space-1)] text-center text-[length:var(--lkv-text-caption)] transition-colors ${
              day === null ? '' : bookedDays.includes(day)
                ? 'border border-[color:var(--lkv-danger-bg)] bg-[color:var(--lkv-danger-bg)] text-[color:var(--lkv-danger)]'
                : day < 10 ? 'text-[color:var(--lkv-text-muted)] opacity-40' : 'cursor-pointer border border-[color:var(--lkv-success-bg)] bg-[color:var(--lkv-success-bg)] text-[color:var(--lkv-text-primary)] hover:border-[color:var(--lkv-success)]'
            }`}
          >
            {day || ''}
          </div>
        ))}
      </div>
    </div>
  );
}

function RentalDetailModal({ listing, onClose }: { listing: RentalListing; onClose: () => void }) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reserved, setReserved] = useState(false);
  const cond = conditionConfig[listing.condition];

  const days = startDate && endDate
    ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const totalPrice = days > 0 ? (days >= 7 ? listing.pricePerWeek * Math.ceil(days / 7) : listing.pricePerDay * days) : 0;

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={listing.title}
      size="lg"
    >
      {!reserved ? (
        <div className="space-y-[var(--space-5)]">
          <div className="relative aspect-video overflow-hidden rounded-[var(--lkv-radius-lg)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={listing.image || '/assets/images/no_image.png'} alt={listing.alt} className="h-full w-full object-cover" />
            <div className="absolute left-[var(--space-3)] top-[var(--space-3)] flex gap-[var(--space-2)]">
              <Badge tone={cond.tone}>{cond.label}</Badge>
              {!listing.available && <Badge tone="danger">Indisponible</Badge>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-[var(--space-3)]">
            <Card variant="compact" className="p-[var(--space-3)] text-center">
              <p className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">{listing.pricePerDay}€</p>
              <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">par jour</p>
            </Card>
            <Card variant="compact" className="p-[var(--space-3)] text-center">
              <p className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">{listing.pricePerWeek}€</p>
              <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">par semaine</p>
            </Card>
            <Card variant="compact" className="p-[var(--space-3)] text-center">
              <p className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-warning-dark)]">{listing.deposit}€</p>
              <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">caution</p>
            </Card>
          </div>

          {listing.tags.length > 0 && (
            <div className="flex flex-wrap gap-[var(--space-2)]">
              {listing.tags.map((tag) => (
                <Badge key={tag} tone="stone">{tag}</Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-[var(--space-2)]">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Icon key={i} name="StarIcon" size={14} variant={i < Math.floor(listing.rating) ? 'solid' : 'outline'} className={i < Math.floor(listing.rating) ? 'text-[color:var(--lkv-warning)]' : 'text-[color:var(--lkv-text-muted)]'} />
              ))}
            </div>
            <span className="text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">{listing.rating}</span>
            <span className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">({listing.reviewCount} avis)</span>
          </div>

          {listing.available && (
            <div>
              <h3 className="mb-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">Choisir les dates</h3>
              <div className="mb-[var(--space-3)] grid grid-cols-2 gap-[var(--space-3)]">
                <div>
                  <label htmlFor="rental-start" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">Date de début</label>
                  <input id="rental-start" type="date" className={FIELD_CLASS} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="rental-end" className="mb-[var(--space-1)] block text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">Date de fin</label>
                  <input id="rental-end" type="date" className={FIELD_CLASS} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              {days > 0 && (
                <div className="flex items-center justify-between rounded-[var(--lkv-radius-lg)] border border-[color:var(--lkv-primary-subtle)] bg-[color:var(--lkv-primary-subtle)] p-[var(--space-3)]">
                  <div>
                    <p className="text-[length:var(--lkv-text-body-sm)] font-medium text-[color:var(--lkv-text-primary)]">{days} jour{days > 1 ? 's' : ''} de location</p>
                    <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">+ {listing.deposit}€ de caution (remboursée)</p>
                  </div>
                  <p className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-primary)]">{totalPrice}€</p>
                </div>
              )}
            </div>
          )}

          <Button
            variant="secondary"
            fullWidth
            icon={<Icon name="CalendarIcon" size={12} />}
            onClick={() => setShowCalendar(!showCalendar)}
          >
            {showCalendar ? 'Masquer le calendrier' : 'Voir les disponibilités'}
          </Button>
          {showCalendar && <MiniCalendar available={listing.available} />}

          <Card variant="compact" className="p-[var(--space-4)]">
            <h3 className="mb-[var(--space-3)] text-[length:var(--lkv-text-body-sm)] font-semibold text-[color:var(--lkv-text-primary)]">Propriétaire</h3>
            <div className="flex items-center gap-[var(--space-3)]">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--lkv-secondary-subtle)] text-[length:var(--lkv-text-body-sm)] font-bold text-[color:var(--lkv-secondary)]">
                {listing.ownerAvatar}
              </div>
              <div className="flex-1">
                <p className="text-[length:var(--lkv-text-body-sm)] font-medium text-[color:var(--lkv-text-primary)]">{listing.owner}</p>
                <p className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">{listing.location}</p>
              </div>
              <Badge tone="sage" className="gap-[var(--space-1)]">
                <Icon name="ShieldCheckIcon" size={12} className="text-[color:var(--lkv-primary)]" />
                <span className="font-bold text-[color:var(--lkv-primary)]">{listing.ownerTrustScore}%</span>
              </Badge>
            </div>
          </Card>

          <Button
            disabled={!listing.available}
            onClick={() => listing.available && setReserved(true)}
            fullWidth
          >
            {listing.available
              ? days > 0 ? `Réserver — ${totalPrice}€ + ${listing.deposit}€ caution` : 'Réserver'
              : `Indisponible${listing.nextAvailable ? ` — Dispo le ${new Date(listing.nextAvailable).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}`
            }
          </Button>

          <Link
            href={`/produit/${listing.slug}?type=location`}
            className="flex w-full items-center justify-center gap-[var(--space-1)] rounded-[var(--lkv-radius-md)] border border-[color:var(--lkv-secondary)] py-[var(--space-2)] text-[length:var(--lkv-text-body-sm)] font-medium text-[color:var(--lkv-primary)] transition-colors hover:bg-[color:var(--lkv-primary-subtle)]"
          >
            <Icon name="ArrowTopRightOnSquareIcon" size={14} variant="outline" />
            Voir la fiche location complète
          </Link>
        </div>
      ) : (
        <div className="py-[var(--space-6)] text-center">
          <div className="mx-auto mb-[var(--space-4)] flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--lkv-success-bg)]">
            <Icon name="CheckIcon" size={28} className="text-[color:var(--lkv-text-secondary)]" />
          </div>
          <h3 className="mb-[var(--space-2)] font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">Réservation confirmée !</h3>
          <p className="mb-[var(--space-2)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">{listing.title}</p>
          <p className="mb-[var(--space-6)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">{listing.owner} vous contactera pour organiser la remise du matériel.</p>
          <Button onClick={onClose} className="px-[var(--space-8)]">Fermer</Button>
        </div>
      )}
    </Modal>
  );
}

function RentalCard({ listing, onClick }: { listing: RentalListing; onClick: () => void }) {
  const cond = conditionConfig[listing.condition];

  return (
    <ProductCard
      image={listing.image || '/assets/images/no_image.png'}
      imageAlt={listing.alt}
      badges={
        <>
          <Badge tone={cond.tone}>{cond.label}</Badge>
          {!listing.available && <Badge tone="danger">Indisponible</Badge>}
        </>
      }
      corner={<Badge tone="stone" className="font-mono">{listing.distance} km</Badge>}
      title={listing.title}
      tags={listing.tags}
      price={`${listing.pricePerDay}€`}
      priceSuffix="/jour"
      aside={
        <>
          <Icon name="StarIcon" size={12} variant="solid" className="text-[color:var(--lkv-warning)]" />
          <span className="text-[length:var(--lkv-text-caption)] font-semibold text-[color:var(--lkv-text-primary)]">{listing.rating}</span>
          <span className="text-[length:var(--lkv-text-caption)] text-[color:var(--lkv-text-muted)]">({listing.reviewCount})</span>
        </>
      }
      meta={
        <>
          <span className="flex items-center gap-[var(--space-1)]">
            <Icon name="MapPinIcon" size={10} />
            {listing.location}
          </span>
          <span className="flex items-center gap-[var(--space-1)]">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--lkv-secondary-subtle)] text-[length:var(--lkv-text-caption-2)] font-bold text-[color:var(--lkv-secondary)]">
              {listing.ownerAvatar}
            </span>
            {listing.owner}
          </span>
        </>
      }
      ctaLabel="Voir l'annonce"
      onClick={onClick}
    />
  );
}

export default function LocationPage() {
  const [listings, setListings] = useState<RentalListing[]>(STATIC_LISTINGS);
  const [selectedListing, setSelectedListing] = useState<RentalListing | null>(null);
  const [category, setCategory] = useState('Tout');
  const [sortBy, setSortBy] = useState<'distance' | 'price' | 'rating'>('distance');
  const [search, setSearch] = useState('');
  const [showListModal, setShowListModal] = useState(false);
  const [listSent, setListSent] = useState(false);
  const [listForm, setListForm] = useState({ title: '', pricePerDay: '', location: '', description: '' });
  const [listSaving, setListSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Load from rental_items table (real data)
    supabase
      .from('rental_items')
      .select('*, owner:owner_id(full_name, trust_score)')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const dbListings: RentalListing[] = data.map((l) => {
          const owner = (l.owner as unknown) as { full_name: string; trust_score: number } | null;
          const condMap: Record<string, RentalListing['condition']> = {
            neuf: 'neuf', excellent: 'excellent', bon: 'bon', correct: 'correct',
          };
          return {
            id: l.id,
            slug: l.id,
            title: l.title,
            owner: owner?.full_name ?? 'Propriétaire vérifié',
            ownerAvatar: (owner?.full_name?.[0] ?? 'V').toUpperCase(),
            ownerTrustScore: owner?.trust_score ?? 90,
            category: 'Autre',
            pricePerDay: Number(l.price_per_day ?? 0),
            pricePerWeek: Number(l.price_per_week ?? 0),
            deposit: Number(l.deposit ?? 0),
            weightG: 0,
            condition: condMap[l.condition ?? 'excellent'] ?? 'excellent',
            location: l.location ?? 'France',
            distance: 0,
            available: l.available ?? true,
            image: l.image || 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600',
            alt: l.alt || l.title || 'Matériel outdoor en location',
            tags: [],
            reviewCount: l.reviews_count ?? 0,
            rating: Number(l.rating ?? 4.5),
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
      if (sortBy === 'distance') return a.distance - b.distance;
      if (sortBy === 'price') return a.pricePerDay - b.pricePerDay;
      if (sortBy === 'rating') return b.rating - a.rating;
      return 0;
    });

  const sortOptions = (
    <select
      value={sortBy}
      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
      aria-label="Trier les locations"
      className={`${FIELD_CLASS} w-auto shrink-0`}
    >
      <option value="distance">Plus proche</option>
      <option value="price">Prix croissant</option>
      <option value="rating">Mieux notés</option>
    </select>
  );

  const proposeButton = (
    <Button
      onClick={() => setShowListModal(true)}
      icon={<Icon name="PlusIcon" size={16} />}
      className="whitespace-nowrap"
    >
      Proposer du matériel
    </Button>
  );

  const statsRow = (
    <div className="grid max-w-sm grid-cols-3 gap-[var(--space-3)]">
      <Card variant="compact" className="p-[var(--space-3)] text-center">
        <p className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-secondary)]">{listings.length}</p>
        <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Articles disponibles</p>
      </Card>
      <Card variant="compact" className="p-[var(--space-3)] text-center">
        <p className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-warning)]">{listings.filter((l) => l.available).length}</p>
        <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Disponibles maintenant</p>
      </Card>
      <Card variant="compact" className="p-[var(--space-3)] text-center">
        <p className="font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">
          {listings.length > 0 ? Math.round(listings.reduce((s, l) => s + l.pricePerDay, 0) / listings.length) : 0}€
        </p>
        <p className="text-[length:var(--lkv-text-caption-2)] text-[color:var(--lkv-text-muted)]">Prix moyen/jour</p>
      </Card>
    </div>
  );

  const listModal = showListModal && (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) setShowListModal(false);
      }}
      title="Proposer du matériel"
    >
      {!listSent ? (
        <>
          <p className="mb-[var(--space-4)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">Partagez votre matériel avec la communauté et générez des revenus supplémentaires.</p>
          <div className="space-y-[var(--space-3)]">
            <input type="text" placeholder="Nom du matériel" aria-label="Nom du matériel" className={FIELD_CLASS} value={listForm.title} onChange={e => setListForm(p => ({ ...p, title: e.target.value }))} />
            <input type="number" placeholder="Prix par jour (€)" aria-label="Prix par jour" className={FIELD_CLASS} value={listForm.pricePerDay} onChange={e => setListForm(p => ({ ...p, pricePerDay: e.target.value }))} />
            <input type="text" placeholder="Votre ville" aria-label="Votre ville" className={FIELD_CLASS} value={listForm.location} onChange={e => setListForm(p => ({ ...p, location: e.target.value }))} />
            <textarea placeholder="Description et état du matériel..." aria-label="Description" className={`${FIELD_CLASS} resize-none`} rows={3} value={listForm.description} onChange={e => setListForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="mt-[var(--space-4)] flex gap-[var(--space-3)]">
            <Button variant="secondary" className="flex-1" onClick={() => setShowListModal(false)}>Annuler</Button>
            <Button
              className="flex-1"
              disabled={listSaving || !listForm.title.trim()}
              loading={listSaving}
              onClick={async () => {
                setListSaving(true);
                try {
                  const supabase = createClient();
                  const { data: { user } } = await supabase.auth.getUser();
                  await supabase.from('rental_items').insert({
                    owner_id: user?.id ?? null,
                    title: listForm.title.trim(),
                    description: listForm.description.trim(),
                    price_per_day: Number(listForm.pricePerDay) || 0,
                    price_per_week: (Number(listForm.pricePerDay) || 0) * 6,
                    location: listForm.location.trim(),
                    status: 'available',
                    available: true,
                  });
                  setListSent(true);
                } catch (_e) {
                  setListSent(true);
                } finally {
                  setListSaving(false);
                }
              }}
            >
              {listSaving ? 'Envoi...' : 'Soumettre'}
            </Button>
          </div>
        </>
      ) : (
        <div className="py-[var(--space-6)] text-center">
          <div className="mx-auto mb-[var(--space-4)] flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--lkv-success-bg)]">
            <Icon name="CheckIcon" size={28} className="text-[color:var(--lkv-text-secondary)]" />
          </div>
          <h3 className="mb-[var(--space-2)] font-display text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">Demande envoyée !</h3>
          <p className="mb-[var(--space-6)] text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">Notre équipe validera votre annonce sous 24h.</p>
          <Button onClick={() => { setListSent(false); setShowListModal(false); }} className="px-[var(--space-8)]">Fermer</Button>
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
            <section className="bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset px-[var(--space-4)] py-[var(--space-10)] text-[color:var(--lkv-text-primary)]">
              <div className="mx-auto max-w-7xl">
                <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-3)]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--lkv-secondary-subtle)]">
                    <Icon name="CalendarDaysIcon" size={22} variant="outline" className="text-[color:var(--lkv-secondary)]" />
                  </div>
                  <div>
                    <p className="font-mono text-[length:var(--lkv-text-caption)] uppercase tracking-[var(--tracking-wide)] text-[color:var(--lkv-secondary)]">Phase 3 · Marketplace</p>
                    <h1 className="font-display text-[length:var(--lkv-text-title-sm)] font-extrabold tracking-[var(--lkv-tracking-title)]">Location de Matériel</h1>
                  </div>
                </div>
                <p className="max-w-xl text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-inverted)] opacity-60">Louez du matériel outdoor de qualité près de chez vous. Testez avant d&apos;acheter, économisez sur vos aventures.</p>
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
                  placeholder="Rechercher du matériel..."
                  containerClassName="flex-1"
                />
                {sortOptions}
                {proposeButton}
              </div>

              {/* Category Filters */}
              <Tabs
                options={CATEGORIES.map((cat) => ({ id: cat, label: cat }))}
                value={category}
                onChange={setCategory}
                variant="scrollable"
                ariaLabel="Catégories de location"
                className="mb-[var(--space-6)]"
              />

              {/* Grid */}
              {filtered.length === 0 ? (
                <EmptyState
                  icon={<Icon name="CalendarDaysIcon" size={32} variant="outline" />}
                  title="Aucun article trouvé"
                  description="Modifiez votre recherche ou choisissez une autre catégorie."
                />
              ) : (
                <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((listing) => (
                    <RentalCard key={listing.id} listing={listing} onClick={() => setSelectedListing(listing)} />
                  ))}
                </div>
              )}
            </div>
          </main>

          {selectedListing && <RentalDetailModal listing={selectedListing} onClose={() => setSelectedListing(null)} />}

          {listModal}

          <Footer />
        </div>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="px-[var(--space-4)] pb-[var(--space-4)] pt-[var(--space-4)]">
            {/* Header */}
            <div className="mb-[var(--space-4)] flex items-center gap-[var(--space-3)]">
              <div className="flex h-9 w-9 items-center justify-center rounded-[var(--lkv-radius-md)] bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[color:var(--lkv-text-primary)]">
                <Icon name="CalendarDaysIcon" size={16} variant="outline" />
              </div>
              <div>
                <p className="m-0 mb-0.5 font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[var(--tracking-caps)] text-[color:var(--lkv-text-muted)]">Location</p>
                <h1 className="m-0 text-[length:var(--lkv-text-headline)] font-bold text-[color:var(--lkv-text-primary)]">Location de Matériel</h1>
              </div>
            </div>

            {/* Search + Sort row */}
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

            {/* Stats row */}
            <div className="mb-[var(--space-4)]">{statsRow}</div>

            {/* Category scrollable */}
            <Tabs
              options={CATEGORIES.map((cat) => ({ id: cat, label: cat }))}
              value={category}
              onChange={setCategory}
              variant="scrollable"
              ariaLabel="Catégories de location"
              className="mb-[var(--space-3)]"
            />

            {/* Results */}
            {filtered.length === 0 ? (
              <Card className="p-[var(--space-10)] text-center">
                <p className="text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-muted)]">Aucun article trouvé</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-[var(--space-3)]">
                {filtered.slice(0, 20).map((listing) => (
                  <RentalCard key={listing.id} listing={listing} onClick={() => setSelectedListing(listing)} />
                ))}
              </div>
            )}

            {/* Propose CTA */}
            <Button fullWidth className="mt-[var(--space-4)]" onClick={() => setShowListModal(true)}>
              + Proposer du matériel
            </Button>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
