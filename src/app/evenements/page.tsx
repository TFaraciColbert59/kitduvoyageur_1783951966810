'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface EventExpense {
  id: string;
  label: string;
  amount: number;
  paid: boolean;
}

interface Event {
  id: string;
  title: string;
  type: string;
  emoji: string;
  organizer_id?: string;
  organizer?: { full_name: string; trust_score: number };
  event_date: string;
  duration: string;
  location: string;
  country: string;
  max_participants: number;
  current_participants: number;
  description: string;
  cover_image: string;
  cover_alt: string;
  shared_kitty: number;
  kitty_goal: number;
  min_trust_to_organize: number;
  status: 'upcoming' | 'full' | 'past';
  expenses?: EventExpense[];
  is_registered?: boolean;
}

const typeConfig: Record<string, { color: string; label: string }> = {
  rando: { color: 'bg-emerald-100 text-emerald-700', label: 'Randonnée' },
  bushcraft: { color: 'bg-stone-100 text-stone-700', label: 'Bushcraft' },
  vanlife: { color: 'bg-amber-100 text-amber-700', label: 'Vanlife' },
  alpinisme: { color: 'bg-slate-100 text-slate-700', label: 'Alpinisme' },
  photo: { color: 'bg-purple-100 text-purple-700', label: 'Photo' },
};

function TrustRing({ score, size = 36 }: { score: number; size?: number }) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 90 ? '#10b981' : score >= 75 ? '#3b82f6' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={2.5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={2.5}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute font-mono text-foreground" style={{ fontSize: size * 0.26, fontWeight: 700 }}>{score}</span>
    </div>
  );
}

