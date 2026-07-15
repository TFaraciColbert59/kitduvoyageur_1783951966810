'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────────────
interface AuctionBid {
  id: string;
  montant_cents: number;
  is_auto_bid: boolean;
  created_at: string;
  bidder_id: string;
}

interface AuctionListing {
  id: string;
  produit_id: string;
  prix_depart_cents: number;
  enchere_actuelle_cents: number;
  increment_min_cents: number;
  date_fin_enchere: string;
  nombre_encherisseurs: number;
  statut: string;
  vendeur_id?: string;
}

interface AuctionZoneProps {
  listing: AuctionListing;
  /** Optional: current user's own bid amount in cents (for "being outbid" detection) */
  onBidPlaced?: (newAmount: number) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (cents: number) =>
  (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

function anonymize(index: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `Utilisateur ${letters[index % letters.length]}`;
}

function useCountdown(endDate: string) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: false });

  useEffect(() => {
    const update = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: true });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        ended: false,
      });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  return timeLeft;
}

// ── Bid History ────────────────────────────────────────────────────────────────
function BidHistory({ listingId, currentUserId }: { listingId: string; currentUserId?: string }) {
  const [bids, setBids] = useState<AuctionBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [bidderMap, setBidderMap] = useState<Record<string, number>>({});

  const fetchBids = useCallback(async () => {
    try {
      const res = await fetch(`/api/auction/bid?listing_id=${listingId}`);
      const data = await res.json();
      const list: AuctionBid[] = data.bids ?? [];
      setBids(list);

      // Build anonymized index map (stable per bidder_id)
      const map: Record<string, number> = {};
      let idx = 0;
      list.forEach((b) => {
        if (!(b.bidder_id in map)) {
          map[b.bidder_id] = idx++;
        }
      });
      setBidderMap(map);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    fetchBids();
    // Poll every 15s for real-time feel without websockets
    const id = setInterval(fetchBids, 15000);
    return () => clearInterval(id);
  }, [fetchBids]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (bids.length === 0) {
    return (
      <div className="text-center py-6">
        <Icon name="BoltIcon" size={28} variant="outline" className="text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Aucune offre pour l&apos;instant.</p>
        <p className="text-xs text-muted-foreground mt-1">Soyez le premier à enchérir !</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
      {bids.map((bid, i) => {
        const isMe = bid.bidder_id === currentUserId;
        const anonName = isMe ? 'Vous' : anonymize(bidderMap[bid.bidder_id] ?? i);
        const isTop = i === 0;

        return (
          <div
            key={bid.id}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
              isTop ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-muted/30'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                isMe ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {isTop ? '🥇' : String(i + 1)}
              </div>
              <div className="min-w-0">
                <span className={`font-medium truncate block ${isMe ? 'text-primary' : 'text-foreground'}`}>
                  {anonName}
                </span>
                {bid.is_auto_bid && (
                  <span className="text-[10px] text-muted-foreground font-mono">enchère auto</span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0 ml-2">
              <p className={`font-mono font-700 text-sm ${isTop ? 'text-orange-400' : 'text-foreground'}`}
                style={{ fontFamily: 'IBM Plex Mono, var(--font-mono), monospace' }}>
                {fmt(bid.montant_cents)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(bid.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Comparable Sales AI Panel ──────────────────────────────────────────────────
function ComparablesSuggestion({ produitId, prixDepartCents }: { produitId: string; prixDepartCents: number }) {
  const [data, setData] = useState<{
    suggestion: { moyenne_cents: number; min_cents: number; max_cents: number; nb_ventes: number } | null;
    alerte: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const fetched = useRef(false);

  const fetch_ = useCallback(async () => {
    if (fetched.current) { setOpen(true); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/auction/comparables?produit_id=${produitId}&prix_depart_cents=${prixDepartCents}`
      );
      const json = await res.json();
      setData(json);
      fetched.current = true;
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [produitId, prixDepartCents]);

  return (
    <div className="topo-card p-4 border-info/20 border">
      <button onClick={fetch_} className="w-full flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2">
          <Icon name="SparklesIcon" size={15} variant="outline" className="text-info flex-shrink-0" />
          <span className="text-sm font-semibold text-foreground">Suggestion de prix IA</span>
        </div>
        <Icon name={open ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={13} variant="outline" className="text-muted-foreground" />
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-border">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-info animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              Analyse des ventes comparables…
            </div>
          ) : !data?.suggestion ? (
            <p className="text-sm text-muted-foreground">
              Aucune vente comparable trouvée pour ce modèle. Le prix de départ est défini par le vendeur.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Min</p>
                  <p className="font-mono text-sm font-700 text-foreground" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                    {fmt(data.suggestion.min_cents)}
                  </p>
                </div>
                <div className="bg-primary/10 rounded-lg p-2 border border-primary/20">
                  <p className="text-xs text-primary mb-0.5">Moyenne</p>
                  <p className="font-mono text-sm font-700 text-primary" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                    {fmt(data.suggestion.moyenne_cents)}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Max</p>
                  <p className="font-mono text-sm font-700 text-foreground" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                    {fmt(data.suggestion.max_cents)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Basé sur {data.suggestion.nb_ventes} vente{data.suggestion.nb_ventes > 1 ? 's' : ''} clôturée{data.suggestion.nb_ventes > 1 ? 's' : ''} pour ce modèle.
              </p>
              {data.alerte && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Icon name="ExclamationTriangleIcon" size={14} variant="outline" className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300 leading-relaxed">{data.alerte}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main AuctionZone Component ─────────────────────────────────────────────────
export default function AuctionZone({ listing, onBidPlaced }: AuctionZoneProps) {
  const { user, profile } = useAuth();
  const supabase = createClient();

  const countdown = useCountdown(listing.date_fin_enchere);
  const isEndingSoon = !countdown.ended && countdown.days === 0 && countdown.hours < 1;
  const isEnded = countdown.ended || listing.statut === 'cloture';

  const [currentBid, setCurrentBid] = useState(listing.enchere_actuelle_cents);
  const [nbBidders, setNbBidders] = useState(listing.nombre_encherisseurs);
  const [offerInput, setOfferInput] = useState('');
  const [autoBidInput, setAutoBidInput] = useState('');
  const [showAutoBid, setShowAutoBid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoBidSubmitting, setAutoBidSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [autoBidFeedback, setAutoBidFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [myBidAmount, setMyBidAmount] = useState<number | null>(null);
  const [outbidAlert, setOutbidAlert] = useState(false);
  const prevBidRef = useRef(currentBid);

  const minNext = currentBid + listing.increment_min_cents;
  const offerValue = parseFloat(offerInput.replace(',', '.')) * 100;
  const offerValid = !isNaN(offerValue) && offerValue >= minNext;

  // Real-time subscription for bid updates
  useEffect(() => {
    const channel = supabase
      .channel(`listing-${listing.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'listings',
          filter: `id=eq.${listing.id}`,
        },
        (payload) => {
          const updated = payload.new as AuctionListing;
          const newBid = updated.enchere_actuelle_cents;
          setCurrentBid(newBid);
          setNbBidders(updated.nombre_encherisseurs);

          // Detect outbid: user had a bid and someone topped it
          if (myBidAmount !== null && newBid > myBidAmount && prevBidRef.current === myBidAmount) {
            setOutbidAlert(true);
            setTimeout(() => setOutbidAlert(false), 8000);
          }
          prevBidRef.current = newBid;
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listing.id, myBidAmount, supabase]);

  const handleBid = useCallback(async () => {
    if (!user) {
      setFeedback({ type: 'error', msg: 'Connectez-vous pour enchérir.' });
      return;
    }
    if (!offerValid) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/auction/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: listing.id,
          montant_cents: Math.round(offerValue),
        }),
      });
      const data = await res.json();

      if (data.success) {
        setMyBidAmount(Math.round(offerValue));
        prevBidRef.current = Math.round(offerValue);
        setOfferInput('');
        setFeedback({ type: 'success', msg: 'Votre enchère a été placée avec succès !' });
        onBidPlaced?.(Math.round(offerValue));
        setTimeout(() => setFeedback(null), 4000);
      } else {
        const errorMessages: Record<string, string> = {
          trust_score_insufficient: `Trust Score insuffisant (requis : ${data.required ?? 40}, le vôtre : ${data.current ?? 0}). Complétez votre profil pour enchérir.`,
          below_minimum: `Montant trop bas. Minimum requis : ${fmt(data.minimum_cents ?? minNext)}.`,
          auction_closed: 'Cette enchère est terminée.',
          cannot_bid_own_listing: 'Vous ne pouvez pas enchérir sur votre propre annonce.',
          non_authentifie: 'Connectez-vous pour enchérir.',
        };
        setFeedback({ type: 'error', msg: errorMessages[data.error] ?? 'Une erreur est survenue.' });
      }
    } catch {
      setFeedback({ type: 'error', msg: 'Erreur réseau. Veuillez réessayer.' });
    } finally {
      setSubmitting(false);
    }
  }, [user, offerValid, offerValue, listing.id, minNext, onBidPlaced]);

  const handleAutoBid = useCallback(async () => {
    if (!user) {
      setAutoBidFeedback({ type: 'error', msg: 'Connectez-vous pour activer l\'enchère automatique.' });
      return;
    }
    const plafond = parseFloat(autoBidInput.replace(',', '.')) * 100;
    if (isNaN(plafond) || plafond <= currentBid) {
      setAutoBidFeedback({ type: 'error', msg: `Le plafond doit être supérieur à l'enchère actuelle (${fmt(currentBid)}).` });
      return;
    }

    setAutoBidSubmitting(true);
    setAutoBidFeedback(null);

    try {
      const res = await fetch('/api/auction/auto-bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: listing.id, plafond_cents: Math.round(plafond) }),
      });
      const data = await res.json();

      if (data.success) {
        setAutoBidInput('');
        setShowAutoBid(false);
        setAutoBidFeedback({ type: 'success', msg: `Enchère automatique activée jusqu'à ${fmt(Math.round(plafond))}.` });
        setTimeout(() => setAutoBidFeedback(null), 5000);
      } else {
        const errorMessages: Record<string, string> = {
          trust_score_insufficient: `Trust Score insuffisant (requis : ${data.required ?? 40}).`,
          plafond_too_low: `Le plafond doit dépasser l'enchère actuelle.`,
          auction_closed: 'Cette enchère est terminée.',
        };
        setAutoBidFeedback({ type: 'error', msg: errorMessages[data.error] ?? 'Erreur lors de l\'activation.' });
      }
    } catch {
      setAutoBidFeedback({ type: 'error', msg: 'Erreur réseau. Veuillez réessayer.' });
    } finally {
      setAutoBidSubmitting(false);
    }
  }, [user, autoBidInput, currentBid, listing.id]);

  // ── Status badge ──────────────────────────────────────────────────────────────
  const isWinner = isEnded && myBidAmount !== null && myBidAmount >= currentBid;
  const isLoser = isEnded && myBidAmount !== null && myBidAmount < currentBid;
  const isOwner = user?.id === listing.vendeur_id;

  const statusBadge = () => {
    if (isOwner) return { label: 'Votre annonce', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
    if (isWinner) return { label: '🏆 Remportée par vous', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
    if (isLoser) return { label: 'Non remportée', cls: 'bg-red-500/15 text-red-400 border-red-500/30' };
    if (isEnded) return { label: 'Enchère terminée', cls: 'bg-muted text-muted-foreground border-border' };
    if (isEndingSoon) return { label: '⚡ Se termine bientôt', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse' };
    return { label: 'Enchère en cours', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
  };

  const badge = statusBadge();

  return (
    <div className="space-y-4">
      {/* Outbid alert */}
      {outbidAlert && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 animate-pulse">
          <Icon name="BellAlertIcon" size={16} variant="outline" className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300 font-medium">Vous avez été dépassé ! Placez une nouvelle enchère.</p>
        </div>
      )}

      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className={`px-3 py-1 rounded-full text-xs font-600 border ${badge.cls}`}>{badge.label}</span>
        {!isEnded && (
          <span className="text-xs text-muted-foreground font-mono" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            {nbBidders} enchérisseur{nbBidders !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Current bid + countdown */}
      <div className={`topo-card p-4 border ${isEndingSoon && !isEnded ? 'border-amber-500/30 bg-amber-500/5' : 'border-orange-500/20'}`}>
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              {isEnded ? 'Enchère finale' : 'Enchère actuelle'}
            </p>
            <p
              className="text-4xl font-700 text-orange-400 leading-none"
              style={{ fontFamily: 'IBM Plex Mono, var(--font-mono), monospace' }}
            >
              {fmt(currentBid)}
            </p>
            <p className="text-xs text-muted-foreground mt-1 font-mono" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
              Départ : {fmt(listing.prix_depart_cents)}
            </p>
          </div>
          {myBidAmount !== null && !isEnded && (
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-0.5">Votre offre</p>
              <p className="font-mono text-sm font-600 text-primary" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                {fmt(myBidAmount)}
              </p>
              {myBidAmount < currentBid && (
                <p className="text-[10px] text-red-400 mt-0.5">Dépassée</p>
              )}
            </div>
          )}
        </div>

        {/* Countdown */}
        {!isEnded ? (
          <div className={`grid grid-cols-4 gap-2 text-center ${isEndingSoon ? 'ring-1 ring-amber-500/30 rounded-xl p-2' : ''}`}>
            {[
              { val: countdown.days, label: 'j' },
              { val: countdown.hours, label: 'h' },
              { val: countdown.minutes, label: 'min' },
              { val: countdown.seconds, label: 's' },
            ].map(({ val, label }) => (
              <div key={label} className={`rounded-lg py-2 ${isEndingSoon ? 'bg-amber-500/10' : 'bg-background'}`}>
                <p
                  className={`font-mono text-xl font-700 ${isEndingSoon ? 'text-amber-400' : 'text-orange-400'}`}
                  style={{ fontFamily: 'IBM Plex Mono, monospace' }}
                >
                  {String(val).padStart(2, '0')}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">{label}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">
              Clôturée le {new Date(listing.date_fin_enchere).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
        )}
      </div>

      {/* Bid form — only when auction is active and user is not the seller */}
      {!isEnded && !isOwner && (
        <div className="space-y-3">
          {/* Trust Score warning for unauthenticated or low-score users */}
          {!user && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/40 border border-border text-sm text-muted-foreground">
              <Icon name="LockClosedIcon" size={14} variant="outline" className="flex-shrink-0" />
              <span>Connectez-vous pour enchérir.</span>
            </div>
          )}
          {user && profile && profile.trust_score < 40 && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
              <Icon name="ShieldExclamationIcon" size={14} variant="outline" className="flex-shrink-0 mt-0.5" />
              <span>Trust Score insuffisant ({profile.trust_score}/40 requis). Complétez votre profil pour enchérir.</span>
            </div>
          )}

          {/* Offer input */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="number"
                value={offerInput}
                onChange={(e) => setOfferInput(e.target.value)}
                placeholder={`Min. ${(minNext / 100).toFixed(0)} €`}
                min={minNext / 100}
                step={listing.increment_min_cents / 100}
                disabled={!user || (profile?.trust_score ?? 0) < 40}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <button
              onClick={handleBid}
              disabled={!offerValid || submitting || !user || (profile?.trust_score ?? 0) < 40}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[110px] justify-center"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Icon name="BoltIcon" size={16} variant="outline" />
              )}
              Enchérir
            </button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Incrément minimum : <span className="font-mono font-600" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{fmt(listing.increment_min_cents)}</span>
          </p>

          {/* Feedback */}
          {feedback && (
            <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-sm ${
              feedback.type === 'success' ?'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' :'bg-red-500/10 border border-red-500/20 text-red-300'
            }`}>
              <Icon
                name={feedback.type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'}
                size={14}
                variant="outline"
                className="flex-shrink-0 mt-0.5"
              />
              {feedback.msg}
            </div>
          )}

          {/* Auto-bid toggle */}
          <button
            onClick={() => setShowAutoBid((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border hover:border-primary/40 text-sm text-muted-foreground hover:text-foreground transition-all"
          >
            <div className="flex items-center gap-2">
              <Icon name="CpuChipIcon" size={15} variant="outline" className="text-primary" />
              <span>Enchère automatique</span>
            </div>
            <Icon name={showAutoBid ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={13} variant="outline" />
          </button>

          {showAutoBid && (
            <div className="topo-card p-4 border-primary/20 border space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Définissez un plafond maximum. Le système enchérira automatiquement pour vous jusqu&apos;à ce montant, par incréments minimaux.
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={autoBidInput}
                  onChange={(e) => setAutoBidInput(e.target.value)}
                  placeholder={`Plafond max (ex: ${((currentBid + listing.increment_min_cents * 5) / 100).toFixed(0)} €)`}
                  min={(currentBid + listing.increment_min_cents) / 100}
                  step={listing.increment_min_cents / 100}
                  disabled={!user || (profile?.trust_score ?? 0) < 40}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                />
                <button
                  onClick={handleAutoBid}
                  disabled={!autoBidInput || autoBidSubmitting || !user || (profile?.trust_score ?? 0) < 40}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {autoBidSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Icon name="CpuChipIcon" size={14} variant="outline" />
                  )}
                  Activer
                </button>
              </div>
              {autoBidFeedback && (
                <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${
                  autoBidFeedback.type === 'success' ?'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' :'bg-red-500/10 border border-red-500/20 text-red-300'
                }`}>
                  <Icon
                    name={autoBidFeedback.type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'}
                    size={12}
                    variant="outline"
                    className="flex-shrink-0 mt-0.5"
                  />
                  {autoBidFeedback.msg}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                <Icon name="ShieldCheckIcon" size={10} variant="outline" className="inline mr-1" />
                Le paiement n&apos;est dû qu&apos;à la clôture de l&apos;enchère gagnante.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Payment notice */}
      {!isEnded && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Icon name="ShieldCheckIcon" size={12} variant="outline" className="text-emerald-400 flex-shrink-0" />
          Paiement uniquement à la clôture de l&apos;enchère gagnante — jamais avant.
        </div>
      )}

      {/* Winner payment CTA */}
      {isWinner && (
        <div className="topo-card p-4 border-emerald-500/30 border bg-emerald-500/5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <div>
              <p className="font-semibold text-emerald-400 text-sm">Félicitations, vous avez remporté cette enchère !</p>
              <p className="text-xs text-muted-foreground">Montant final : {fmt(currentBid)}</p>
            </div>
          </div>
          <button className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all">
            <Icon name="CreditCardIcon" size={16} variant="outline" />
            Procéder au paiement
          </button>
        </div>
      )}

      {/* Bid history */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon name="ClockIcon" size={14} variant="outline" className="text-muted-foreground" />
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
            Historique des enchères
          </p>
        </div>
        <BidHistory listingId={listing.id} currentUserId={user?.id} />
      </div>

      {/* AI comparable sales (for sellers viewing their own listing) */}
      {isOwner && (
        <ComparablesSuggestion
          produitId={listing.produit_id}
          prixDepartCents={listing.prix_depart_cents}
        />
      )}
    </div>
  );
}
