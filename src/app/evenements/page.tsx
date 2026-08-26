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
  rando: { color: 'glass-pill', label: 'Randonnée' },
  bushcraft: { color: 'glass-pill', label: 'Bushcraft' },
  vanlife: { color: 'glass-pill pill-warn', label: 'Vanlife' },
  alpinisme: { color: 'glass-pill pill-info', label: 'Alpinisme' },
  photo: { color: 'glass-pill pill-info', label: 'Photo' },
};

const mobileTypeColors: Record<string, string> = {
  rando: '#365233',
  bushcraft: '#5A7064',
  vanlife: '#8C6418',
  alpinisme: '#4B6B7C',
  photo: '#4B6B7C',
};

function TrustRing({ score, size = 36 }: { score: number; size?: number }) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 90 ? '#5B7F55' : score >= 75 ? '#4B6B7C' : score >= 60 ? '#C89A3B' : '#A8443A';
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

  const cfg = typeConfig[event.type] ?? { color: 'glass-pill', label: event.type };
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
      <div className="glass rounded-2xl w-full max-w-2xl my-4 overflow-hidden">
        {/* Cover */}
        <div className="relative h-56 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={event.cover_image || '/assets/images/no_image.png'} alt={event.cover_alt} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-sm rounded-xl hover:bg-black/60 transition-colors">
            <Icon name="XMarkIcon" size={18} className="text-white" />
          </button>
          <div className="absolute top-4 left-4 flex gap-2">
            <span className={`text-[10px] font-700 px-2.5 py-1 rounded-full ${cfg.color}`}>{event.emoji} {cfg.label}</span>
            {event.status === 'full' && <span className="glass-pill pill-danger">Complet</span>}
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
              <div className="flex items-center gap-4 p-4 glass-sub-card rounded-xl">
                <div className="w-12 h-12 rounded-xl bg-sage-700 text-white flex items-center justify-center text-lg font-700 flex-shrink-0">
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
              <div className="p-4 glass-sub-card rounded-xl">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600 mb-1.5">📅 Date</p>
                <p className="font-700 text-foreground text-sm">{event.event_date ? formatDate(event.event_date) : '—'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{event.duration}</p>
              </div>
              <div className="p-4 glass-sub-card rounded-xl">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600 mb-1.5">📍 Lieu</p>
                <p className="font-700 text-foreground text-sm">{event.location}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{event.country}</p>
              </div>
            </div>

            {/* Spots */}
            <div className="p-4 glass-sub-card rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600">Places disponibles</p>
                <span className={`text-xs font-700 ${spotsLeft <= 2 ? 'text-[#A8443A]' : 'text-[#5B7F55]'}`}>
                  {event.status === 'full' ? 'Complet' : `${spotsLeft} place${spotsLeft > 1 ? 's' : ''} restante${spotsLeft > 1 ? 's' : ''}`}
                </span>
              </div>
              <div className="glass-progress h-2">
                <div
                  className={`glass-progress-fill h-full ${event.current_participants / event.max_participants >= 0.9 ? 'critical' : 'success'}`}
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
                className="w-full flex items-center justify-between p-4 glass-sub-card rounded-xl hover:border-[#5B7F55]/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon name="BanknotesIcon" size={16} className="text-[#5B7F55]" />
                  <span className="font-600 text-foreground">Cagnotte groupe</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-700 text-foreground">{event.shared_kitty}€ / {event.kitty_goal}€</span>
                  <Icon name={showKitty ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} className="text-muted-foreground" />
                </div>
              </button>
              <div className="mt-2 px-1">
                <div className="glass-progress">
                  <div className="glass-progress-fill" style={{ width: `${kittyPct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{kittyPct}% collecté</p>
              </div>
              {showKitty && event.expenses && event.expenses.length > 0 && (
                <div className="mt-3 space-y-2 p-4 glass-sub-card rounded-xl">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600 mb-2">Détail des dépenses</p>
                  {event.expenses.map((exp) => (
                    <div key={exp.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${exp.paid ? 'bg-[#5B7F55]' : 'bg-[#C89A3B]'}`} />
                        <span className="text-foreground">{exp.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-700 text-foreground">{exp.amount}€</span>
                        <span className={`glass-pill ${exp.paid ? '' : 'pill-warn'}`}>
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
              className={`w-full glass-capsule-btn ${
                event.status === 'full' && !event.is_registered ? 'secondary opacity-50 cursor-not-allowed'
                  : event.is_registered ? 'secondary' : 'primary'
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
  const cfg = typeConfig[event.type] ?? { color: 'glass-pill', label: event.type };
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
    <div className="glass overflow-hidden">
      <button onClick={() => onViewDetail(event)} className="w-full relative aspect-[16/7] overflow-hidden block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={event.cover_image || '/assets/images/no_image.png'} alt={event.cover_alt} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${cfg.color}`}>
            {event.emoji} {cfg.label}
          </span>
          {event.status === 'full' && (
            <span className="glass-pill pill-danger">Complet</span>
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
          <div className="flex items-center gap-3 mb-4 p-3 glass-sub-card rounded-xl">
            <div className="w-9 h-9 rounded-xl bg-sage-700 text-white flex items-center justify-center text-sm font-700 flex-shrink-0">
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
          <div className="glass-sub-card rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600 mb-1">Date</p>
            <p className="font-display font-700 text-foreground text-sm">{formatDate(event.event_date)}</p>
            <p className="text-xs text-muted-foreground">{event.duration}</p>
          </div>
          <div className="glass-sub-card rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-600 mb-1">Places</p>
            <p className="font-display font-700 text-foreground text-sm">{event.current_participants}/{event.max_participants}</p>
            <p className={`text-xs ${spotsLeft <= 2 ? 'text-[#A8443A]' : 'text-muted-foreground'}`}>
              {event.status === 'full' ? 'Complet' : `${spotsLeft} place${spotsLeft > 1 ? 's' : ''} restante${spotsLeft > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Group kitty */}
        <div className="mb-4">
          <button
            onClick={() => setShowKitty((v) => !v)}
            className="w-full flex items-center justify-between p-3 glass-sub-card rounded-xl hover:border-[#5B7F55]/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Icon name="BanknotesIcon" size={14} className="text-[#5B7F55]" />
              <span className="text-sm font-600 text-foreground">Cagnotte groupe</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-700 text-foreground">{event.shared_kitty}€ / {event.kitty_goal}€</span>
              <Icon name={showKitty ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} className="text-muted-foreground" />
            </div>
          </button>
          <div className="mt-2 px-1">
            <div className="glass-progress">
              <div className="glass-progress-fill" style={{ width: `${kittyPct}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{kittyPct}% collecté</p>
          </div>
          {showKitty && event.expenses && (
            <div className="mt-3 space-y-2 p-3 glass-sub-card rounded-xl">
              {event.expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${exp.paid ? 'bg-[#5B7F55]' : 'bg-[#C89A3B]'}`} />
                    <span className="text-foreground">{exp.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-700 text-foreground">{exp.amount}€</span>
                    <span className={`glass-pill ${exp.paid ? '' : 'pill-warn'}`}>
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
            className="flex items-center gap-2 px-4 py-2.5 glass-capsule-btn secondary text-sm"
          >
            <Icon name="EyeIcon" size={14} />
            Détails
          </button>
          <button
            onClick={handleToggle}
            disabled={registering || (event.status === 'full' && !event.is_registered)}
            className={`flex-1 glass-capsule-btn text-sm ${
              event.status === 'full' && !event.is_registered ? 'secondary opacity-50 cursor-not-allowed'
                : event.is_registered ? 'secondary' : 'primary'
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
  const typeBg = mobileTypeColors[event.type] || '#5A7064';

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
    <div style={{ background: '#FBFAF6', border: '1px solid rgba(23,64,44,0.10)', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
      <button onClick={() => onViewDetail(event)} style={{ width: '100%', position: 'relative', height: '160px', overflow: 'hidden', display: 'block', border: 'none', padding: 0, cursor: 'pointer' }}>
        <img src={event.cover_image || '/assets/images/no_image.png'} alt={event.cover_alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />
        <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '4px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: typeBg, color: '#fff' }}>
            {event.emoji} {typeConfig[event.type]?.label || event.type}
          </span>
          {event.status === 'full' && (
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#A8443A', color: '#fff' }}>Complet</span>
          )}
        </div>
        <div style={{ position: 'absolute', bottom: '12px', left: '12px', right: '12px', textAlign: 'left' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: '0 0 2px 0', lineHeight: 1.2 }}>{event.title}</h3>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>{event.location} · {event.duration}</p>
        </div>
      </button>
      <div style={{ padding: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <div style={{ flex: 1, padding: '8px', background: '#FAF8F5', borderRadius: '8px', border: '1px solid rgba(23,64,44,0.10)' }}>
            <p style={{ fontSize: '9px', color: '#5A7064', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: '0 0 2px 0' }}>Date</p>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#17402C', margin: 0 }}>{formatDate(event.event_date)}</p>
          </div>
          <div style={{ flex: 1, padding: '8px', background: '#FAF8F5', borderRadius: '8px', border: '1px solid rgba(23,64,44,0.10)' }}>
            <p style={{ fontSize: '9px', color: '#5A7064', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, margin: '0 0 2px 0' }}>Places</p>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#17402C', margin: 0 }}>{event.current_participants}/{event.max_participants}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onViewDetail(event)}
            style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, border: '1px solid rgba(23,64,44,0.10)', background: '#FAF8F5', color: '#5A7064', cursor: 'pointer' }}>
            Details
          </button>
          <button onClick={handleToggle}
            disabled={registering || (event.status === 'full' && !event.is_registered)}
            style={{
              flex: 1, padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: registering ? 'default' : 'pointer',
              background: event.status === 'full' && !event.is_registered ? '#E8E4D8' : event.is_registered ? '#E1EBDE' : '#17402C',
              color: event.status === 'full' && !event.is_registered ? '#5A7064' : event.is_registered ? '#17402C' : '#fff',
            }}>
            {registering ? '...' : event.status === 'full' && !event.is_registered ? "Complet" : event.is_registered ? "✓ Inscrit" : "S'inscrire"}
          </button>
        </div>
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
  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
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

  const desktopContent = (
    <div className="pt-16 lg:pt-18">
      <section className="bg-dark-bg text-white py-14 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-secondary blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto relative">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-white/10 border border-white/20 text-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-700 tracking-widest uppercase">COMMUNAUTÉ</span>
            <span className="text-white/50 text-xs font-mono">ÉVÉNEMENTS & SORTIES</span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <h1 className="text-section-title text-white mb-3">
                Sorties organisées<br />
                <span className="text-[#A6C1A0]">par des membres vérifiés</span>
              </h1>
              <p className="text-white/60 text-base max-w-xl">
                Chaque organisateur affiche son Trust Score avant votre inscription. Cagnotte de groupe intégrée, location de matériel partagée.
              </p>
            </div>
            <button onClick={() => setShowCreateModal(true)} className="glass-capsule-btn primary flex-shrink-0 self-start lg:self-auto">
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
                className={`glass-pill flex-shrink-0 cursor-pointer ${filter === f.id ? '!bg-[#17402C] !text-white !border-[#17402C]' : ''}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-10">
        {error && <div className="mb-6 p-4 bg-[#A8443A]/10 border border-[#A8443A]/30 rounded-xl text-[#A8443A] text-sm">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-700 text-foreground text-xl">Prochaines sorties</h2>
              <p className="text-sm text-muted-foreground">{filtered.length} événements</p>
            </div>
            {loading ? (
              <div className="space-y-6">
                {[1, 2].map((i) => <div key={i} className="glass h-96 animate-pulse bg-muted" />)}
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
            <div className="glass p-5">
              <h3 className="font-display font-700 text-foreground text-base mb-3 flex items-center gap-2">
                <Icon name="ShieldCheckIcon" size={16} className="text-[#5B7F55]" />
                Trust Score & sécurité
              </h3>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                Le Trust Score de l&apos;organisateur est visible avant toute inscription. Un score élevé signifie des évaluations positives d&apos;événements précédents.
              </p>
              <div className="space-y-2">
                {[
                  { score: '90+', label: 'Ambassadeur — Organisateur confirmé', color: 'text-[#5B7F55]' },
                  { score: '75–89', label: 'Expert — Plusieurs sorties réussies', color: 'text-[#4B6B7C]' },
                  { score: '60–74', label: 'Confirmé — Premières sorties', color: 'text-[#8C6418]' },
                ].map((s) => (
                  <div key={s.score} className="flex items-center gap-2 text-xs">
                    <span className={`font-mono font-700 ${s.color} w-12`}>{s.score}</span>
                    <span className="text-muted-foreground">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass p-5">
              <h3 className="font-display font-700 text-foreground text-base mb-3 flex items-center gap-2">
                <Icon name="BanknotesIcon" size={16} className="text-[#5B7F55]" />
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
      <div style={{ background: '#17402C', color: '#fff', borderRadius: '12px', padding: '20px', marginBottom: '16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(23,64,44,0.30)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: 'rgba(166,193,160,0.2)', color: '#A6C1A0', border: '1px solid rgba(166,193,160,0.3)' }}>COMMUNAUTE</span>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontFamily: 'ui-monospace, monospace' }}>EVENEMENTS</span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '20px', color: '#fff', margin: '0 0 4px 0' }}>
          Sorties organisees
        </h1>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
          Par des membres verifies avec Trust Score et cagnotte integree.
        </p>
        <button onClick={() => setShowCreateModal(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#365233', color: '#fff', borderRadius: '8px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
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
              background: filter === f.id ? '#17402C' : '#FAF8F5',
              color: filter === f.id ? '#fff' : '#5A7064',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px', background: 'rgba(168,68,58,0.10)', border: '1px solid rgba(168,68,58,0.30)', borderRadius: '10px', color: '#8A241B', fontSize: '13px', marginBottom: '12px' }}>{error}</div>
      )}

      {/* Events list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '2px solid rgba(23,64,44,0.12)', borderTopColor: '#17402C', animation: 'lkdv-spin 0.8s linear infinite' }} />
          <style jsx>{`
            @keyframes lkdv-spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#5A7064' }}>
          <p style={{ fontSize: '36px', marginBottom: '8px' }}>📅</p>
          <p style={{ fontWeight: 700, fontSize: '16px', color: '#17402C', marginBottom: '4px' }}>Aucun evenement</p>
          <p style={{ fontSize: '13px' }}>Soyez le premier a organiser une sortie !</p>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: '#17402C', margin: 0 }}>Prochaines sorties</h2>
            <span style={{ fontSize: '13px', color: '#5A7064' }}>{filtered.length} evenements</span>
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
        <main className="h-dvh overflow-hidden bg-background flex flex-col">
          <Header />
          <div className="flex-1 min-h-0 overflow-y-auto">
            {desktopContent}
          </div>
          <Footer />
        </main>
      </div>

      {/* ── MOBILE ── */}
      <div className="block md:hidden">
        <MobilePageShell>
          {mobileContent}
          <div style={{ height: 'calc(62px + 12px + 12px + env(safe-area-inset-bottom))' }} />
        </MobilePageShell>
      </div>

      {/* Shared: Create event modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass rounded-2xl p-6 max-w-lg w-full my-4">
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
                  <input className="glass-input w-full" placeholder="Ex: Traversée GR20" value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Type</label>
                    <select className="glass-input w-full" value={createForm.type} onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value }))}>
                      <option value="rando">🥾 Randonnée</option>
                      <option value="bushcraft">🪓 Bushcraft</option>
                      <option value="vanlife">🚐 Vanlife</option>
                      <option value="alpinisme">⛏️ Alpinisme</option>
                      <option value="photo">📷 Photo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Date</label>
                    <input type="date" className="glass-input w-full" value={createForm.event_date} onChange={(e) => setCreateForm((f) => ({ ...f, event_date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Durée</label>
                    <input className="glass-input w-full" placeholder="Ex: 3 jours" value={createForm.duration} onChange={(e) => setCreateForm((f) => ({ ...f, duration: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Participants max</label>
                    <input type="number" min={2} max={50} className="glass-input w-full" value={createForm.max_participants} onChange={(e) => setCreateForm((f) => ({ ...f, max_participants: parseInt(e.target.value) || 10 }))} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Lieu</label>
                  <input className="glass-input w-full" placeholder="Ex: Pyrénées, Cauterets" value={createForm.location} onChange={(e) => setCreateForm((f) => ({ ...f, location: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Description</label>
                  <textarea rows={3} className="glass-input w-full resize-none" placeholder="Décrivez la sortie..." value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Objectif cagnotte (€)</label>
                  <input type="number" min={0} className="glass-input w-full" placeholder="0" value={createForm.kitty_goal} onChange={(e) => setCreateForm((f) => ({ ...f, kitty_goal: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowCreateModal(false)} className="flex-1 glass-capsule-btn secondary text-sm">Annuler</button>
                  <button onClick={handleCreateEvent} disabled={creating || !createForm.title.trim() || !createForm.event_date} className="flex-1 glass-capsule-btn primary text-sm disabled:opacity-50">
                    {creating ? 'Création...' : 'Créer la sortie'}
                  </button>
                </div>
              </div>
            )}
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
