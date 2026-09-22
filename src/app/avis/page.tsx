'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { Button, Card, Chip, IconButton, Modal, Tabs } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { fetchPublicProfilesWith } from '@/lib/queries/publicProfilesCore';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

interface Review {
  id: string;
  user_id?: string;
  type: 'produit' | 'kit' | 'location' | 'occasion';
  target_name: string;
  rating: number;
  title: string;
  comment: string;
  verified: boolean;
  helpful_count: number;
  created_at: string;
  author?: { full_name: string; trust_score: number };
}

const typeConfig = {
  produit: { label: 'Produit', color: 'glass-pill', icon: 'TagIcon' },
  kit: { label: 'Kit', color: 'glass-pill pill-info', icon: 'RectangleStackIcon' },
  location: { label: 'Location', color: 'glass-pill pill-warn', icon: 'KeyIcon' },
  occasion: { label: 'Occasion', color: 'glass-pill pill-danger', icon: 'ArrowPathIcon' },
};

const FALLBACK_REVIEWS: Review[] = [
  { id: '1', type: 'produit', target_name: 'Osprey Farpoint 40', rating: 5, title: 'Sac parfait pour les voyages longue durée', comment: 'Utilisé pendant 3 semaines en Asie du Sud-Est. Très confortable.', verified: true, helpful_count: 24, created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(), author: { full_name: 'Marie T.', trust_score: 85 } },
  { id: '2', type: 'kit', target_name: 'Kit Islande Trek', rating: 4, title: 'Kit bien pensé', comment: 'Le kit couvre l\'essentiel pour l\'Islande.', verified: true, helpful_count: 18, created_at: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(), author: { full_name: 'Pierre D.', trust_score: 72 } },
  { id: '3', type: 'produit', target_name: 'Therm-a-Rest NeoAir XLite', rating: 5, title: 'Le meilleur matelas gonflable', comment: 'Léger, chaud et confortable.', verified: true, helpful_count: 31, created_at: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString(), author: { full_name: 'Lucie M.', trust_score: 91 } },
];

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => <Icon key={star} name="StarIcon" size={size} className={star <= rating ? 'text-[color:var(--lkv-warning)] fill-[color:var(--lkv-warning)]' : 'text-[color:var(--stone-300)] fill-[color:var(--stone-300)]'} />)}
    </div>
  );
}

