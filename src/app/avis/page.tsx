'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
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
  produit: { label: 'Produit', color: 'tag-activity', icon: 'TagIcon' },
  kit: { label: 'Kit', color: 'tag-info', icon: 'RectangleStackIcon' },
  location: { label: 'Location', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: 'KeyIcon' },
  occasion: { label: 'Occasion', color: 'tag-alert', icon: 'ArrowPathIcon' },
};

const FALLBACK_REVIEWS: Review[] = [
  { id: '1', type: 'produit', target_name: 'Osprey Farpoint 40', rating: 5, title: 'Sac parfait pour les voyages longue durée', comment: 'Utilisé pendant 3 semaines en Asie du Sud-Est. Très confortable.', verified: true, helpful_count: 24, created_at: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(), author: { full_name: 'Marie T.', trust_score: 85 } },
  { id: '2', type: 'kit', target_name: 'Kit Islande Trek', rating: 4, title: 'Kit bien pensé', comment: 'Le kit couvre l\'essentiel pour l\'Islande.', verified: true, helpful_count: 18, created_at: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(), author: { full_name: 'Pierre D.', trust_score: 72 } },
  { id: '3', type: 'produit', target_name: 'Therm-a-Rest NeoAir XLite', rating: 5, title: 'Le meilleur matelas gonflable', comment: 'Léger, chaud et confortable.', verified: true, helpful_count: 31, created_at: new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString(), author: { full_name: 'Lucie M.', trust_score: 91 } },
];

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => <Icon key={star} name="StarIcon" size={size} className={star <= rating ? 'text-amber-500 fill-amber-500' : 'text-border'} />)}
    </div>
  );
}

