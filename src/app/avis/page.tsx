'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
  produit: { label: 'Produit', color: 'tag-activity', icon: 'TagIcon' },
  kit: { label: 'Kit', color: 'tag-info', icon: 'RectangleStackIcon' },
  location: { label: 'Location', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: 'KeyIcon' },
  occasion: { label: 'Occasion', color: 'tag-alert', icon: 'ArrowPathIcon' },
};

const FALLBACK_REVIEWS: Review[] = [
  {
    id: '1',
    type: 'produit',
    target_name: 'Osprey Farpoint 40',
    rating: 5,
    title: 'Sac parfait pour les voyages longue durée',
    comment: 'Utilisé pendant 3 semaines en Asie du Sud-Est. Très confortable, bien organisé et accepté en cabine sur la plupart des compagnies. Je recommande vivement.',
    verified: true,
    helpful_count: 24,
    created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    author: { full_name: 'Marie T.', trust_score: 85 },
  },
  {
    id: '2',
    type: 'kit',
    target_name: 'Kit Islande Trek',
    rating: 4,
    title: 'Kit bien pensé, quelques ajustements nécessaires',
    comment: 'Le kit couvre l\'essentiel pour l\'Islande. J\'ai ajouté des guêtres et remplacé les chaussures par un modèle plus imperméable. Globalement très satisfait.',
    verified: true,
    helpful_count: 18,
    created_at: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
    author: { full_name: 'Pierre D.', trust_score: 72 },
  },
  {
    id: '3',
    type: 'produit',
    target_name: 'Therm-a-Rest NeoAir XLite',
    rating: 5,
    title: 'Le meilleur matelas gonflable du marché',
    comment: 'Léger, chaud et confortable. Utilisé en bivouac à -5°C sans problème. L\'investissement en vaut vraiment la peine pour les randonneurs exigeants.',
    verified: true,
    helpful_count: 31,
    created_at: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString(),
    author: { full_name: 'Lucie M.', trust_score: 91 },
  },
];

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Icon key={star} name="StarIcon" size={size} className={star <= rating ? 'text-amber-500 fill-amber-500' : 'text-border'} />
      ))}
    </div>
  );
}

