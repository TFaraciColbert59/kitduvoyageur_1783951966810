'use client';

import { useState } from 'react';
import {
  Building2,
  CalendarDays,
  CarFront,
  Check,
  CircleAlert,
  ExternalLink,
  Loader2,
  Plane,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Ticket,
  Users,
} from 'lucide-react';
import type {
  BookingCandidate,
  BookingSearchResult,
  BookingVertical,
} from '@/features/booking/server/bookingProviderTypes';
import { buildBookingRequest } from '../engine/bookingSearch';
import {
  addOfferToTripCart,
  BookingCartFlowError,
  type BookingCartTransport,
} from '../engine/bookingCartFlow';

interface Props {
  tripId: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
}

type VerticalState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  result: BookingSearchResult | null;
  error: string | null;
};

type SaveState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string | null;
};

const EMPTY_STATE: VerticalState = { status: 'idle', result: null, error: null };
const EMPTY_SAVE_STATE: SaveState = { status: 'idle', message: null };

const VERTICALS: ReadonlyArray<{
  id: BookingVertical;
  label: string;
  icon: typeof Plane;
}> = [
  { id: 'hotel', label: 'Hôtels', icon: Building2 },
  { id: 'flight', label: 'Vols', icon: Plane },
  { id: 'car', label: 'Voiture', icon: CarFront },
  { id: 'activity', label: 'Activités', icon: Ticket },
];