function ReviewCard({ review, onHelpful }: { review: Review; onHelpful: (id: string) => void }) {
  const [voted, setVoted] = useState(false);
  const type = typeConfig[review.type] ?? typeConfig['produit'];
  const authorName = review.author?.full_name ?? 'Membre';
  return (
    <div className="topo-card p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-secondary text-white flex items-center justify-center text-sm font-700 flex-shrink-0">{authorName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap"><span className="font-600 text-foreground text-sm">{authorName}</span>{review.verified && <span className="flex items-center gap-1 text-[10px] text-emerald-600"><Icon name="CheckBadgeIcon" size={12} className="text-emerald-500" />Achat vérifié</span>}</div>
          <div className="flex items-center gap-2 mt-0.5"><StarRating rating={review.rating} size={12} /><span className="text-[10px] text-muted-foreground">{new Date(review.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3"><span className={`tag-badge ${type.color} text-[10px]`}>{type.label}</span><span className="text-xs text-muted-foreground">sur</span><span className="text-xs font-600 text-foreground truncate">{review.target_name}</span></div>
      <h4 className="font-display font-700 text-foreground text-sm mb-2">{review.title}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <button onClick={() => { if (!voted) { onHelpful(review.id); setVoted(true); } }} className={`flex items-center gap-1.5 text-xs transition-colors ${voted ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}><Icon name="HandThumbUpIcon" size={14} />Utile ({review.helpful_count + (voted ? 1 : 0)})</button>
        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><Icon name="FlagIcon" size={12} />Signaler</button>
      </div>
    </div>
  );
}

function WriteReviewModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (data: { type: string; target_name: string; rating: number; title: string; comment: string }) => Promise<void> }) {
  const [rating, setRating] = useState(0); const [hovered, setHovered] = useState(0); const [submitted, setSubmitted] = useState(false); const [submitting, setSubmitting] = useState(false); const [form, setForm] = useState({ type: 'produit', target_name: '', title: '', comment: '' });
  const handleSubmit = async () => { if (!rating || !form.title || !form.comment || !form.target_name) return; setSubmitting(true); await onSubmit({ ...form, rating }); setSubmitting(false); setSubmitted(true); setTimeout(() => { onClose(); }, 2000); };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ backgroundColor: '#FBFAF6', border: '1px solid rgba(11,31,23,0.08)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 10px 25px rgba(11,31,23,0.15)', boxSizing: 'border-box' }} onClick={(e) => e.stopPropagation()}>
        {!submitted ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0B1F17', margin: 0 }}>Laisser un avis</h3>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#6B7A72' }}>
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B7A72', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Type d&apos;avis</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {Object.entries(typeConfig).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => setForm((f) => ({ ...f, type: key }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px',
                        borderRadius: '12px',
                        border: form.type === key ? '2px solid #17402C' : '1px solid rgba(11,31,23,0.12)',
                        background: form.type === key ? 'rgba(23,64,44,0.05)' : '#fff',
                        color: '#0B1F17',
                        fontSize: '13px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                    >
                      <Icon name={val.icon} size={14} className="text-muted-foreground" />
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B7A72', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Cible</label>
                <input
                  value={form.target_name}
                  onChange={(e) => setForm((f) => ({ ...f, target_name: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(11,31,23,0.12)', background: '#fff', fontSize: '14px', boxSizing: 'border-box' }}
                  placeholder="Nom du produit ou kit"
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B7A72', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Note</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} onMouseEnter={() => setHovered(star)} onMouseLeave={() => setHovered(0)} onClick={() => setRating(star)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                      <Icon name="StarIcon" size={28} className={`transition-colors ${star <= (hovered || rating) ? 'text-amber-500 fill-amber-500' : 'text-border'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B7A72', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Titre</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(11,31,23,0.12)', background: '#fff', fontSize: '14px', boxSizing: 'border-box' }}
                  placeholder="Résumez votre expérience"
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B7A72', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Commentaire</label>
                <textarea
                  value={form.comment}
                  onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(11,31,23,0.12)', background: '#fff', fontSize: '14px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'none' }}
                  rows={4}
                  placeholder="Décrivez votre expérience..."
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.12)', background: 'transparent', color: '#0B1F17', fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button type="button" onClick={handleSubmit} disabled={submitting || !rating || !form.title || !form.comment} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#17402C', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: (submitting || !rating || !form.title || !form.comment) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Icon name="PaperAirplaneIcon" size={16} />
                {submitting ? 'Publication...' : 'Publier l\'avis'}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#EDF3ED', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Icon name="CheckIcon" size={28} style={{ color: '#17402C' }} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0B1F17', marginBottom: '8px' }}>Avis publié !</h3>
            <button onClick={onClose} style={{ padding: '10px 32px', background: '#17402C', color: '#fff', border: 'none', borderRadius: '999px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AvisPage() {
  const [reviews, setReviews] = useState<Review[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'tous' | 'produit' | 'kit' | 'location' | 'occasion'>('tous'); const [showWriteModal, setShowWriteModal] = useState(false);
  const { user } = useAuth(); const supabase = useMemo(() => createClient(), []);

  const loadReviews = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: fetchError } = await supabase.from('reviews').select('*, author:user_profiles!reviews_user_id_fkey(full_name, trust_score)').order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setReviews(data?.length ? data : FALLBACK_REVIEWS);
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
      {/* DESKTOP */}
      <div className="hidden md:block">
        <main className="min-h-screen bg-background">
          <Header />
          <div className="pt-16 lg:pt-18">
            <section className="bg-dark-bg text-white py-16 px-4 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10"><div className="absolute top-0 left-1/2 w-96 h-96 rounded-full bg-amber-500 blur-3xl" /></div>
              <div className="max-w-7xl mx-auto relative">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-4"><span className="tag-badge bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px]">PHASE 2</span><span className="text-white/50 text-xs font-mono-data">AVIS & ÉVALUATIONS</span></div>
                    <h1 className="text-section-title text-white mb-3">Les avis de la<br />communauté</h1>
                    <p className="text-white/60 text-base max-w-xl">Avis vérifiés sur les produits, kits, locations et articles d&apos;occasion.</p>
                  </div>
                  <button onClick={() => setShowWriteModal(true)} className="btn-primary py-3 px-6 flex-shrink-0"><Icon name="PencilSquareIcon" size={16} />Laisser un avis</button>
                </div>
                <div className="flex items-center gap-8 mt-10"><div className="flex items-center gap-2"><span className="font-display font-800 text-white text-4xl">{avgRating}</span><div><StarRating rating={Math.round(parseFloat(avgRating))} size={16} /><p className="text-white/50 text-xs mt-0.5">{reviews.length} avis</p></div></div></div>
              </div>
            </section>
            <section className="sticky top-16 z-30 bg-background/95 backdrop-blur-md border-b border-border"><div className="max-w-7xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
              {[{ id: 'tous', label: 'Tous les avis' }, { id: 'produit', label: 'Produits' }, { id: 'kit', label: 'Kits' }, { id: 'location', label: 'Locations' }, { id: 'occasion', label: 'Occasion' }].map((f) => (
                <button key={f.id} onClick={() => setActiveFilter(f.id as typeof activeFilter)} className={`category-pill flex-shrink-0 ${activeFilter === f.id ? 'active' : ''}`}>{f.label}</button>
              ))}
            </div></section>
            <section className="max-w-7xl mx-auto px-4 py-10">
              {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}
              {loading ? <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{[1, 2, 3, 4].map((i) => <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />)}</div>
                : filtered.length === 0 ? <div className="text-center py-16 text-muted-foreground"><Icon name="StarIcon" size={40} className="mx-auto mb-3 opacity-30" /><p className="font-display font-700 text-foreground mb-1">Aucun avis pour l&apos;instant</p></div>
                  : <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{filtered.map((review) => <ReviewCard key={review.id} review={review} onHelpful={handleHelpful} />)}</div>
              }
            </section>
          </div>
          {showWriteModal && <WriteReviewModal onClose={() => setShowWriteModal(false)} onSubmit={handleSubmitReview} />}
          <Footer />
        </main>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            <p style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#17402C', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '12px' }}>AVIS & ÉVALUATIONS</p>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1C2620', marginBottom: '8px', fontFamily: 'var(--font-display)' }}>Les avis de la communauté</h1>
            <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.6)', marginBottom: '16px' }}>Avis vérifiés sur les produits, kits et locations.</p>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', overflowX: 'auto' }}>
              {[{ id: 'tous', label: 'Tous' }, { id: 'produit', label: 'Produits' }, { id: 'kit', label: 'Kits' }, { id: 'location', label: 'Locations' }, { id: 'occasion', label: 'Occasion' }].map((f) => (
                <button key={f.id} onClick={() => setActiveFilter(f.id as typeof activeFilter)} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', background: activeFilter === f.id ? '#17402C' : '#F4F1EA', color: activeFilter === f.id ? 'white' : 'rgba(28,38,32,0.6)', whiteSpace: 'nowrap', border: activeFilter === f.id ? 'none' : '1px solid rgba(11,31,23,0.06)' }}>{f.label}</button>
              ))}
            </div>
            {error ? <div style={{ textAlign: 'center', padding: '40px 0' }}><p style={{ fontSize: '28px', marginBottom: '8px' }}>⚠️</p><p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.5)', marginBottom: '12px' }}>{error}</p><button onClick={() => loadReviews()} style={{ padding: '8px 16px', background: '#17402C', color: '#fff', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Réessayer</button></div>
              : filtered.length === 0 ? <p style={{ textAlign: 'center', color: 'rgba(28,38,32,0.5)', padding: '40px 0' }}>Aucun avis pour l&apos;instant</p>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{filtered.map((review) => {
                const authorName = review.author?.full_name ?? 'Membre';
                return <div key={review.id} style={{ background: '#FBFAF6', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)', padding: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#17402C', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>{authorName[0]}</div>
                    <div><p style={{ fontSize: '13px', fontWeight: 600, color: '#1C2620' }}>{authorName}</p><p style={{ fontSize: '11px', color: 'rgba(28,38,32,0.5)' }}>⭐ {review.rating}/5</p></div>
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1C2620', marginBottom: '4px' }}>{review.title}</p>
                  <p style={{ fontSize: '12px', color: 'rgba(28,38,32,0.6)', lineHeight: '1.5' }}>{review.comment}</p>
                </div>;
              })}</div>
            }
            <button onClick={() => setShowWriteModal(true)} style={{ width: '100%', marginTop: '16px', padding: '12px', background: '#17402C', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Laisser un avis</button>
          </div>
        </MobilePageShell>
        
        {showWriteModal && <WriteReviewModal onClose={() => setShowWriteModal(false)} onSubmit={handleSubmitReview} />}
      </div>
    </>
  );
}
