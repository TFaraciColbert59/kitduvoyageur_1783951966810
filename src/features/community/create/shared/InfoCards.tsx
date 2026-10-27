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
      <svg className="lkdv-altitude-profile" viewBox="0 0 120 22" aria-hidden="true">
        <path d={`M0 20 L12 ${18 - Math.min(12, dplus / 220)} L28 ${16 - Math.min(12, dplus / 300)} L44 ${19 - Math.min(10, dplus / 420)} L62 ${10 - Math.min(8, dplus / 600)} L82 ${14 - Math.min(10, dplus / 380)} L102 ${6 - Math.min(5, dplus / 900)} L120 12`} />
      </svg>
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

const LEVELS = [
  { id: 'facile', label: 'Facile', hint: 'Accessible' },
  { id: 'moyen', label: 'Moyen', hint: 'Soutenu' },
  { id: 'difficile', label: 'Difficile', hint: 'Engagé' },
];

export function DifficultyLadder({ value }: { value: string }) {
  return (
    <div className="lkdv-difficulty" role="img" aria-label={`Niveau ${value}`}>
      {LEVELS.map((item, index) => (
        <span key={item.id} data-active={item.id === value} data-level={index}>
          <i aria-hidden="true" />
          <b>{item.label}</b>
          <small>{item.hint}</small>
        </span>
      ))}
    </div>
  );
}

export function CapacityGauge({ max, waitlist }: { max: number; waitlist: boolean }) {
  return (
    <div className="lkdv-capacity" aria-label="Capacité de la sortie">
      <div className="lkdv-capacity-head"><b>0 / {max}</b><span>places</span></div>
      <div className="lkdv-capacity-track" aria-hidden="true"><i style={{ width: '4%' }} /></div>
      <div className="lkdv-capacity-foot">
        <span>{max} places ouvertes</span>
        <span data-on={waitlist}>{waitlist ? 'Liste d’attente activée' : 'Sans liste d’attente'}</span>
      </div>
    </div>
  );
}

export function KitPackingMatrix({ selected, custom, score }: { selected: number; custom: number; score: number }) {
  return (
    <div className="lkdv-packing" aria-label="Matrice de portage">
      <span><b>{selected}</b><small>Inventaire</small></span>
      <span><b>{custom}</b><small>Objets custom</small></span>
      <span><b>{score}%</b><small>Complétude</small></span>
    </div>
  );
}

export function ClubModeCards({ value }: { value: string }) {
  return (
    <div className="lkdv-club-modes" aria-label="Mode d’adhésion">
      <span data-active={value !== 'closed'}><b>Ouvert</b><small>On rejoint en un geste</small></span>
      <span data-active={value === 'closed'}><b>Sur validation</b><small>Chaque demande est validée</small></span>
    </div>
  );
}

export function CaptionRuler({ value, max }: { value: string; max: number }) {
  const used = Math.min(max, value.length);
  const percent = Math.round((used / max) * 100);
  return (
    <div className="lkdv-caption-ruler" aria-label={`${used} caractères sur ${max}`}>
      <span>{used}/{max}</span>
      <i aria-hidden="true"><em style={{ width: `${percent}%` }} /></i>
    </div>
  );
}

export function StorySpecimen({ caption, overlay }: { caption: string; overlay: string }) {
  const items = [
    { label: 'Légende', value: caption || 'Aucune légende' },
    { label: 'Titre', value: overlay || 'Aucun texte' },
    { label: 'Citation', value: overlay ? `« ${overlay} »` : 'Aucune citation' },
  ];
  return (
    <div className="lkdv-story-specimen" aria-label="Styles de texte Story">
      {items.map((item) => (
        <span key={item.label}><small>{item.label}</small><b>{item.value}</b></span>
      ))}
    </div>
  );
}

export function CarnetStageSpine({ from, to, km, dplus }: { from: string; to: string; km: number; dplus: number }) {
  return (
    <div className="lkdv-carnet-spine" aria-label="Étapes du carnet">
      <span className="lkdv-carnet-stage"><i aria-hidden="true" /><small>Départ</small><b>{from || 'À définir'}</b></span>
      <span className="lkdv-carnet-stage-line" aria-hidden="true"><em>{km > 0 ? `${km} km` : '—'}</em><i>{dplus > 0 ? `${dplus} m D+` : ''}</i></span>
      <span className="lkdv-carnet-stage"><i aria-hidden="true" /><small>Arrivée</small><b>{to || 'À définir'}</b></span>
    </div>
  );
}