function ReviewCard({ review, onHelpful }: { review: Review; onHelpful: (id: string) => void }) {
  const [voted, setVoted] = useState(false);
  const type = typeConfig[review.type] ?? typeConfig['produit'];
  const authorName = review.author?.full_name ?? 'Membre';
  return (
    <Card as="article" tone="sage" className="p-5 flex flex-col">
      <div className="flex items-start gap-3 mb-4">
        <Link
          href={review.user_id ? `/profil/${review.user_id}` : '/communaute'}
          className="w-10 h-10 rounded-xl bg-[color:var(--lkv-secondary)] text-white flex items-center justify-center text-sm font-bold flex-shrink-0 hover:opacity-90 transition-opacity cursor-pointer"
        >
          {authorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={review.user_id ? `/profil/${review.user_id}` : '/communaute'}
              className="font-semibold text-[color:var(--lkv-primary)] text-sm hover:underline cursor-pointer"
            >
              {authorName}
            </Link>
            {review.verified && <span className="flex items-center gap-1 text-[10px] text-[color:var(--lkv-primary-soft)]"><Icon name="CheckBadgeIcon" size={12} className="text-[color:var(--lkv-secondary)]" />Achat vérifié</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5"><StarRating rating={review.rating} size={12} /><span className="text-[10px] text-[color:var(--lkv-text-secondary)]">{new Date(review.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3"><span className={`${type.color} text-[10px]`}>{type.label}</span><span className="text-xs text-[color:var(--lkv-text-secondary)]">sur</span><span className="text-xs font-semibold text-[color:var(--lkv-primary)] truncate">{review.target_name}</span></div>
      <h4 className="font-display font-bold text-[color:var(--lkv-primary)] text-sm mb-2">{review.title}</h4>
      <p className="text-sm text-[color:var(--lkv-primary-soft)] leading-relaxed flex-1">{review.comment}</p>
      <div className="mt-[var(--space-4)] flex items-center justify-between border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-3)]">
        <Button
          size="sm"
          variant={voted ? 'primary' : 'secondary'}
          onClick={() => { if (!voted) { onHelpful(review.id); setVoted(true); } }}
          aria-pressed={voted}
          icon={<Icon name="HandThumbUpIcon" size={14} />}
        >
          Utile ({review.helpful_count + (voted ? 1 : 0)})
        </Button>
        <Button size="sm" variant="ghost" icon={<Icon name="FlagIcon" size={12} />}>
          Signaler
        </Button>
      </div>
    </Card>
  );
}

const FIELD_CLASS =
  'min-h-[var(--lkv-touch-min)] w-full rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] py-2.5 text-[length:var(--lkv-text-body-sm)] text-[color:var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';
const LABEL_CLASS =
  'mb-1.5 block text-[length:var(--lkv-text-caption-2)] font-semibold uppercase tracking-[0.05em] text-[color:var(--lkv-text-secondary)]';

function WriteReviewModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: { type: string; target_name: string; rating: number; title: string; comment: string }) => Promise<void> }) {
  const [rating, setRating] = useState(0); const [hovered, setHovered] = useState(0); const [submitted, setSubmitted] = useState(false); const [submitting, setSubmitting] = useState(false); const [form, setForm] = useState({ type: 'produit', target_name: '', title: '', comment: '' });
  const handleSubmit = async () => { if (!rating || !form.title || !form.comment || !form.target_name) return; setSubmitting(true); await onSubmit({ ...form, rating }); setSubmitting(false); setSubmitted(true); setTimeout(() => { onClose(); }, 2000); };
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={submitted ? 'Avis publié !' : 'Laisser un avis'}
      size="md"
    >
      {!submitted ? (
        <div className="flex flex-col gap-[var(--space-4)]">
          <div>
            <span className={LABEL_CLASS}>Type d&apos;avis</span>
            <div className="grid grid-cols-2 gap-[var(--space-2)]">
              {Object.entries(typeConfig).map(([key, val]) => (
                <Chip
                  key={key}
                  selected={form.type === key}
                  onClick={() => setForm((f) => ({ ...f, type: key }))}
                  icon={<Icon name={val.icon} size={14} />}
                  className="justify-start"
                >
                  {val.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="review-target" className={LABEL_CLASS}>Cible</label>
            <input
              id="review-target"
              value={form.target_name}
              onChange={(e) => setForm((f) => ({ ...f, target_name: e.target.value }))}
              className={FIELD_CLASS}
              placeholder="Nom du produit ou kit"
            />
          </div>
          <div>
            <span className={LABEL_CLASS}>Note</span>
            <div className="flex gap-1" role="group" aria-label="Note">
              {[1, 2, 3, 4, 5].map((star) => (
                <IconButton
                  key={star}
                  size="sm"
                  aria-label={`Note ${star} sur 5`}
                  aria-pressed={star <= rating}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(star)}
                  className="bg-transparent"
                >
                  <Icon name="StarIcon" size={24} className={star <= (hovered || rating) ? 'text-[color:var(--lkv-warning)] fill-[color:var(--lkv-warning)]' : 'text-[color:var(--stone-300)] fill-[color:var(--stone-300)]'} />
                </IconButton>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="review-title" className={LABEL_CLASS}>Titre</label>
            <input
              id="review-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className={FIELD_CLASS}
              placeholder="Résumez votre expérience"
            />
          </div>
          <div>
            <label htmlFor="review-comment" className={LABEL_CLASS}>Commentaire</label>
            <textarea
              id="review-comment"
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              className={`${FIELD_CLASS} min-h-[96px] resize-none`}
              rows={4}
              placeholder="Décrivez votre expérience..."
            />
          </div>
          <div className="mt-[var(--space-2)] flex gap-[var(--space-3)]">
            <Button type="button" variant="secondary" fullWidth onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="button"
              fullWidth
              loading={submitting}
              disabled={submitting || !rating || !form.title || !form.comment}
              onClick={handleSubmit}
              icon={!submitting ? <Icon name="PaperAirplaneIcon" size={16} /> : undefined}
            >
              {submitting ? 'Publication...' : "Publier l'avis"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="py-[var(--space-8)] text-center">
          <div className="mx-auto mb-[var(--space-4)] flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--btn-tint)]">
            <Icon name="CheckIcon" size={28} className="text-[color:var(--lkv-primary)]" />
          </div>
          <h3 className="mb-[var(--space-2)] text-[length:var(--lkv-text-title-sm)] font-bold text-[color:var(--lkv-primary)]">Avis publié !</h3>
          <Button onClick={onClose}>Fermer</Button>
        </div>
      )}
    </Modal>
  );
}

export default function AvisPage() {
  const [reviews, setReviews] = useState<Review[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'tous' | 'produit' | 'kit' | 'location' | 'occasion'>('tous'); const [showWriteModal, setShowWriteModal] = useState(false);
  const { user } = useAuth(); const supabase = useMemo(() => createClient(), []);

  const loadReviews = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: fetchError } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      const rows = (data ?? []) as Review[];
      const profiles = await fetchPublicProfilesWith(supabase, rows.map((r) => r.user_id ?? ''));
      const withAuthors = rows.map((r) => {
        const profile = r.user_id ? profiles[r.user_id] : undefined;
        return {
          ...r,
          author: profile
            ? { full_name: profile.full_name ?? '', trust_score: profile.trust_score ?? 0 }
            : undefined,
        };
      });
      setReviews(withAuthors.length ? withAuthors : FALLBACK_REVIEWS);
    } catch (err) { console.error('Error loading reviews:', err); setError('Impossible de charger les avis.'); setReviews(FALLBACK_REVIEWS); } finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const handleHelpful = async (reviewId: string) => {
    await supabase.from('reviews').update({ helpful_count: (reviews.find((r) => r.id === reviewId)?.helpful_count ?? 0) + 1 }).eq('id', reviewId);
    setReviews((prev) => prev.map((r) => r.id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r));
  };

  const handleSubmitReview = async (data: { type: string; target_name: string; rating: number; title: string; comment: string }) => {
    if (!user) return;
    await supabase.from('reviews').insert({ user_id: user.id, type: data.type, target_name: data.target_name, rating: data.rating, title: data.title, comment: data.comment, verified: false, helpful_count: 0 });
    await loadReviews();
  };

  const filtered = activeFilter === 'tous' ? reviews : reviews.filter((r) => r.type === activeFilter);
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';

  return (
    <>
      {/* DESKTOP — fullscreen, scroll interne sur le contenu */}
      <div className="hidden md:flex flex-col h-[100dvh] overflow-hidden bg-transparent" data-lkv-material-theme="light">
        <Header />
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
            <div className="flex items-end justify-between gap-6 mb-6">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--lkv-forest-100)] mb-2">AVIS &amp; ÉVALUATIONS</p>
                <h1 className="font-display font-bold text-3xl tracking-tight text-[color:var(--lkv-surface)]">Les avis de la communauté</h1>
                <p className="text-sm text-[color:var(--lkv-forest-100)] mt-1.5 max-w-xl">Avis vérifiés sur les produits, kits, locations et articles d&apos;occasion.</p>
              </div>
              <Button onClick={() => setShowWriteModal(true)} icon={<Icon name="PencilSquareIcon" size={16} />} className="shrink-0">
                Laisser un avis
              </Button>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <span className="font-display font-bold text-4xl text-[color:var(--lkv-surface)]">{avgRating}</span>
              <div>
                <StarRating rating={Math.round(parseFloat(avgRating))} size={16} />
                <p className="text-[11px] text-[color:var(--lkv-forest-100)] mt-0.5">{reviews.length} avis</p>
              </div>
            </div>

            <Tabs
              options={[{ id: 'tous', label: 'Tous les avis' }, { id: 'produit', label: 'Produits' }, { id: 'kit', label: 'Kits' }, { id: 'location', label: 'Locations' }, { id: 'occasion', label: 'Occasion' }]}
              value={activeFilter}
              onChange={(id) => setActiveFilter(id as typeof activeFilter)}
              variant="scrollable"
              ariaLabel="Filtrer les avis"
              className="mb-6"
            />

            {error && (
              <div className="mb-6 p-4 rounded-md border text-sm bg-[rgba(168,68,58,0.08)] border-[rgba(168,68,58,0.35)] text-[color:var(--lkv-danger-dark)]">
                <span className="flex items-center gap-2"><Icon name="ExclamationTriangleIcon" size={16} />{error}</span>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-48 rounded-xl glass-sub-card" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-[color:var(--lkv-forest-100)]">
                <Icon name="StarIcon" size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-display font-bold text-[color:var(--lkv-surface)] mb-1">Aucun avis pour l&apos;instant</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{filtered.map((review) => <ReviewCard key={review.id} review={review} onHelpful={handleHelpful} />)}</div>
            )}
          </div>
        </main>
        {showWriteModal && <WriteReviewModal onClose={() => setShowWriteModal(false)} onSubmit={handleSubmitReview} />}
        <Footer />
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div className="p-[var(--space-4)]">
            <p className="mb-[var(--space-3)] font-mono text-[length:var(--lkv-text-caption-2)] uppercase tracking-[0.14em] text-[color:var(--sage-100)]">AVIS &amp; ÉVALUATIONS</p>
            <h1 className="mb-[var(--space-2)] font-display text-[24px] font-extrabold text-[color:var(--lkv-surface)]">Les avis de la communauté</h1>
            <p className="mb-[var(--space-4)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-forest-100)]">Avis vérifiés sur les produits, kits et locations.</p>
            <Tabs
              options={[{ id: 'tous', label: 'Tous' }, { id: 'produit', label: 'Produits' }, { id: 'kit', label: 'Kits' }, { id: 'location', label: 'Locations' }, { id: 'occasion', label: 'Occasion' }]}
              value={activeFilter}
              onChange={(id) => setActiveFilter(id as typeof activeFilter)}
              variant="scrollable"
              ariaLabel="Filtrer les avis"
              className="mb-[var(--space-4)]"
            />
            {error ? (
              <div className="py-[var(--space-10)] text-center">
                <p className="mb-[var(--space-2)] text-[28px]" aria-hidden="true">⚠️</p>
                <p className="mb-[var(--space-3)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-forest-100)]">{error}</p>
                <Button size="sm" onClick={() => loadReviews()}>Réessayer</Button>
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-[var(--space-10)] text-center text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-forest-100)]">Aucun avis pour l&apos;instant</p>
            ) : (
              <div className="flex flex-col gap-[var(--space-3)]">
                {filtered.map((review) => {
                  const authorName = review.author?.full_name ?? 'Membre';
                  return (
                    <Card key={review.id} variant="standard" className="p-[14px]">
                      <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)]">
                        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--lkv-radius-xs)] bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn text-[12px] font-bold text-[color:var(--lkv-text-primary)]">
                          {authorName[0]}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-[color:var(--lkv-primary)]">{authorName}</p>
                          <p className="text-[11px] text-[color:var(--lkv-text-secondary)]">⭐ {review.rating}/5</p>
                        </div>
                      </div>
                      <p className="mb-1 text-[13px] font-semibold text-[color:var(--lkv-primary)]">{review.title}</p>
                      <p className="text-[12px] leading-[var(--leading-normal)] text-[color:var(--lkv-text-secondary)]">{review.comment}</p>
                    </Card>
                  );
                })}
              </div>
            )}
            <Button fullWidth className="mt-[var(--space-4)]" onClick={() => setShowWriteModal(true)}>
              Laisser un avis
            </Button>
          </div>
        </MobilePageShell>

        {showWriteModal && <WriteReviewModal onClose={() => setShowWriteModal(false)} onSubmit={handleSubmitReview} />}
      </div>
    </>
  );
}