function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function money(amount: number | null, currency: string | null): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency ?? 'EUR',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString('fr-FR')} ${currency ?? ''}`.trim();
  }
}

function offerKey(offer: BookingCandidate): string {
  return `${offer.provider}:${offer.id}`;
}

function saveErrorMessage(error: unknown): string {
  if (error instanceof BookingCartFlowError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Ajout au panier impossible.';
}

export function BookingSearchPanel({ tripId, destination, startDate, endDate }: Props) {
  const [origin, setOrigin] = useState('');
  const [formDestination, setFormDestination] = useState(destination ?? '');
  const [formStart, setFormStart] = useState(startDate ?? '');
  const [formEnd, setFormEnd] = useState(endDate ?? '');
  const [travelers, setTravelers] = useState(1);
  const [states, setStates] = useState<Record<BookingVertical, VerticalState>>({
    hotel: EMPTY_STATE,
    flight: EMPTY_STATE,
    car: EMPTY_STATE,
    activity: EMPTY_STATE,
  });
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  async function search(vertical: BookingVertical) {
    const built = buildBookingRequest(vertical, {
      origin,
      destination: formDestination,
      startDate: formStart,
      endDate: formEnd,
      travelers,
    });
    if (!built.request) {
      setStates((current) => ({ ...current, [vertical]: { status: 'error', result: null, error: built.error } }));
      return;
    }
    setStates((current) => ({ ...current, [vertical]: { status: 'loading', result: null, error: null } }));
    try {
      const response = await fetch('/api/booking/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(built.request),
        cache: 'no-store',
      });
      const payload = (await response.json()) as {
        success?: boolean;
        data?: BookingSearchResult;
        error?: string;
      };
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error === 'rate_limited' ? 'Trop de recherches. Réessaie dans quelques minutes.' : 'Recherche indisponible.');
      }
      setStates((current) => ({ ...current, [vertical]: { status: 'success', result: payload.data ?? null, error: null } }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Recherche indisponible.';
      setStates((current) => ({ ...current, [vertical]: { status: 'error', result: null, error: message } }));
    }
  }

  async function saveOffer(offer: BookingCandidate) {
    const key = offerKey(offer);
    if (saveStates[key]?.status === 'loading') return;
    setSaveStates((current) => ({ ...current, [key]: { status: 'loading', message: null } }));
    try {
      const transport: BookingCartTransport = (url, init) => fetch(url, init);
      const result = await addOfferToTripCart({ tripId, offer, transport });
      setSaveStates((current) => ({
        ...current,
        [key]: {
          status: 'success',
          message: result.deduplicated ? 'Déjà dans le panier' : 'Ajouté au panier',
        },
      }));
    } catch (error) {
      setSaveStates((current) => ({
        ...current,
        [key]: { status: 'error', message: saveErrorMessage(error) },
      }));
    }
  }

  return (
    <section className="preparator__booking" aria-label="Réservations du voyage" data-trip-id={tripId}>
      <div className="glass preparator__booking-form">
        <div className="preparator__booking-fields">
          <label className="preparator__field">
            <span><Plane size={12} aria-hidden="true" /> Départ</span>
            <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Paris" maxLength={120} />
          </label>
          <label className="preparator__field">
            <span><Search size={12} aria-hidden="true" /> Destination</span>
            <input value={formDestination} onChange={(event) => setFormDestination(event.target.value)} placeholder="Lyon" maxLength={120} />
          </label>
          <label className="preparator__field">
            <span><CalendarDays size={12} aria-hidden="true" /> Début</span>
            <input type="date" value={formStart} onChange={(event) => setFormStart(event.target.value)} />
          </label>
          <label className="preparator__field">
            <span><CalendarDays size={12} aria-hidden="true" /> Fin</span>
            <input type="date" value={formEnd} onChange={(event) => setFormEnd(event.target.value)} />
          </label>
          <label className="preparator__field preparator__field--compact">
            <span><Users size={12} aria-hidden="true" /> Voyageurs</span>
            <input type="number" min={1} max={20} value={travelers} onChange={(event) => setTravelers(Number(event.target.value))} />
          </label>
        </div>
        <p className="preparator__booking-note">
          Les montants sont des candidats de recherche. Ils doivent être revalidés chez le partenaire avant toute réservation.
        </p>
      </div>

      <div className="preparator__booking-grid">
        {VERTICALS.map(({ id, label, icon: Icon }) => {
          const state = states[id];
          return (
            <article key={id} className="glass preparator__booking-card">
              <header className="preparator__booking-head">
                <span className="preparator__booking-title"><Icon size={14} aria-hidden="true" /> {label}</span>
                <button type="button" className="glass-icon-btn" onClick={() => void search(id)} disabled={state.status === 'loading'} aria-label={`Rechercher des ${label.toLowerCase()}`}>
                  {state.status === 'loading' ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
                </button>
              </header>
              {state.status === 'idle' ? <p className="preparator__booking-empty">Lancez une recherche avec les dates du voyage.</p> : null}
              {state.status === 'loading' ? <p className="preparator__booking-empty"><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Recherche en cours…</p> : null}
              {state.status === 'error' ? <p className="preparator__booking-error"><CircleAlert size={13} aria-hidden="true" /> {state.error}</p> : null}
              {state.status === 'success' ? (
                <div className="preparator__booking-results">
                  {state.result?.offers.length ? state.result.offers.map((offer) => {
                    const key = offerKey(offer);
                    return (
                      <Offer
                        key={key}
                        offer={offer}
                        saveState={saveStates[key] ?? EMPTY_SAVE_STATE}
                        onSave={() => void saveOffer(offer)}
                      />
                    );
                  }) : <p className="preparator__booking-empty">Aucun candidat pour cette recherche.</p>}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Offer({
  offer,
  saveState,
  onSave,
}: {
  offer: BookingCandidate;
  saveState: SaveState;
  onSave: () => void;
}) {
  const url = safeExternalUrl(offer.deeplink);
  const price = money(offer.amount, offer.currency);
  const isLoading = saveState.status === 'loading';
  const isSuccess = saveState.status === 'success';
  return (
    <div className="preparator__offer">
      <div className="min-w-0 flex-1">
        <p className="preparator__offer-title">{offer.title}</p>
        {offer.description ? <p className="preparator__offer-sub">{offer.description}</p> : null}
        <p className="preparator__offer-meta">
          {price ? <span>{price}</span> : <span>Prix indisponible</span>}
          {offer.requiresRevalidation ? <span className="preparator__badge">À revalider</span> : null}
        </p>
      </div>
      <div className="preparator__offer-actions">
        <button
          type="button"
          className="glass-icon-btn"
          onClick={onSave}
          disabled={isLoading || isSuccess}
          aria-label={isSuccess ? `${offer.title} est dans le panier` : `Ajouter ${offer.title} au panier`}
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : isSuccess ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
        </button>
        {url ? <a className="glass-icon-btn" href={url} target="_blank" rel="noreferrer noopener" aria-label={`Ouvrir ${offer.title} chez le partenaire`}><ExternalLink size={14} aria-hidden="true" /></a> : null}
      </div>
      {saveState.message ? (
        <p className={saveState.status === 'error' ? 'preparator__offer-save preparator__offer-save--error' : 'preparator__offer-save'} aria-live="polite">
          {saveState.status === 'error' ? <CircleAlert size={12} aria-hidden="true" /> : <ShoppingBag size={12} aria-hidden="true" />}
          {saveState.message}
        </p>
      ) : null}
    </div>
  );
}
