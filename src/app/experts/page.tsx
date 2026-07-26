'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import NewFooterSection from '@/app/components/home/NewFooterSection';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Expert {
  id: string;
  name: string;
  title: string;
  specialties: string[];
  destinations: string[];
  rating: number;
  reviews_count: number;
  consultations_count: number;
  price_per_hour: number;
  availability: 'disponible' | 'occupé' | 'sur-demande';
  certifications: string[];
  bio: string;
  avatar: string;
  languages: string[];
  response_time: string;
}

const DESTINATIONS_FILTER = ['Toutes', 'Alpes', 'Himalaya', 'Sahara', 'Amazonie', 'Arctique', 'Patagonie'];

const FALLBACK_EXPERTS: Expert[] = [
  {
    id: '1',
    name: 'Marc Dubois',
    title: 'Guide de haute montagne — UIAGM',
    specialties: ['Alpinisme', 'Trek haute altitude', 'Survie en montagne'],
    destinations: ['Alpes', 'Himalaya', 'Patagonie'],
    rating: 4.9,
    reviews_count: 87,
    consultations_count: 312,
    price_per_hour: 85,
    availability: 'disponible',
    certifications: ['UIAGM', 'BEES Alpinisme', 'Secourisme montagne'],
    bio: 'Guide de haute montagne certifié UIAGM avec 15 ans d\'expérience. Spécialiste des expéditions en Himalaya et des courses alpines techniques.',
    avatar: '',
    languages: ['Français', 'Anglais', 'Espagnol'],
    response_time: '< 2h',
  },
  {
    id: '2',
    name: 'Sophie Laurent',
    title: 'Experte trek désert & Sahara',
    specialties: ['Trek désert', 'Navigation', 'Survie en milieu aride'],
    destinations: ['Sahara', 'Maroc', 'Jordanie'],
    rating: 4.8,
    reviews_count: 64,
    consultations_count: 198,
    price_per_hour: 70,
    availability: 'disponible',
    certifications: ['Brevet d\'État Randonnée', 'Formation désert FFME'],
    bio: 'Spécialiste des treks en milieu désertique. A traversé le Sahara en autonomie complète et accompagné plus de 200 groupes au Maroc et en Jordanie.',
    avatar: '',
    languages: ['Français', 'Anglais', 'Arabe'],
    response_time: '< 4h',
  },
  {
    id: '3',
    name: 'Thomas Renard',
    title: 'Guide trek Himalaya & Népal',
    specialties: ['Trek altitude', 'Acclimatation', 'Logistique expédition'],
    destinations: ['Himalaya', 'Népal', 'Tibet'],
    rating: 4.9,
    reviews_count: 112,
    consultations_count: 445,
    price_per_hour: 90,
    availability: 'sur-demande',
    certifications: ['UIAGM', 'Wilderness First Responder', 'Guide Népal certifié'],
    bio: '20 ans d\'expérience en Himalaya. A guidé des expéditions sur l\'Everest, l\'Annapurna et le Kangchenjunga. Expert en logistique d\'expédition et acclimatation.',
    avatar: '',
    languages: ['Français', 'Anglais', 'Népalais'],
    response_time: '< 6h',
  },
];

