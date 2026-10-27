'use client';

import React from 'react';
import type { CreateKind } from '../engine/createSchemas';
import './creation-signature.css';

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
function date(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
function range(a: string, b: string): string {
  const x = date(a); const y = date(b);
  return x && y ? `${x} → ${y}` : x || y;
}
function kg(grams: number): string {
  if (grams <= 0) return '—';
  return grams >= 1000 ? `${(grams / 1000).toFixed(1).replace('.', ',')} kg` : `${grams} g`;
}

const POST_KIND: Record<string, string> = { photo: 'Photo / vidéo', billet: 'Billet', question: 'Question', event: 'Événement' };
const AUDIENCE: Record<string, string> = { public: 'Tout le monde', abonnies: 'Abonnés', club: 'Club', only_me: 'Moi' };
const LEVEL: Record<string, string> = { facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' };
const PRIVACY: Record<string, string> = { open: 'Ouvert', request: 'Sur demande', invite: 'Invitation' };
const SEASON: Record<string, string> = { toute_saison: 'Toute saison', printemps: 'Printemps', ete: 'Été', automne: 'Automne', hiver: 'Hiver' };

export function CreationSignature({ kind, values }: { kind: CreateKind; values: unknown }) {
  const v = rec(values);
  if (kind === 'post') {
    const media = arr(v.media).length;
    return (
      <div className="lkdv-signature lkdv-signature-postcard">
        <span className="lkdv-signature-stamp" aria-hidden="true">LKDV</span>
        <div className="lkdv-signature-postcard-copy">
          <small>{POST_KIND[txt(v.kind)] ?? 'Publication'}</small>
          <b>{txt(v.title) || txt(v.content).slice(0, 54) || 'Ta carte postale'}</b>
          <span>{[txt(v.location), AUDIENCE[txt(v.audience)], media > 0 ? `${media} média${media > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') || 'Ajoute un lieu ou un média'}</span>
        </div>
      </div>
    );
  }
  if (kind === 'story') {
    const media = arr(v.media).length;
    return (
      <div className="lkdv-signature lkdv-signature-viewfinder">
        <div className="lkdv-signature-frame" aria-hidden="true">
          <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
          <span>9:16 · zone sûre</span>
        </div>
        <div className="lkdv-signature-viewfinder-copy">
          <b>{txt(v.overlayText) || 'Story sans texte'}</b>
          <span>{[media > 0 ? `${media} média${media > 1 ? 's' : ''}` : 'Média à choisir', AUDIENCE[txt(v.audience)]].filter(Boolean).join(' · ')}</span>
        </div>
      </div>
    );
  }
  if (kind === 'carnet') {
    const km = num(v.distanceKm);
    const dplus = num(v.deniveleM);
    return (
      <div className="lkdv-signature lkdv-signature-ribbon">
        <div className="lkdv-signature-ribbon-line" aria-hidden="true"><i /><i /><i /></div>
        <div className="lkdv-signature-ribbon-copy">
          <small>{txt(v.destination) || 'Destination'}</small>
          <b>{range(txt(v.startDate), txt(v.endDate)) || 'Dates à définir'}</b>
          <span>{[km > 0 ? `${km} km` : '', dplus > 0 ? `${dplus} m D+` : '', num(v.nbNuits) > 0 ? `${num(v.nbNuits)} nuit${num(v.nbNuits) > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') || 'Itinéraire à compléter'}</span>
        </div>
      </div>
    );
  }
  if (kind === 'sortie') {
    return (
      <div className="lkdv-signature lkdv-signature-ticket">
        <div className="lkdv-signature-ticket-main">
          <small>Départ</small>
          <b>{date(txt(v.startDate)) || 'Date à définir'}</b>
          <span>{txt(v.location) || 'Lieu à définir'}</span>
        </div>
        <div className="lkdv-signature-ticket-stub">
          <b>{LEVEL[txt(v.level)] ?? 'Moyen'}</b>
          <span>{num(v.maxParticipants) > 0 ? `${num(v.maxParticipants)} places` : 'Places'}</span>
        </div>
      </div>
    );
  }
  if (kind === 'kit') {
    const count = arr(v.inventoryIds).length + arr(v.customItems).length;
    return (
      <div className="lkdv-signature lkdv-signature-weight">
        <div className="lkdv-signature-weight-top">
          <span><small>Poids total</small><b>{kg(num(v.weightG))}</b></span>
          <span><small>Objets</small><b>{count || '—'}</b></span>
          <span><small>Saison</small><b>{SEASON[txt(v.season)] ?? '—'}</b></span>
        </div>
        <div className="lkdv-signature-weight-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(4, num(v.weightG) / 120))}%` }} /></div>
      </div>
    );
  }
  const name = txt(v.name) || 'Ton club';
  return (
    <div className="lkdv-signature lkdv-signature-crest">
      <span className="lkdv-signature-crest-mark" aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>
      <div className="lkdv-signature-crest-copy">
        <small>{PRIVACY[txt(v.privacy)] ?? 'Club'}</small>
        <b>{name}</b>
        <span>{[txt(v.category), txt(v.location)].filter(Boolean).join(' · ') || 'Identité à compléter'}</span>
      </div>
    </div>
  );
}

export default CreationSignature;
