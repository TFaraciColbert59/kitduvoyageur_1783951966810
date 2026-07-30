'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
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

const mobileTypeColors: Record<string, string> = {
  rando: '#065f46',
  bushcraft: '#44403c',
  vanlife: '#92400e',
  alpinisme: '#334155',
  photo: '#6d28d9',
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

function MobileEventCard({ event, onToggleRegister, onViewDetail }: { event: Event; onToggleRegister: (eventId: string, isRegistered: boolean) => void; onViewDetail: (event: Event) => void }) {
  const [registering, setRegistering] = useState(false);
  const spotsLeft = event.max_participants - event.current_participants;
  const typeBg = mobileTypeColors[event.type] || '#6b7280';

  const formatDate = (d: string) => {
    const [_y, m, day] = d.split('-');
    const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
    return `${parseInt(day)} ${months[parseInt(m) - 1]}`;
  };

  const handleToggle = async () => {
    setRegistering(true);
    await onToggleRegister(event.id, !!event.is_registered);
    setRegistering(false);
  };

  return (
    <div style={{ background: '#F4F1EA', border: '1px solid rgba(11,31,23,0.06)', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
      <button onClick={() => onViewDetail(event)} style={{ width: '100%', position: 'relative', height: '160px', overflow: 'hidden', display: 'block', border: 'none', padding: 0, cursor: 'pointer' }}>
        <img src={event.cover_image} alt={event.cover_alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />
        <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '4px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: typeBg, color: '#fff' }}>
            {event.emoji} {typeConfig[event.type]?.label || event.type}
          </span>
          {event.status === 'full' && (
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#ef4444', color: '#fff' }}>Complet</span>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: '12px', left: '12px', right: '12px', textAlign: 'left' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 2px 0', lineHeight: 1.2 }}>{event.title}</h3>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>{event.location} · {event.duration}</p>
        </div>
      </button>
      <div style={{ padding: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <div style={{ flex: 1, padding: '8px', background: '#FBFAF6', borderRadius: '8px', border: '1px solid rgba(11,31,23,0.06)' }}>
            <p style={{ fontSize: '9px', color: '#6B7A72', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: '0 0 2px 0' }}>Date</p>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#1C2620', margin: 0 }}>{formatDate(event.event_date)}</p>
          </div>
          <div style={{ flex: 1, padding: '8px', background: '#FBFAF6', borderRadius: '8px', border: '1px solid rgba(11,31,23,0.06)' }}>
            <p style={{ fontSize: '9px', color: '#6B7A72', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: '0 0 2px 0' }}>Places</p>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#1C2620', margin: 0 }}>{event.current_participants}/{event.max_participants}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onViewDetail(event)}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: '1px solid rgba(11,31,23,0.06)', background: '#FBFAF6', color: '#6B7A72', cursor: 'pointer' }}>
            Details
          </button>
          <button onClick={handleToggle}
            disabled={registering || (event.status === 'full' && !event.is_registered)}
            style={{
              flex: 1, padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: registering ? 'default' : 'pointer',
              background: event.status === 'full' && !event.is_registered ? '#E8E4D8' : event.is_registered ? '#EDF3ED' : '#17402C',
              color: event.status === 'full' && !event.is_registered ? '#6B7A72' : event.is_registered ? '#17402C' : '#fff',
            }}>
            {registering ? '...' : event.status === 'full' && !event.is_registered ? "Complet" : event.is_registered ? "✓ Inscrit" : "S'inscrire"}
          </button>
        </div>
      </div>
    </div>
  );
}

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

  const desktopContent = (
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
          <div className="flex items-center gap-1 py-3 overflow-x-auto scrollbar-hide">
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
                {filtered.map((e) => <EventCard key={e.id} event={e} onToggleRegister={handleToggleRegister} onViewDetail={(event) => setDetailEvent(event)} />)}
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
  );

  const mobileContent = (
    <div style={{ padding: '16px' }}>
      {/* Hero */}
      <div style={{ background: '#0B1F17', color: '#fff', borderRadius: '12px', padding: '20px', marginBottom: '16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(45,107,74,0.15)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: 'rgba(163,196,163,0.2)', color: '#A3C4A3', border: '1px solid rgba(163,196,163,0.3)' }}>COMMUNAUTE</span>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontFamily: 'ui-monospace, monospace' }}>EVENEMENTS</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: '#fff', margin: '0 0 4px 0' }}>
          Sorties organisees
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
          Par des membres verifies avec Trust Score et cagnotte integree.
        </p>
        <button onClick={() => setShowCreateModal(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#17402C', color: '#fff', borderRadius: '8px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          + Organiser une sortie
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px', scrollbarWidth: 'none' }}>
        {[
          { id: 'all', label: 'Toutes' },
          { id: 'rando', label: '🥾 Rando' },
          { id: 'bushcraft', label: '🪓 Bushcraft' },
          { id: 'vanlife', label: '🚐 Vanlife' },
          { id: 'alpinisme', label: '⛏️ Alpi' },
        ].map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer',
              background: filter === f.id ? '#17402C' : '#F4F1EA',
              color: filter === f.id ? '#fff' : '#6B7A72',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '13px', marginBottom: '12px' }}>{error}</div>
      )}

      {/* Events list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid rgba(11,31,23,0.1)', borderTopColor: '#17402C', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#6B7A72' }}>
          <p style={{ fontSize: '36px', marginBottom: '8px' }}>📅</p>
          <p style={{ fontWeight: 700, fontSize: '16px', color: '#1C2620', marginBottom: '4px' }}>Aucun evenement</p>
          <p style={{ fontSize: '13px' }}>Soyez le premier a organiser une sortie !</p>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: '#1C2620', margin: 0 }}>Prochaines sorties</h2>
            <span style={{ fontSize: '13px', color: '#6B7A72' }}>{filtered.length} evenements</span>
          </div>
          {filtered.map((e) => <MobileEventCard key={e.id} event={e} onToggleRegister={handleToggleRegister} onViewDetail={(event) => setDetailEvent(event)} />)}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ── DESKTOP ── */}
      <div className="hidden md:block">
        <main className="min-h-screen bg-background">
          <Header />
          {desktopContent}
          <Footer />
        </main>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          {mobileContent}
        </MobilePageShell>
        
      </div>

      {/* Shared: Create event modal */}
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

      {/* Shared: Event Detail Modal */}
      <EventDetailModal
        event={detailEvent}
        onClose={() => setDetailEvent(null)}
        onToggleRegister={(eventId, isRegistered) => {
          handleToggleRegister(eventId, isRegistered);
          setDetailEvent((prev) => prev ? { ...prev, is_registered: !isRegistered, current_participants: isRegistered ? prev.current_participants - 1 : prev.current_participants + 1 } : null);
        }}
      />
    </>
  );
}

export const dynamic = 'force-dynamic';