export function CarnetLogistics({ nights, travelers, weather, rating }: { nights: number; travelers: number; weather: string; rating: number }) {
  return (
    <div className="lkdv-logistics" aria-label="Logistique du carnet">
      <span><b>{nights || '—'}</b><small>Nuits</small></span>
      <span><b>{travelers || '—'}</b><small>Voyageurs</small></span>
      <span><b>{weather || '—'}</b><small>Météo</small></span>
      <span><b>{rating ? `${rating}/5` : '—'}</b><small>Note</small></span>
    </div>
  );
}

export function SafetyManifest({ notes, level, places, waitlist }: { notes: string; level: string; places: number; waitlist: boolean }) {
  return (
    <div className="lkdv-safety" aria-label="Manifeste de sécurité">
      <span data-on={Boolean(notes)}><b>{notes ? 'Renseignées' : 'À compléter'}</b><small>Consignes</small></span>
      <span><b>{level}</b><small>Niveau</small></span>
      <span><b>{places}</b><small>Places</small></span>
      <span data-on={waitlist}><b>{waitlist ? 'Oui' : 'Non'}</b><small>Attente</small></span>
    </div>
  );
}

export function KitRing({ score }: { score: number }) {
  return (
    <div className="lkdv-kit-ring" aria-label={`Complétude ${score} %`}>
      <span style={{ background: `conic-gradient(#17402C ${score}%, rgba(23,64,44,.12) 0)` }}><i /></span>
      <div><b>{score}%</b><small>Complétude du kit</small></div>
    </div>
  );
}

export function JoinStepper({ questions, privacy }: { questions: number; privacy: string }) {
  const total = Math.max(1, Math.min(3, questions || 1));
  return (
    <div className="lkdv-join-stepper" aria-label="Étapes d’adhésion">
      <div className="lkdv-join-dots" aria-hidden="true">
        {Array.from({ length: total }).map((_, index) => <i key={index} data-active={index === 0} />)}
      </div>
      <span><b>{questions || 'Aucune'}</b><small>question{questions > 1 ? 's' : ''} · {privacy === 'closed' ? 'validation' : 'ouvert'}</small></span>
    </div>
  );
}

export function ClubInvitePass() {
  return (
    <div className="lkdv-club-invite" aria-label="Passe d’invitation">
      <Link2 size={15} aria-hidden="true" />
      <span><b>Passe d’invitation</b><small>Le lien sera généré après la création du club.</small></span>
    </div>
  );
}

export function PollBalance({ options }: { options: string[] }) {
  const clean = options.map((option) => option.trim()).filter(Boolean);
  if (clean.length < 2) return null;
  return (
    <div className="lkdv-poll-balance" aria-label="Aperçu du bulletin">
      <div className="lkdv-poll-balance-head"><b>Aperçu du bulletin</b><small>{clean.length} options</small></div>
      {clean.map((option, index) => (
        <span key={`${option}-${index}`} className="lkdv-poll-balance-row">
          <b>{option}</b>
          <i aria-hidden="true"><em style={{ width: `${Math.max(12, 100 / clean.length)}%` }} /></i>
        </span>
      ))}
    </div>
  );
}

export function StoryTrim({ media }: { media: unknown[] }) {
  const item = rec(media[0]);
  const ready = Boolean(txt(item.url) || txt(item.previewUrl));
  return (
    <div className="lkdv-story-trim" aria-label="Ruban média Story">
      <div className="lkdv-story-trim-head"><b>{ready ? 'Média prêt' : 'Média à choisir'}</b><small>{txt(item.type).startsWith('video/') ? 'Vidéo' : 'Photo'}</small></div>
      <div className="lkdv-story-trim-track" aria-hidden="true"><i /><i /><i /><em style={{ width: ready ? '64%' : '8%' }} /></div>
      <div className="lkdv-story-trim-foot"><span>Début</span><span>{ready ? 'Aperçu' : '—'}</span><span>Fin</span></div>
    </div>
  );
}