function EventCard({ event, onToggleRegister }: { event: Event; onToggleRegister: (eventId: string, isRegistered: boolean) => void }) {
  const [showKitty, setShowKitty] = useState(false);
  const [registering, setRegistering] = useState(false);
  const cfg = typeConfig[event.type] ?? { color: 'bg-gray-100 text-gray-700', label: event.type };
  const kittyPct = event.kitty_goal > 0 ? Math.round((event.shared_kitty / event.kitty_goal) * 100) : 0;
  const spotsLeft = event.max_participants - event.current_participants;

  const handleToggle = async () => {
    setRegistering(true);
    await onToggleRegister(event.id, !!event.is_registered);
    setRegistering(false);
  };

  const formatDate = (d: string) => {
    const [_y, m, day] = d.split('-');
    const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
    return `${parseInt(day)} ${months[parseInt(m) - 1]}`;
  };

  return (
    <div className="topo-card overflow-hidden">
      <div className="relative aspect-[16/7] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={event.cover_image} alt={event.cover_alt} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${cfg.color}`}>
            {event.emoji} {cfg.label}
          </span>
          {event.status === 'full' && (
            <span className="text-[10px] font-700 px-2 py-0.5 rounded-full bg-red-100 text-red-700">Complet</span>
          )}
        </div>
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="font-display font-700 text-white text-base leading-tight">{event.title}</h3>
          <p className="text-white/60 text-xs mt-1">{event.location} · {event.duration}</p>
        </div>
      </div>

      <div className="p-5">
        {event.organizer && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-background rounded-xl border border-border">
            <div className="w-9 h-9 rounded-xl bg-secondary text-white flex items-center justify-center text-sm font-700 flex-shrink-0">
              {event.organizer.full_name?.slice(0, 2).toUpperCase() ?? 'OR'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Organisateur</p>
              <p className="text-sm font-700 text-foreground">{event.organizer.full_name}</p>
            </div>
            <div className="flex flex-col items-center">
              <TrustRing score={event.organizer.trust_score ?? 70} size={40} />
              <p className="text-[9px] text-muted-foreground mt-0.5">Trust Score</p>
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{event.description}</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-background rounded-xl p-3 border border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600 mb-1">Date</p>
            <p className="font-display font-700 text-foreground text-sm">{formatDate(event.event_date)}</p>
            <p className="text-xs text-muted-foreground">{event.duration}</p>
          </div>
          <div className="bg-background rounded-xl p-3 border border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600 mb-1">Places</p>
            <p className="font-display font-700 text-foreground text-sm">{event.current_participants}/{event.max_participants}</p>
            <p className={`text-xs ${spotsLeft <= 2 ? 'text-red-500' : 'text-muted-foreground'}`}>
              {event.status === 'full' ? 'Complet' : `${spotsLeft} place${spotsLeft > 1 ? 's' : ''} restante${spotsLeft > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Group kitty */}
        <div className="mb-4">
          <button
            onClick={() => setShowKitty((v) => !v)}
            className="w-full flex items-center justify-between p-3 bg-background rounded-xl border border-border hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Icon name="BanknotesIcon" size={14} className="text-primary" />
              <span className="text-sm font-600 text-foreground">Cagnotte groupe</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-700 text-foreground">{event.shared_kitty}€ / {event.kitty_goal}€</span>
              <Icon name={showKitty ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} className="text-muted-foreground" />
            </div>
          </button>
          <div className="mt-2 px-1">
            <div className="weight-gauge">
              <div className="weight-gauge-fill" style={{ width: `${kittyPct}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{kittyPct}% collecté</p>
          </div>
          {showKitty && event.expenses && (
            <div className="mt-3 space-y-2 p-3 bg-background rounded-xl border border-border">
              {event.expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${exp.paid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className="text-foreground">{exp.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-700 text-foreground">{exp.amount}€</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${exp.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {exp.paid ? 'Payé' : 'En attente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleToggle}
          disabled={registering || (event.status === 'full' && !event.is_registered)}
          className={`w-full py-2.5 rounded-xl text-sm font-700 transition-all ${
            event.status === 'full' && !event.is_registered ?'bg-muted text-muted-foreground cursor-not-allowed'
              : event.is_registered
              ? 'bg-secondary/10 text-secondary border border-secondary/30' :'btn-primary justify-center'
          }`}
        >
          {registering ? '...' : event.status === 'full' && !event.is_registered ? "Complet — Liste d'attente" : event.is_registered ? "✓ Inscrit — Se désinscrire" : "S'inscrire à la sortie"}
        </button>
      </div>
    </div>
  );
}

export default function EvenementsPage() {
  const [filter, setFilter] = useState<string>('all');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', type: 'rando', emoji: '🥾', event_date: '', duration: '', location: '', country: 'France',
    max_participants: 10, description: '', cover_image: '', kitty_goal: 0,
  });
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*, organizer:user_profiles!events_organizer_id_fkey(full_name, trust_score), expenses:event_expenses(*)')
        .order('event_date', { ascending: true });

      if (eventsError) throw eventsError;

      let registeredIds: string[] = [];
      if (user) {
        const { data: participations } = await supabase
          .from('event_participants')
          .select('event_id')
          .eq('user_id', user.id);
        registeredIds = participations?.map((p) => p.event_id) ?? [];
      }

      setEvents((eventsData ?? []).map((e) => ({ ...e, is_registered: registeredIds.includes(e.id) })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleToggleRegister = async (eventId: string, isRegistered: boolean) => {
    if (!user) return;
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;

    if (isRegistered) {
      await supabase.from('event_participants').delete().eq('event_id', eventId).eq('user_id', user.id);
      await supabase.from('events').update({ current_participants: ev.current_participants - 1 }).eq('id', eventId);
      setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, is_registered: false, current_participants: e.current_participants - 1 } : e));
    } else {
      if (ev.status === 'full') return;
      await supabase.from('event_participants').insert({ event_id: eventId, user_id: user.id });
      const newCount = ev.current_participants + 1;
      const newStatus = newCount >= ev.max_participants ? 'full' : 'upcoming';
      await supabase.from('events').update({ current_participants: newCount, status: newStatus }).eq('id', eventId);
      setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, is_registered: true, current_participants: newCount, status: newStatus as 'upcoming' | 'full' | 'past' } : e));
    }
  };

  const handleCreateEvent = async () => {
    if (!user || !createForm.title.trim() || !createForm.event_date) return;
    setCreating(true);
    try {
      const { error: insertError } = await supabase.from('events').insert({
        ...createForm,
        organizer_id: user.id,
        current_participants: 0,
        shared_kitty: 0,
        status: 'upcoming',
        cover_image: createForm.cover_image || 'https://images.unsplash.com/photo-1649956688202-51e042251f27',
        cover_alt: createForm.title,
      });
      if (insertError) throw insertError;
      setShowCreateModal(false);
      setCreateForm({ title: '', type: 'rando', emoji: '🥾', event_date: '', duration: '', location: '', country: 'France', max_participants: 10, description: '', cover_image: '', kitty_goal: 0 });
      await loadEvents();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const filtered = events.filter((e) => filter === 'all' || e.type === filter);

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="pt-16 lg:pt-18">
        <section className="bg-dark-bg text-white py-14 px-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-secondary blur-3xl" />
          </div>
          <div className="max-w-7xl mx-auto relative">
            <div className="flex items-center gap-2 mb-4">
              <span className="tag-badge bg-secondary/30 text-emerald-300 border border-emerald-500/30 text-[10px]">COMMUNAUTÉ</span>
              <span className="text-white/50 text-xs font-mono">ÉVÉNEMENTS & SORTIES</span>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div>
                <h1 className="text-section-title text-white mb-3">
                  Sorties organisées<br />
                  <span className="text-primary">par des membres vérifiés</span>
                </h1>
                <p className="text-white/60 text-base max-w-xl">
                  Chaque organisateur affiche son Trust Score avant votre inscription. Cagnotte de groupe intégrée, location de matériel partagée.
                </p>
              </div>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary flex-shrink-0 self-start lg:self-auto">
                <Icon name="PlusIcon" size={16} />
                Organiser une sortie
              </button>
            </div>
          </div>
        </section>

        <section className="sticky top-16 z-30 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-1 py-3 overflow-x-auto">
              {[
                { id: 'all', label: 'Toutes les sorties' },
                { id: 'rando', label: '🥾 Randonnée' },
                { id: 'bushcraft', label: '🪓 Bushcraft' },
                { id: 'vanlife', label: '🚐 Vanlife' },
                { id: 'alpinisme', label: '⛏️ Alpinisme' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`category-pill flex-shrink-0 ${filter === f.id ? 'active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-10">
          {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error}</div>}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-700 text-foreground text-xl">Prochaines sorties</h2>
                <p className="text-sm text-muted-foreground">{filtered.length} événements</p>
              </div>
              {loading ? (
                <div className="space-y-6">
                  {[1, 2].map((i) => <div key={i} className="topo-card h-96 animate-pulse bg-muted" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Icon name="CalendarIcon" size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-display font-700 text-foreground mb-1">Aucun événement</p>
                  <p className="text-sm">Soyez le premier à organiser une sortie !</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filtered.map((e) => <EventCard key={e.id} event={e} onToggleRegister={handleToggleRegister} />)}
                </div>
              )}
            </div>

            <aside className="space-y-6">
              <div className="topo-card p-5">
                <h3 className="font-display font-700 text-foreground text-base mb-3 flex items-center gap-2">
                  <Icon name="ShieldCheckIcon" size={16} className="text-primary" />
                  Trust Score & sécurité
                </h3>
                <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                  Le Trust Score de l&apos;organisateur est visible avant toute inscription. Un score élevé signifie des évaluations positives d&apos;événements précédents.
                </p>
                <div className="space-y-2">
                  {[
                    { score: '90+', label: 'Ambassadeur — Organisateur confirmé', color: 'text-emerald-600' },
                    { score: '75–89', label: 'Expert — Plusieurs sorties réussies', color: 'text-blue-600' },
                    { score: '60–74', label: 'Confirmé — Premières sorties', color: 'text-amber-600' },
                  ].map((s) => (
                    <div key={s.score} className="flex items-center gap-2 text-xs">
                      <span className={`font-mono font-700 ${s.color} w-12`}>{s.score}</span>
                      <span className="text-muted-foreground">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="topo-card p-5">
                <h3 className="font-display font-700 text-foreground text-base mb-3 flex items-center gap-2">
                  <Icon name="BanknotesIcon" size={16} className="text-primary" />
                  Cagnotte intégrée
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Frais partagés gérés directement dans l&apos;événement. Location de matériel possible via le module location de la plateforme.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Create event modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full my-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-700 text-foreground text-lg">Organiser une sortie</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            {!user ? (
              <p className="text-sm text-muted-foreground text-center py-4">Connectez-vous pour organiser une sortie.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Titre</label>
                  <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Ex: Traversée GR20" value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Type</label>
                    <select className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={createForm.type} onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value }))}>
                      <option value="rando">🥾 Randonnée</option>
                      <option value="bushcraft">🪓 Bushcraft</option>
                      <option value="vanlife">🚐 Vanlife</option>
                      <option value="alpinisme">⛏️ Alpinisme</option>
                      <option value="photo">📷 Photo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Date</label>
                    <input type="date" className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={createForm.event_date} onChange={(e) => setCreateForm((f) => ({ ...f, event_date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Durée</label>
                    <input className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Ex: 3 jours" value={createForm.duration} onChange={(e) => setCreateForm((f) => ({ ...f, duration: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Participants max</label>
                    <input type="number" min={2} max={50} className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={createForm.max_participants} onChange={(e) => setCreateForm((f) => ({ ...f, max_participants: parseInt(e.target.value) || 10 }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Lieu</label>
                  <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Ex: Pyrénées, Cauterets" value={createForm.location} onChange={(e) => setCreateForm((f) => ({ ...f, location: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Description</label>
                  <textarea rows={3} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="Décrivez la sortie..." value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Objectif cagnotte (€)</label>
                  <input type="number" min={0} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="0" value={createForm.kitty_goal} onChange={(e) => setCreateForm((f) => ({ ...f, kitty_goal: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowCreateModal(false)} className="flex-1 btn-secondary py-2.5 text-sm justify-center">Annuler</button>
                  <button onClick={handleCreateEvent} disabled={creating || !createForm.title.trim() || !createForm.event_date} className="flex-1 btn-primary py-2.5 text-sm justify-center disabled:opacity-50">
                    {creating ? 'Création...' : 'Créer la sortie'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Footer />
    </main>
  );
}

export const dynamic = 'force-dynamic';