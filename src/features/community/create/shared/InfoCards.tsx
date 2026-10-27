'use client';

import React from 'react';
import { Globe2, Users, Lock, Image, Type, Link2, Mountain, Tent, Snowflake, Bike, Waves, ShieldCheck } from 'lucide-react';
import './info-cards.css';

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
function txt(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

const AUDIENCES = [
  { id: 'public', label: 'Tout le monde', hint: 'Visible dans le fil public', icon: Globe2 },
  { id: 'abonnies', label: 'Abonnés', hint: 'Seulement tes abonnés', icon: Users },
  { id: 'club', label: 'Club', hint: 'Membres du club choisi', icon: Lock },
];

export function AudienceLens({ value }: { value: string }) {
  return (
    <div className="lkdv-info-lens" aria-label="Qui peut voir">
      {AUDIENCES.map(({ id, label, hint, icon: Icon }) => (
        <span key={id} className="lkdv-info-lens-row" data-active={value === id || (id === 'public' && !value)}>
          <Icon size={14} aria-hidden="true" />
          <span><b>{label}</b><small>{hint}</small></span>
        </span>
      ))}
    </div>
  );
}

export function StoryLayerStack({ values }: { values: unknown }) {
  const v = rec(values);
  const layers = [
    { id: 'media', label: 'Média', value: arr(v.media).length > 0 ? 'Prêt' : 'À choisir', icon: Image },
    { id: 'text', label: 'Texte', value: txt(v.overlayText) || txt(v.caption) || 'Aucun texte', icon: Type },
    { id: 'link', label: 'Lien', value: txt(v.overlayLink) || 'Aucun lien', icon: Link2 },
  ];
  return (
    <div className="lkdv-story-layers" aria-label="Calques de la story">
      {layers.map(({ id, label, value, icon: Icon }) => (
        <span key={id} className="lkdv-story-layer">
          <Icon size={13} aria-hidden="true" />
          <span><b>{label}</b><small>{value}</small></span>
        </span>
      ))}
    </div>
  );
}

export function RouteMetrics({ values }: { values: unknown }) {
  const v = rec(values);
  const km = num(v.distanceKm);
  const dplus = num(v.deniveleM);
  return (
    <div className="lkdv-route-metrics" aria-label="Métriques de l’itinéraire">
      <span className="lkdv-route-metric">
        <small>Distance</small><b>{km > 0 ? `${km} km` : '—'}</b>
        <i aria-hidden="true"><em style={{ width: `${Math.min(100, km / 2)}%` }} /></i>
      </span>
      <span className="lkdv-route-metric">
        <small>Dénivelé</small><b>{dplus > 0 ? `${dplus} m D+` : '—'}</b>
        <i aria-hidden="true"><em style={{ width: `${Math.min(100, dplus / 30)}%` }} /></i>
      </span>
    </div>
  );
}

const ACTIVITIES = [
  { id: 'rando', label: 'Rando', icon: Mountain },
  { id: 'bivouac', label: 'Bivouac', icon: Tent },
  { id: 'alpinisme', label: 'Alpinisme', icon: Snowflake },
  { id: 'velo', label: 'Vélo', icon: Bike },
  { id: 'eau', label: 'Eau', icon: Waves },
  { id: 'ski', label: 'Ski', icon: Snowflake },
];

export function ActivityCards({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <div className="lkdv-activity-cards" role="group" aria-label="Type de sortie">
      {ACTIVITIES.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>
          <Icon size={14} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

export function ClubRulesLedger({ values }: { values: unknown }) {
  const v = rec(values);
  const rules = txt(v.membershipRules);
  const questions = arr(v.joinQuestions).filter((item) => txt(item)).length;
  const privacy = txt(v.privacy) || 'open';
  return (
    <div className="lkdv-club-ledger" aria-label="Règles et adhésion">
      <span><ShieldCheck size={14} aria-hidden="true" /><b>{privacy === 'open' ? 'Ouvert' : 'Sur validation'}</b><small>Adhésion</small></span>
      <span><Type size={14} aria-hidden="true" /><b>{rules ? `${rules.length}` : '—'}</b><small>Caractères de règles</small></span>
      <span><Users size={14} aria-hidden="true" /><b>{questions || '—'}</b><small>Questions</small></span>
    </div>
  );
}