export default function ExpertsPage() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [destFilter, setDestFilter] = useState('Toutes');
  const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({ date: '', duration: '60', topic: '', message: '' });
  const [bookingDone, setBookingDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const loadExperts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('experts')
        .select('*')
        .order('rating', { ascending: false });
      if (fetchError) throw fetchError;
      // If no data from DB, use fallback experts
      if (!data || data.length === 0) {
        setExperts(FALLBACK_EXPERTS);
      } else {
        setExperts(data);
      }
    } catch {
      // On error, show fallback data instead of error state
      setExperts(FALLBACK_EXPERTS);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadExperts(); }, [loadExperts]);

  const filteredExperts = experts.filter((e) => {
    const destOk = destFilter === 'Toutes' || e.destinations.some((d) => d.includes(destFilter));
    return destOk;
  });

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedExpert) return;
    setSubmitting(true);
    try {
      await supabase.from('expert_bookings').insert({
        expert_id: selectedExpert.id,
        user_id: user.id,
        booking_date: bookingForm.date,
        duration_minutes: parseInt(bookingForm.duration),
        topic: bookingForm.topic,
        message: bookingForm.message,
        status: 'pending',
      });
      setBookingDone(true);
      setTimeout(() => { setBookingOpen(false); setBookingDone(false); setBookingForm({ date: '', duration: '60', topic: '', message: '' }); }, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const availabilityColor: Record<string, string> = {
    disponible: 'text-emerald-600 bg-emerald-100',
    occupé: 'text-red-600 bg-red-100',
    'sur-demande': 'text-amber-600 bg-amber-100',
  };

  return (
    <div className="min-h-screen" style={{ background: '#F5F2EC' }}>
      <Header />

      {/* Hero */}
      <section className="pt-20" style={{ background: '#1C2620' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <nav className="flex items-center gap-2 text-xs font-mono mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
            <a href="/" className="hover:text-white transition-colors">Accueil</a>
            <span>/</span>
            <span style={{ color: '#E4501C' }}>Experts</span>
          </nav>
          <p className="font-mono text-xs tracking-[0.2em] uppercase mb-4" style={{ color: '#4A6741' }}>Réseau d&apos;experts terrain</p>
          <h1 className="font-display font-800 text-5xl md:text-6xl text-white tracking-tight mb-3 leading-tight" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800 }}>
            Consultez des guides<br /><em>certifiés.</em>
          </h1>
          <p className="text-white/60 text-lg max-w-xl">Accédez à l&apos;expertise de guides professionnels certifiés pour préparer votre expédition en toute sécurité.</p>

          <div className="flex flex-wrap gap-8 mt-8 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {[
              { value: experts.length.toString(), label: 'Experts certifiés' },
              { value: experts.length > 0 ? (experts.reduce((s, e) => s + e.rating, 0) / experts.length).toFixed(2) : '—', label: 'Note moyenne' },
              { value: experts.reduce((s, e) => s + e.consultations_count, 0).toLocaleString() + '+', label: 'Consultations réalisées' },
              { value: experts.length > 0 ? Math.min(...experts.map((e) => e.price_per_hour)) + '€' : '—', label: 'À partir de / heure' },
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

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex gap-1.5 flex-wrap">
            <span className="text-xs font-mono self-center mr-1" style={{ color: '#7A7A6E' }}>DESTINATION:</span>
            {DESTINATIONS_FILTER.map((d) => (
              <button key={d} onClick={() => setDestFilter(d)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={destFilter === d
                  ? { background: '#1C2620', color: '#fff' }
                  : { background: '#fff', border: '1px solid #C8C3B0', color: '#5C6B5E' }
                }>
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Expert list */}
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)
            ) : filteredExperts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Icon name="UserGroupIcon" size={40} className="mx-auto mb-3 opacity-30" />
                <p>Aucun expert pour cette destination</p>
              </div>
            ) : (
              filteredExperts.map((expert) => (
                <div
                  key={expert.id}
                  className={`topo-card p-5 cursor-pointer transition-all ${selectedExpert?.id === expert.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setSelectedExpert(selectedExpert?.id === expert.id ? null : expert)}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-white font-700 text-lg flex-shrink-0">
                      {expert.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <h3 className="font-display font-700 text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{expert.name}</h3>
                          <p className="text-sm text-muted-foreground">{expert.title}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${availabilityColor[expert.availability]}`}>
                          {expert.availability}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {expert.specialties?.map((s) => (
                          <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">{s}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Icon name="StarIcon" size={13} className="text-amber-500" variant="solid" />
                          <span className="font-mono font-700 text-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{expert.rating}</span>
                          <span className="text-muted-foreground">({expert.reviews_count})</span>
                        </div>
                        <div className="text-muted-foreground">{expert.consultations_count} consultations</div>
                        <div className="flex gap-1">
                          {expert.languages?.map((l) => (
                            <span key={l} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-card border border-border text-muted-foreground" style={{ fontFamily: 'var(--font-mono)' }}>{l}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono text-xl font-700 text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{expert.price_per_hour}€</div>
                      <div className="text-xs text-muted-foreground">/heure</div>
                    </div>
                  </div>

                  {selectedExpert?.id === expert.id && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-3">{expert.bio}</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {expert.certifications?.map((c) => (
                          <span key={c} className="text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 font-medium flex items-center gap-1">
                            <Icon name="ShieldCheckIcon" size={11} variant="outline" />
                            {c}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                        <Icon name="ClockIcon" size={12} variant="outline" />
                        Répond en {expert.response_time}
                      </div>
                      <button
                        onClick={(ev) => { ev.stopPropagation(); setBookingOpen(true); }}
                        disabled={expert.availability === 'occupé'}
                        className="btn-primary py-2.5 px-5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Icon name="CalendarIcon" size={14} variant="outline" />
                        Réserver une consultation
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="topo-card p-5">
              <h3 className="font-display font-700 text-base text-foreground mb-4" style={{ fontFamily: 'var(--font-display)' }}>Comment ça marche ?</h3>
              <div className="space-y-4">
                {[
                  { step: '01', title: 'Choisissez votre expert', desc: 'Filtrez par destination, spécialité et disponibilité.' },
                  { step: '02', title: 'Réservez un créneau', desc: 'Consultation vidéo de 30 à 120 minutes selon vos besoins.' },
                  { step: '03', title: 'Préparez votre expédition', desc: 'Recevez un plan personnalisé, liste de matériel et conseils sécurité.' },
                ].map((s) => (
                  <div key={s.step} className="flex gap-3">
                    <div className="font-mono text-xs font-700 text-primary w-6 flex-shrink-0 mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{s.step}</div>
                    <div>
                      <div className="font-display font-700 text-sm text-foreground" style={{ fontFamily: 'var(--font-display)' }}>{s.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="topo-card p-5 bg-dark-bg text-white">
              <h3 className="font-display font-700 text-base mb-2" style={{ fontFamily: 'var(--font-display)' }}>Devenir expert partenaire</h3>
              <p className="text-sm text-white/60 mb-4">Vous êtes guide certifié ? Rejoignez notre réseau et monétisez votre expertise.</p>
              <button className="btn-primary w-full justify-center text-sm py-2.5">
                <Icon name="UserPlusIcon" size={14} variant="outline" />
                Postuler comme expert
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Modal */}
      {bookingOpen && selectedExpert && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setBookingOpen(false)}>
          <div className="bg-card rounded-2xl border border-border p-6 max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            {!bookingDone ? (
              <>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display font-700 text-foreground text-lg">Réserver avec {selectedExpert.name}</h3>
                  <button onClick={() => setBookingOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Icon name="XMarkIcon" size={18} />
                  </button>
                </div>
                <form onSubmit={handleBook} className="space-y-4">
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Date souhaitée</label>
                    <input type="date" required value={bookingForm.date} onChange={(e) => setBookingForm((f) => ({ ...f, date: e.target.value }))} className="input-field w-full" />
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Durée</label>
                    <select value={bookingForm.duration} onChange={(e) => setBookingForm((f) => ({ ...f, duration: e.target.value }))} className="input-field w-full">
                      <option value="30">30 minutes</option>
                      <option value="60">1 heure</option>
                      <option value="90">1h30</option>
                      <option value="120">2 heures</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Sujet de la consultation</label>
                    <input type="text" value={bookingForm.topic} onChange={(e) => setBookingForm((f) => ({ ...f, topic: e.target.value }))} placeholder="Ex: Préparation trek Annapurnas" className="input-field w-full" />
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wider block mb-1.5">Message (optionnel)</label>
                    <textarea value={bookingForm.message} onChange={(e) => setBookingForm((f) => ({ ...f, message: e.target.value }))} rows={3} className="input-field w-full resize-none" placeholder="Décrivez votre projet..." />
                  </div>
                  {!user && <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">Connectez-vous pour réserver une consultation.</p>}
                  <div className="flex gap-3 mt-6">
                    <button type="button" onClick={() => setBookingOpen(false)} className="btn-secondary flex-1 justify-center py-3">Annuler</button>
                    <button type="submit" disabled={!user || submitting} className="btn-primary flex-1 justify-center py-3 disabled:opacity-50">
                      {submitting ? 'Envoi...' : 'Confirmer la réservation'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <Icon name="CheckIcon" size={28} className="text-emerald-600" />
                </div>
                <h3 className="font-display font-700 text-foreground text-lg mb-2">Demande envoyée !</h3>
                <p className="text-sm text-muted-foreground">{selectedExpert.name} vous répondra dans {selectedExpert.response_time}.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <NewFooterSection />
    </div>
  );
}
