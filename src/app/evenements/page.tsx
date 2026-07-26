'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Link from 'next/link';

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

// ─── Event Detail Modal ───────────────────────────────────────────────────────
function EventDetailModal({
  event,
  onClose,
  onToggleRegister,
}: {
  event: Event | null;
  onClose: () => void;
  onToggleRegister: (eventId: string, isRegistered: boolean) => void;
}) {
  const [registering, setRegistering] = useState(false);
  const [showKitty, setShowKitty] = useState(false);

  if (!event) return null;

  const cfg = typeConfig[event.type] ?? { color: 'bg-gray-100 text-gray-700', label: event.type };
  const kittyPct = event.kitty_goal > 0 ? Math.round((event.shared_kitty / event.kitty_goal) * 100) : 0;
  const spotsLeft = event.max_participants - event.current_participants;

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const handleToggle = async () => {
    setRegistering(true);
    await onToggleRegister(event.id, !!event.is_registered);
    setRegistering(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl my-4 overflow-hidden">
        {/* Cover */}
        <div className="relative h-56 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.cover_image} alt={event.cover_alt} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-sm rounded-xl hover:bg-black/60 transition-colors">
            <Icon name="XMarkIcon" size={18} className="text-white" />
          </button>
          <div className="absolute top-4 left-4 flex gap-2">
            <span className={`text-[10px] font-700 px-2.5 py-1 rounded-full ${cfg.color}`}>{event.emoji} {cfg.label}</span>
            {event.status === 'full' && <span className="text-[10px] font-700 px-2.5 py-1 rounded-full bg-red-100 text-red-700">Complet</span>}
          </div>
          <div className="absolute bottom-4 left-5 right-5">
            <h2 className="font-display font-800 text-white text-xl leading-tight mb-1">{event.title}</h2>
            <p className="text-white/60 text-sm">{event.location} · {event.duration}</p>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="max-h-[65vh] overflow-y-auto">
          {/* Key stats */}
          <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
            {[
              { label: 'Date', value: event.event_date ? new Date(event.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—', icon: '📅' },
              { label: 'Durée', value: event.duration || '—', icon: '⏱️' },
              { label: 'Places', value: `${event.current_participants}/${event.max_participants}`, icon: '👥' },
              { label: 'Cagnotte', value: `${event.shared_kitty}€`, icon: '💰' },
            ].map((s) => (
              <div key={s.label} className="p-4 text-center">
                <p className="text-base mb-0.5">{s.icon}</p>
                <p className="font-display font-700 text-foreground text-sm">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="p-6 space-y-5">
            {/* Organizer */}
            {event.organizer && (
              <div className="flex items-center gap-4 p-4 bg-background rounded-xl border border-border">
                <div className="w-12 h-12 rounded-xl bg-secondary/20 text-secondary flex items-center justify-center text-lg font-700 flex-shrink-0">
                  {event.organizer.full_name?.slice(0, 2).toUpperCase() ?? 'OR'}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-0.5">Organisateur</p>
                  <p className="font-700 text-foreground">{event.organizer.full_name}</p>
                  <p className="text-xs text-muted-foreground">Trust Score minimum requis : {event.min_trust_to_organize}</p>
                </div>
                <div className="flex flex-col items-center">
                  <TrustRing score={event.organizer.trust_score ?? 70} size={48} />
                  <p className="text-[9px] text-muted-foreground mt-1">Trust Score</p>
                </div>
              </div>
            )}

            {/* Date & location */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-background rounded-xl border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600 mb-1.5">📅 Date</p>
                <p className="font-700 text-foreground text-sm">{event.event_date ? formatDate(event.event_date) : '—'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{event.duration}</p>
              </div>
              <div className="p-4 bg-background rounded-xl border border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600 mb-1.5">📍 Lieu</p>
                <p className="font-700 text-foreground text-sm">{event.location}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{event.country}</p>
              </div>
            </div>

            {/* Spots */}
            <div className="p-4 bg-background rounded-xl border border-border">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600">Places disponibles</p>
                <span className={`text-xs font-700 ${spotsLeft <= 2 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {event.status === 'full' ? 'Complet' : `${spotsLeft} place${spotsLeft > 1 ? 's' : ''} restante${spotsLeft > 1 ? 's' : ''}`}
                </span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${event.current_participants / event.max_participants >= 0.9 ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${(event.current_participants / event.max_participants) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{event.current_participants} / {event.max_participants} participants</p>
            </div>

            {/* Description */}
            {event.description && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600 mb-2">Description</p>
                <p className="text-sm text-foreground leading-relaxed">{event.description}</p>
              </div>
            )}

            {/* Kitty */}
            <div>
              <button
                onClick={() => setShowKitty((v) => !v)}
                className="w-full flex items-center justify-between p-4 bg-background rounded-xl border border-border hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon name="BanknotesIcon" size={16} className="text-primary" />
                  <span className="font-600 text-foreground">Cagnotte groupe</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-700 text-foreground">{event.shared_kitty}€ / {event.kitty_goal}€</span>
                  <Icon name={showKitty ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} className="text-muted-foreground" />
                </div>
              </button>
              <div className="mt-2 px-1">
                <div className="weight-gauge">
                  <div className="weight-gauge-fill" style={{ width: `${kittyPct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{kittyPct}% collecté</p>
              </div>
              {showKitty && event.expenses && event.expenses.length > 0 && (
                <div className="mt-3 space-y-2 p-4 bg-background rounded-xl border border-border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600 mb-2">Détail des dépenses</p>
                  {event.expenses.map((exp) => (
                    <div key={exp.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${exp.paid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="text-foreground">{exp.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-700 text-foreground">{exp.amount}€</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${exp.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {exp.paid ? 'Payé' : 'En attente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CTA */}
            <button
              onClick={handleToggle}
              disabled={registering || (event.status === 'full' && !event.is_registered)}
              className={`w-full py-3 rounded-xl text-sm font-700 transition-all ${
                event.status === 'full' && !event.is_registered ?'bg-muted text-muted-foreground cursor-not-allowed'
                  : event.is_registered
                  ? 'bg-secondary/10 text-secondary border border-secondary/30' :'btn-primary justify-center'
              }`}
            >
              {registering ? '...' : event.status === 'full' && !event.is_registered ? "Complet — Liste d'attente" : event.is_registered ? "✓ Inscrit — Se désinscrire" : "S'inscrire à la sortie"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventCard({ event, onToggleRegister, onViewDetail }: { event: Event; onToggleRegister: (eventId: string, isRegistered: boolean) => void; onViewDetail: (event: Event) => void }) {
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
      <button onClick={() => onViewDetail(event)} className="w-full relative aspect-[16/7] overflow-hidden block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={event.cover_image} alt={event.cover_alt} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
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
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2">
            <Icon name="EyeIcon" size={16} className="text-white" />
            <span className="text-white text-sm font-600">Voir les détails</span>
          </div>
        </div>
      </button>

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

        <p className="text-sm text-muted-foreground mb-4 leading-relaxed line-clamp-2">{event.description}</p>

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

        <div className="flex gap-2">
          <button
            onClick={() => onViewDetail(event)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          >
            <Icon name="EyeIcon" size={14} />
            Détails
          </button>
          <button
            onClick={handleToggle}
            disabled={registering || (event.status === 'full' && !event.is_registered)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-700 transition-all ${
              event.status === 'full' && !event.is_registered ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : event.is_registered
                ? 'bg-secondary/10 text-secondary border border-secondary/30' :'btn-primary justify-center'
            }`}
          >
            {registering ? '...' : event.status === 'full' && !event.is_registered ? "Complet" : event.is_registered ? "✓ Inscrit" : "S'inscrire"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EvenementsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('club_events')
      .select('*, organizer:user_profiles(full_name, trust_score), expenses:event_expenses(*)')
      .order('event_date', { ascending: true });

    let registeredIds: string[] = [];
    if (user) {
      const { data: regs } = await supabase.from('event_registrations').select('event_id').eq('user_id', user.id);
      registeredIds = regs?.map((r) => r.event_id) ?? [];
    }

    setEvents(((data ?? []) as Event[]).map((e) => ({ ...e, is_registered: registeredIds.includes(e.id) })));
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleToggleRegister = async (eventId: string, isRegistered: boolean) => {
    if (!user) { showToast('Connectez-vous pour vous inscrire'); return; }
    if (isRegistered) {
      await supabase.from('event_registrations').delete().eq('event_id', eventId).eq('user_id', user.id);
      await supabase.from('club_events').update({ participants_count: Math.max(0, (events.find(e => e.id === eventId)?.current_participants ?? 1) - 1) }).eq('id', eventId);
      showToast('Désinscription effectuée');
    } else {
      await supabase.from('event_registrations').upsert({ event_id: eventId, user_id: user.id }, { onConflict: 'event_id,user_id' });
      await supabase.from('club_events').update({ participants_count: (events.find(e => e.id === eventId)?.current_participants ?? 0) + 1 }).eq('id', eventId);
      showToast('Inscription confirmée !');
    }
    setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, is_registered: !isRegistered, current_participants: isRegistered ? Math.max(0, e.current_participants - 1) : e.current_participants + 1 } : e));
    if (selectedEvent?.id === eventId) {
      setSelectedEvent((prev) => prev ? { ...prev, is_registered: !isRegistered } : null);
    }
  };

  const filtered = events.filter((e) => {
    if (filterType !== 'all' && e.type !== filterType) return false;
    if (filterStatus !== 'all' && e.status !== filterStatus) return false;
    return true;
  });

  const upcomingCount = events.filter(e => e.status === 'upcoming').length;
  const liveCount = events.filter(e => e.status === 'live').length;

  return (
    <div className="min-h-screen" style={{ background: '#E7E3D6' }}>
      <Header />

      {/* ── Hero ── */}
      <section style={{ background: '#1C2620' }} className="pt-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")', backgroundRepeat: 'repeat', backgroundSize: '128px' }} />
        <div className="absolute bottom-0 left-0 w-[600px] h-[400px] rounded-full opacity-[0.05] pointer-events-none" style={{ background: 'radial-gradient(circle, #4A6741 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[10px] font-mono tracking-[0.25em] uppercase" style={{ color: '#E4501C' }}>Communauté</span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>
            <span className="text-[10px] font-mono tracking-[0.15em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Sorties & rassemblements</span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
            <div>
              <h1 className="font-display mb-4" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.02em', color: '#fff' }}>
                Partez ensemble,<br />
                <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.65)' }}>revenez transformés.</em>
              </h1>
              <p className="text-sm max-w-xl" style={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
                Sorties organisées, ateliers bushcraft, expéditions collectives — rejoignez des aventuriers qui partagent vos passions.
              </p>
            </div>

            <div className="flex flex-col gap-4 flex-shrink-0">
              <div className="flex items-center gap-6">
                {[
                  { value: upcomingCount.toString(), label: 'à venir' },
                  { value: liveCount.toString(), label: 'en direct' },
                  { value: events.length.toString(), label: 'total' },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="font-mono font-700 text-2xl" style={{ color: '#E4501C' }}>{s.value}</p>
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {user && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-700 transition-all"
                  style={{ background: '#E4501C', color: '#fff' }}
                >
                  <Icon name="PlusIcon" size={15} /> Organiser un événement
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Filters + Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'all', label: 'Tous les types' },
              { id: 'rando', label: '🥾 Randonnée' },
              { id: 'bushcraft', label: '🪓 Bushcraft' },
              { id: 'vanlife', label: '🚐 Vanlife' },
              { id: 'alpinisme', label: '🏔️ Alpinisme' },
              { id: 'photo', label: '📷 Photo' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className="px-4 py-2 rounded-xl text-sm font-600 transition-all"
                style={{
                  background: filterType === f.id ? '#1C2620' : '#fff',
                  color: filterType === f.id ? '#fff' : '#5C6B5E',
                  border: `1px solid ${filterType === f.id ? '#1C2620' : '#E8E4DA'}`,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            {[
              { id: 'all', label: 'Tous' },
              { id: 'upcoming', label: '📅 À venir' },
              { id: 'live', label: '🔴 En direct' },
              { id: 'past', label: '✓ Passés' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterStatus(f.id)}
                className="px-4 py-2 rounded-xl text-sm font-600 transition-all"
                style={{
                  background: filterStatus === f.id ? '#4A6741' : '#fff',
                  color: filterStatus === f.id ? '#fff' : '#5C6B5E',
                  border: `1px solid ${filterStatus === f.id ? '#4A6741' : '#E8E4DA'}`,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Events grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-72 rounded-2xl animate-pulse" style={{ background: 'rgba(200,195,176,0.4)' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📅</p>
            <h2 className="font-display font-700 text-xl text-[#1C2620] mb-2">Aucun événement</h2>
            <p className="text-sm text-[#5C6B5E]">Essayez d&apos;autres filtres ou organisez le premier événement !</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((event) => {
              const cfg = typeConfig[event.type] ?? { color: 'bg-gray-100 text-gray-700', label: event.type };
              const spotsLeft = event.max_participants - event.current_participants;
              return (
                <div
                  key={event.id}
                  className="rounded-2xl overflow-hidden cursor-pointer group transition-all"
                  style={{ background: '#fff', border: '1px solid #E8E4DA', boxShadow: '0 1px 3px rgba(28,38,32,0.04)' }}
                  onClick={() => setSelectedEvent(event)}
                >
                  {/* Cover */}
                  <div className="relative h-44 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={event.cover_image} alt={event.cover_alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className={`text-[10px] font-700 px-2.5 py-1 rounded-full ${cfg.color}`}>{event.emoji} {cfg.label}</span>
                      {event.status === 'live' && <span className="text-[10px] font-700 px-2.5 py-1 rounded-full bg-red-100 text-red-700 animate-pulse">🔴 Live</span>}
                      {event.status === 'full' && <span className="text-[10px] font-700 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">Complet</span>}
                    </div>
                    {event.is_registered && (
                      <div className="absolute top-3 right-3">
                        <span className="text-[10px] font-700 px-2.5 py-1 rounded-full bg-emerald-500 text-white">✓ Inscrit</span>
                      </div>
                    )}
                    <div className="absolute bottom-3 left-4 right-4">
                      <h3 className="font-display font-700 text-white text-base leading-tight line-clamp-2">{event.title}</h3>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <div className="flex items-center gap-3 text-xs text-[#5C6B5E] mb-3">
                      <span className="flex items-center gap-1"><Icon name="MapPinIcon" size={11} /> {event.location}</span>
                      <span className="flex items-center gap-1"><Icon name="ClockIcon" size={11} /> {event.duration}</span>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 text-xs text-[#5C6B5E]">
                        <Icon name="UsersIcon" size={12} />
                        <span>{event.current_participants}/{event.max_participants}</span>
                        {spotsLeft <= 3 && spotsLeft > 0 && <span className="text-red-500 font-600">({spotsLeft} restante{spotsLeft > 1 ? 's' : ''})</span>}
                      </div>
                      {event.event_date && (
                        <span className="text-[10px] font-mono font-600 text-[#1C2620]">
                          {new Date(event.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="h-1 rounded-full overflow-hidden mb-4" style={{ background: '#E8E4DA' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(event.current_participants / event.max_participants) * 100}%`,
                          background: event.current_participants / event.max_participants >= 0.9 ? '#ef4444' : '#4A6741',
                        }}
                      />
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleRegister(event.id, !!event.is_registered); }}
                      disabled={event.status === 'full' && !event.is_registered}
                      className="w-full py-2.5 rounded-xl text-sm font-700 transition-all disabled:opacity-50"
                      style={{
                        background: event.is_registered ? 'rgba(74,103,65,0.1)' : event.status === 'full' ? '#E8E4DA' : '#1C2620',
                        color: event.is_registered ? '#4A6741' : event.status === 'full' ? '#5C6B5E' : '#fff',
                        border: event.is_registered ? '1px solid rgba(74,103,65,0.3)' : 'none',
                      }}
                    >
                      {event.is_registered ? '✓ Inscrit — Se désinscrire' : event.status === 'full' ? 'Complet' : 'S\'inscrire'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event detail modal */}
      <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} onToggleRegister={handleToggleRegister} />

      {/* Create event modal placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-2xl w-full max-w-md p-6" style={{ background: '#EDEAE0', border: '1px solid #C8C3B0' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-700 text-[#1C2620] text-xl">Organiser un événement</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-xl hover:bg-[#C8C3B0]/40 transition-colors"><Icon name="XMarkIcon" size={18} /></button>
            </div>
            <p className="text-sm text-[#5C6B5E] mb-4">Pour organiser un événement, vous devez avoir un Trust Score minimum de {100}.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 py-2.5 rounded-xl border border-[#C8C3B0] text-sm font-600 text-[#5C6B5E]">Fermer</button>
              <Link href="/profil" className="flex-1 py-2.5 rounded-xl text-sm font-700 text-center transition-all" style={{ background: '#E4501C', color: '#fff' }}>Mon profil</Link>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-600 shadow-xl" style={{ background: '#1C2620', color: '#fff' }}>
          {toast}
        </div>
      )}
    </div>
  );
}