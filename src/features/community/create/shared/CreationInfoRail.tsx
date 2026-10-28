'use client';

import React from 'react';
import type { CreateKind } from '../engine/createSchemas';
import type { CreateStep } from './StepPager';
import './creation-info-rail.css';

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' ? (value as UnknownRecord) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

const KIND_LABELS: Record<CreateKind, string> = {
  post: 'Publication',
  story: 'Story',
  carnet: 'Carnet',
  sortie: 'Sortie',
  kit: 'Kit',
  club: 'Club',
};

const POST_FORMAT_LABELS: Record<string, string> = {
  photo: 'Photo / vidéo',
  billet: 'Billet',
  question: 'Question',
  event: 'Événement',
};

const AUDIENCE_LABELS: Record<string, string> = {
  public: 'Tout le monde',
  abonnies: 'Abonnés',
  club: 'Club',
  only_me: 'Moi',
};

const LEVEL_LABELS: Record<string, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
};

const SEASON_LABELS: Record<string, string> = {
  toute_saison: 'Toute saison',
  printemps: 'Printemps',
  ete: 'Été',
  automne: 'Automne',
  hiver: 'Hiver',
};

const PRIVACY_LABELS: Record<string, string> = {
  open: 'Ouvert',
  request: 'Sur demande',
  invite: 'Invitation',
};

function dateLabel(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function dateRange(start: string, end: string): string {
  const a = dateLabel(start);
  const b = dateLabel(end);
  if (a && b) return `${a} → ${b}`;
  return a || b;
}

function weight(grams: number): string {
  if (grams <= 0) return '';
  if (grams >= 1000) return `${(grams / 1000).toFixed(1).replace('.', ',')} kg`;
  return `${grams} g`;
}

function chipsFor(kind: CreateKind, values: unknown): string[] {
  const v = record(values);
  if (kind === 'post') {
    const media = list(v.media).length;
    return [
      POST_FORMAT_LABELS[text(v.kind)] ?? '',
      media > 0 ? `${media} média${media > 1 ? 's' : ''}` : '',
      AUDIENCE_LABELS[text(v.audience)] ?? '',
      text(v.eventDate) ? dateLabel(text(v.eventDate)) : '',
      text(v.location),
    ].filter(Boolean).slice(0, 3);
  }
  if (kind === 'story') {
    const media = list(v.media).length;
    return [
      media > 0 ? `${media} média${media > 1 ? 's' : ''}` : 'Média à choisir',
      AUDIENCE_LABELS[text(v.audience)] ?? '',
      text(v.overlayText) ? 'Texte superposé' : '',
      text(v.overlayLink) ? 'Lien' : '',
    ].filter(Boolean).slice(0, 3);
  }
  if (kind === 'carnet') {
    return [
      dateRange(text(v.startDate), text(v.endDate)),
      text(v.destination),
      number(v.distanceKm) > 0 ? `${number(v.distanceKm)} km` : '',
      number(v.nbNuits) > 0 ? `${number(v.nbNuits)} nuit${number(v.nbNuits) > 1 ? 's' : ''}` : '',
      number(v.nbVoyageurs) > 1 ? `${number(v.nbVoyageurs)} voyageurs` : '',
    ].filter(Boolean).slice(0, 3);
  }
  if (kind === 'sortie') {
    return [
      dateRange(text(v.startDate), text(v.endDate)),
      text(v.location),
      LEVEL_LABELS[text(v.level)] ?? '',
      number(v.maxParticipants) > 0 ? `${number(v.maxParticipants)} places` : '',
    ].filter(Boolean).slice(0, 3);
  }
  if (kind === 'kit') {
    const count = list(v.inventoryIds).length + list(v.customItems).length;
    return [
      count > 0 ? `${count} objet${count > 1 ? 's' : ''}` : 'Inventaire à choisir',
      weight(number(v.weightG)),
      SEASON_LABELS[text(v.season)] ?? '',
      text(v.template) ? 'Modèle chargé' : '',
    ].filter(Boolean).slice(0, 3);
  }
  return [
    text(v.category),
    PRIVACY_LABELS[text(v.privacy)] ?? '',
    list(v.joinQuestions).length > 0 ? `${list(v.joinQuestions).length} question${list(v.joinQuestions).length > 1 ? 's' : ''}` : '',
    text(v.membershipRules) ? 'Règles définies' : '',
  ].filter(Boolean).slice(0, 3);
}

export function CreationInfoRail({
  kind,
  step,
  steps,
  values,
}: {
  kind: CreateKind;
  step: number;
  steps: readonly CreateStep[];
  values: unknown;
}) {
  const count = Math.max(1, steps.length);
  const safeStep = Math.max(0, Math.min(step, count - 1));
  const progress = Math.round(((safeStep + 1) / count) * 100);
  const chips = chipsFor(kind, values);

  return (
    <section className="lkdv-create-rail" aria-label="Contexte de création">
      <div className="lkdv-create-rail-top">
        <span className="lkdv-create-provenance">
          <span className="lkdv-create-live-dot" aria-hidden="true" />
          <span>Brouillon</span>
          <span className="lkdv-create-sep" aria-hidden="true">·</span>
          <span>{KIND_LABELS[kind]}</span>
          <span className="lkdv-create-sep" aria-hidden="true">·</span>
          <span>{safeStep + 1}/{count}</span>
        </span>
        <span
          className="lkdv-create-progress"
          style={{ '--lkdv-progress': `${progress}%` } as React.CSSProperties}
          aria-label={`Progression ${progress} %`}
        >
          <b>{progress}</b>
          <small>%</small>
        </span>
      </div>

      <div className="lkdv-create-spine" aria-hidden="true">
        {steps.map((item, index) => (
          <span
            key={item.id}
            className="lkdv-create-spine-node"
            data-state={index < safeStep ? 'done' : index === safeStep ? 'active' : 'todo'}
          >
            <i />
            <em>{item.label}</em>
          </span>
        ))}
      </div>

      {chips.length > 0 ? (
        <div className="lkdv-create-chips" aria-label="Résumé du formulaire">
          {chips.map((chip) => (
            <span key={chip} className="lkdv-create-chip">{chip}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default CreationInfoRail;
