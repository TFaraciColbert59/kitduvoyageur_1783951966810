'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Card } from '@/components/ui';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AppShell from '@/components/shell/AppShell';
import { messagingService } from '@/features/messaging/services/messagingService';
import type { MarketplaceListing, MarketplaceMode, MarketplaceReview } from '../types';
import { FIELD, Feedback, ManualNotice, SignIn, money, request } from './shared';

function Listing({ listing }: { listing: MarketplaceListing }) {
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [reviews, setReviews] = useState<MarketplaceReview[]>([]);
  const [dates, setDates] = useState({ start_date: '', end_date: '' });
  const [reason, setReason] = useState('');
  const next = listing.mode === 'vente' ? '/occasion' : '/location';
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Service indisponible.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card as="article" className="space-y-4">
      <div>
        <p className="text-sm">
          {listing.mode === 'vente' ? 'Vente' : listing.mode === 'pret' ? 'Prêt' : 'Location'} ·{' '}
          {listing.public_location}
        </p>
        <h2 className="text-xl font-semibold">{listing.name}</h2>
        <p>
          {listing.brand} {listing.condition && `· ${listing.condition}`}
        </p>
      </div>
      <p className="whitespace-pre-wrap break-words">{listing.description}</p>
      <p className="font-semibold">
        {listing.mode === 'pret' ? 'Prêt gratuit' : money(listing.price_cents)}
        {listing.mode === 'location' ? ' / jour' : ''}
      </p>
      {listing.mode !== 'vente' && (
        <p className="text-sm">
          Caution convenue : {money(listing.deposit_cents)} — gestion manuelle.
        </p>
      )}
      {!user ? (
        <SignIn next={next} />
      ) : user.id === listing.owner_id ? (
        <Link
          className="underline min-h-11 inline-flex items-center"
          href="/hub/inventaire#marketplace"
        >
          Gérer mon annonce
        </Link>
      ) : (
        <>
          {listing.mode !== 'vente' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Début
                <input
                  className={FIELD}
                  aria-label="Début"
                  type="date"
                  value={dates.start_date}
                  onChange={(e) => setDates({ ...dates, start_date: e.target.value })}
                />
              </label>
              <label>
                Fin
                <input
                  className={FIELD}
                  aria-label="Fin"
                  type="date"
                  min={dates.start_date}
                  value={dates.end_date}
                  onChange={(e) => setDates({ ...dates, end_date: e.target.value })}
                />
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              loading={busy}
              onClick={() =>
                run(async () => {
                  if (
                    listing.mode !== 'vente' &&
                    (!dates.start_date || !dates.end_date || dates.end_date < dates.start_date)
                  )
                    throw new Error('Choisissez une période valide.');
                  const result = await request<{ transaction: { id: string } }>(
                    '/api/marketplace/transactions',
                    { listing_id: listing.id, ...(listing.mode !== 'vente' ? dates : {}) }
                  );
                  if (!result.transaction?.id)
                    throw new Error('Demande non confirmée par le serveur.');
                  setMessage('Demande enregistrée. Retrouvez son suivi dans votre inventaire.');
                })
              }
            >
              Demander{' '}
              {listing.mode === 'vente'
                ? 'l’achat'
                : listing.mode === 'pret'
                  ? 'le prêt'
                  : 'la location'}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const id = await messagingService.getOrCreateDirectConversation(
                    listing.owner_id,
                    user.id
                  );
                  if (!id) throw new Error('Discussion indisponible.');
                  router.push(`/messagerie?conversation=${encodeURIComponent(id)}`);
                })
              }
            >
              Contacter le propriétaire
            </Button>
          </div>
        </>
      )}
      <details
        onToggle={(e) => {
          if (e.currentTarget.open && !expanded) {
            void run(async () => {
              const data = await request<{ reviews: MarketplaceReview[] }>(
                `/api/marketplace/reviews?listing_id=${listing.id}`
              );
              setReviews(data.reviews.filter((review) => review.subject_id === listing.owner_id));
              setExpanded(true);
            });
          }
        }}
      >
        <summary className="min-h-11 cursor-pointer py-3">
          Avis sur le propriétaire et signalement
        </summary>
        <div className="space-y-3 pt-2">
          {!expanded ? (
            <p>Ouvrez à nouveau cette section pour réessayer le chargement des avis.</p>
          ) : reviews.length === 0 ? (
            <p>Aucun avis de transaction terminée.</p>
          ) : (
            reviews.map((review) => (
              <p key={review.id}>
                {review.rating}/5 · {review.comment}
              </p>
            ))
          )}
          {user && (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const data = await request<{ report: { id: string } }>(
                    '/api/marketplace/reports',
                    { listing_id: listing.id, reason }
                  );
                  if (!data.report?.id) throw new Error('Signalement non confirmé.');
                  setReason('');
                  setMessage('Signalement enregistré pour examen.');
                });
              }}
            >
              <label>
                Motif du signalement
                <textarea
                  className={FIELD}
                  required
                  minLength={10}
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <Button variant="secondary" type="submit" loading={busy}>
                Envoyer le signalement
              </Button>
            </form>
          )}
        </div>
      </details>
      <Feedback error={error} message={message} />
    </Card>
  );
}
export function MarketplaceBrowser({ initialMode }: { initialMode: MarketplaceMode }) {
  const [mode, setMode] = useState(initialMode);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    request<{ listings: MarketplaceListing[] }>(`/api/marketplace/listings?mode=${mode}`)
      .then((data) => {
        if (active) setListings(data.listings);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, revision]);
  const filtered = listings.filter((i) =>
    `${i.name} ${i.public_location} ${i.category}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase())
  );
  return (
    <AppShell header={<Header />}>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-[color:var(--glass-label)]">
        <h1 className="text-3xl font-semibold">
          {initialMode === 'vente' ? 'Matériel d’occasion' : 'Location et prêt de matériel'}
        </h1>
        <ManualNotice />
        <div className="flex flex-wrap gap-4">
          <Link
            className="min-h-11 inline-flex items-center underline"
            href="/hub/inventaire#marketplace"
          >
            Publier depuis mon inventaire
          </Link>
          <Link
            className="min-h-11 inline-flex items-center underline"
            href={initialMode === 'vente' ? '/location' : '/occasion'}
          >
            {initialMode === 'vente' ? 'Locations et prêts' : 'Ventes d’occasion'}
          </Link>
        </div>
        {initialMode !== 'vente' && (
          <label>
            Type d’annonce
            <select
              className={FIELD}
              value={mode}
              onChange={(e) => setMode(e.target.value as MarketplaceMode)}
            >
              <option value="location">Location</option>
              <option value="pret">Prêt</option>
            </select>
          </label>
        )}
        <label className="block">
          Rechercher un objet ou une commune
          <input
            className={FIELD}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Feedback error={error} />
        {error && (
          <Button variant="secondary" onClick={() => setRevision((v) => v + 1)}>
            Réessayer
          </Button>
        )}
        {loading ? (
          <p role="status">Chargement des annonces…</p>
        ) : !error && filtered.length === 0 ? (
          <Card>Aucune annonce disponible pour cette recherche.</Card>
        ) : (
          !error && (
            <div className="grid gap-5 lg:grid-cols-2">
              {filtered.map((listing) => (
                <Listing key={listing.id} listing={listing} />
              ))}
            </div>
          )
        )}
      </main>
      <Footer />
    </AppShell>
  );
}