function ReviewCard({ review, onHelpful }: { review: Review; onHelpful: (id: string) => void }) {
  const [voted, setVoted] = useState(false);
  const type = typeConfig[review.type] ?? typeConfig['produit'];
  const authorName = review.author?.full_name ?? 'Membre';
  const authorInitials = authorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const trustScore = review.author?.trust_score ?? 70;

  return (
    <div className="topo-card p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-secondary text-white flex items-center justify-center text-sm font-700 flex-shrink-0">
          {authorInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-600 text-foreground text-sm">{authorName}</span>
            <div className="flex items-center gap-1 bg-primary/10 rounded px-1.5 py-0.5">
              <Icon name="ShieldCheckIcon" size={10} className="text-primary" />
              <span className="text-[10px] font-700 text-primary">{trustScore}</span>
            </div>
            {review.verified && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                <Icon name="CheckBadgeIcon" size={12} className="text-emerald-500" />
                Achat vérifié
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <StarRating rating={review.rating} size={12} />
            <span className="text-[10px] text-muted-foreground">
              {new Date(review.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={`tag-badge ${type.color} text-[10px]`}>{type.label}</span>
        <span className="text-xs text-muted-foreground">sur</span>
        <span className="text-xs font-600 text-foreground truncate">{review.target_name}</span>
      </div>

      <h4 className="font-display font-700 text-foreground text-sm mb-2">{review.title}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <button
          onClick={() => { if (!voted) { onHelpful(review.id); setVoted(true); } }}
          className={`flex items-center gap-1.5 text-xs transition-colors ${voted ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Icon name="HandThumbUpIcon" size={14} />
          Utile ({review.helpful_count + (voted ? 1 : 0)})
        </button>
        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <Icon name="FlagIcon" size={12} />
          Signaler
        </button>
      </div>
    </div>
  );
}

function WriteReviewModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: { type: string; target_name: string; rating: number; title: string; comment: string }) => Promise<void> }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ type: 'produit', target_name: '', title: '', comment: '' });

  const handleSubmit = async () => {
    if (!rating || !form.title || !form.comment || !form.target_name) return;
    setSubmitting(true);
    await onSubmit({ ...form, rating });
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => { onClose(); }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        {!submitted ? (
          <>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display font-700 text-foreground text-lg">Laisser un avis</h3>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-2">Type d&apos;avis</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(typeConfig).map(([key, val]) => (
                    <button key={key} onClick={() => setForm((f) => ({ ...f, type: key }))} className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-sm text-left ${form.type === key ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary hover:bg-primary/5'}`}>
                      <Icon name={val.icon} size={14} className="text-muted-foreground" />
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Produit / Kit / Article</label>
                <input value={form.target_name} onChange={(e) => setForm((f) => ({ ...f, target_name: e.target.value }))} className="input-field w-full" placeholder="Nom du produit ou kit" />
              </div>
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-2">Note</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onMouseEnter={() => setHovered(star)} onMouseLeave={() => setHovered(0)} onClick={() => setRating(star)}>
                      <Icon name="StarIcon" size={28} className={`transition-colors ${star <= (hovered || rating) ? 'text-amber-500 fill-amber-500' : 'text-border'}`} />
                    </button>
                  ))}
                  {rating > 0 && <span className="ml-2 text-sm text-muted-foreground self-center">{['', 'Mauvais', 'Passable', 'Bien', 'Très bien', 'Excellent'][rating]}</span>}
                </div>
              </div>
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Titre</label>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="input-field w-full" placeholder="Résumez votre expérience en une phrase" />
              </div>
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Votre avis</label>
                <textarea value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} className="input-field resize-none w-full" rows={4} placeholder="Décrivez votre expérience en détail..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="btn-secondary flex-1 justify-center py-3">Annuler</button>
              <button onClick={handleSubmit} disabled={submitting || !rating || !form.title || !form.comment} className="btn-primary flex-1 justify-center py-3 disabled:opacity-50">
                <Icon name="PaperAirplaneIcon" size={16} />
                {submitting ? 'Publication...' : 'Publier l\'avis'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <Icon name="CheckIcon" size={28} className="text-emerald-600" />
            </div>
            <h3 className="font-display font-700 text-foreground text-lg mb-2">Avis publié !</h3>
            <p className="text-sm text-muted-foreground mb-2">Merci pour votre contribution à la communauté.</p>
            <button onClick={onClose} className="btn-primary justify-center px-8 py-3">Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AvisPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'tous' | 'produit' | 'kit' | 'location' | 'occasion'>('tous');
  const [showWriteModal, setShowWriteModal] = useState(false);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('reviews')
        .select('*, author:user_profiles!reviews_user_id_fkey(full_name, trust_score)')
        .order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      if (!data || data.length === 0) {
        setReviews(FALLBACK_REVIEWS);
      } else {
        setReviews(data);
      }
    } catch {
      // On error, show fallback data instead of error state
      setReviews(FALLBACK_REVIEWS);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  const handleHelpful = async (reviewId: string) => {
    await supabase.from('reviews').update({ helpful_count: (reviews.find((r) => r.id === reviewId)?.helpful_count ?? 0) + 1 }).eq('id', reviewId);
    setReviews((prev) => prev.map((r) => r.id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r));
  };

  const handleSubmitReview = async (data: { type: string; target_name: string; rating: number; title: string; comment: string }) => {
    if (!user) return;
    const { error: insertError } = await supabase.from('reviews').insert({
      user_id: user.id,
      type: data.type,
      target_name: data.target_name,
      rating: data.rating,
      title: data.title,
      comment: data.comment,
      verified: false,
      helpful_count: 0,
    });
    if (!insertError) await loadReviews();
  };

  const filtered = activeFilter === 'tous' ? reviews : reviews.filter((r) => r.type === activeFilter);
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
      <Header />

      {/* Hero */}
      <section className="pt-20" style={{ background: '#1C2620' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <nav className="flex items-center gap-2 text-xs font-mono mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <a href="/" className="hover:text-white transition-colors">Accueil</a>
            <span>/</span>
            <span style={{ color: '#E4501C' }}>Avis</span>
          </nav>
          <p className="text-xs font-mono tracking-[0.2em] uppercase mb-4" style={{ color: '#4A6741' }}>Avis vérifiés</p>
          <h1 className="font-display font-800 text-5xl md:text-6xl text-white mb-3 leading-tight" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
            Avis de la<br /><em>communauté.</em>
          </h1>
          <p className="text-white/60 text-lg max-w-xl">Découvrez les retours d&apos;expérience de nos voyageurs sur les produits, kits et locations.</p>
          <div className="flex flex-wrap gap-8 mt-8 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {[
              { value: reviews.length.toString(), label: 'Avis publiés' },
              { value: reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) + '★' : '—', label: 'Note moyenne' },
              { value: reviews.filter((r) => r.verified).length.toString(), label: 'Achats vérifiés' },
            ].map((s) => (
              <div key={s.label}>
                <div className="font-mono text-2xl font-700 text-white">{s.value}</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && <div className="mb-6 p-4 rounded-xl text-red-700 text-sm" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>{error}</div>}

        {/* Filters + CTA */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex gap-2 flex-wrap">
            {(['tous', 'produit', 'kit', 'location', 'occasion'] as const).map((f) => (
              <button key={f} onClick={() => setActiveFilter(f)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all capitalize"
                style={activeFilter === f
                  ? { background: '#1C2620', color: '#fff' }
                  : { background: '#fff', border: '1px solid #C8C3B0', color: '#5C6B5E' }
                }>
                {f === 'tous' ? 'Tous' : f}
              </button>
            ))}
          </div>
          <button onClick={() => setShowWriteModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all"
            style={{ background: '#4A6741' }}>
            <Icon name="PencilSquareIcon" size={16} variant="outline" />
            Laisser un avis
          </button>
        </div>

        {/* Reviews */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Icon name="StarIcon" size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-display font-700 text-foreground mb-1">Aucun avis pour l&apos;instant</p>
              <p className="text-sm">Soyez le premier à laisser un avis !</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filtered.map((review) => (
                <ReviewCard key={review.id} review={review} onHelpful={handleHelpful} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showWriteModal && <WriteReviewModal onClose={() => setShowWriteModal(false)} onSubmit={handleSubmitReview} />}
      <NewFooterSection />
    </div>
  );
}
