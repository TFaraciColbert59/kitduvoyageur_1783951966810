'use client';

import React, { useEffect, useState } from 'react';
import { Check, Download, Pencil, Share2, ShieldCheck, Trash2, X } from 'lucide-react';
import { ActionPill } from '@/components/ui/ActionPill';
import type { OutingDetail, OutingVisibility } from '@/features/compte/server/sorties';
import { ElevationProfile, TraceMap, formatDate, formatDuration, formatNumber } from './shared';

export interface OutingSummaryProps {
  detail: OutingDetail;
  saving: boolean;
  onSave: (patch: { title: string; notes: string; visibility: OutingVisibility }) => void;
  onShare: () => void;
  onExport: () => void;
  onDelete: () => void;
}

const STATUS_LABEL: Record<OutingDetail['status'], string> = {
  planned: 'À venir',
  ongoing: 'En cours',
  done: 'Terminée',
};

export function OutingSummary({ detail, saving, onSave, onShare, onExport, onDelete }: OutingSummaryProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(detail.title);
  const [notes, setNotes] = useState(detail.notes);
  const [visibility, setVisibility] = useState<OutingVisibility>(detail.visibility);
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    setTitle(detail.title);
    setNotes(detail.notes);
    setVisibility(detail.visibility);
    setEditing(false);
  }, [detail.id, detail.title, detail.notes, detail.visibility]);

  const companions = detail.participants.filter((person) => !person.isOwner);
  const showCover = Boolean(detail.coverUrl) && !coverFailed;
  const context = companions.map((person) => person.name).slice(0, 3).join(', ');

  return (
    <div className="lkdv-sortie-summary">
      <div className={`lkdv-sortie-hero ${showCover ? 'has-photo' : ''}`}>
        {showCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={detail.coverUrl ?? ''}
            alt=""
            className="lkdv-sortie-hero-img"
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <TraceMap points={detail.points} className="lkdv-sortie-hero-map" />
        )}
        <div className="lkdv-sortie-hero-scrim" aria-hidden="true" />
        {!editing ? (
          <div className="lkdv-sortie-hero-tools lkdv-apill-row">
            <ActionPill tone="primary" label="Partager" icon={<Share2 />} onClick={onShare} />
            {detail.canEdit ? <ActionPill label="Modifier" icon={<Pencil />} onClick={() => setEditing(true)} /> : null}
            <ActionPill
              label={detail.points.length < 2 ? 'Aucune trace GPS rattachée' : 'Télécharger le GPX'}
              icon={<Download />}
              onClick={onExport}
              disabled={detail.points.length < 2}
            />
          </div>
        ) : null}
        <div className="lkdv-sortie-hero-body">
          <div className="lkdv-sortie-hero-badges">
            {detail.verified ? (
              <span className="lkdv-sortie-badge proof">
                <ShieldCheck size={12} aria-hidden="true" /> Empreinte vérifiée
              </span>
            ) : null}
            <span className={`lkdv-sortie-badge state ${detail.status}`}>{STATUS_LABEL[detail.status]}</span>
          </div>
          <h2>{detail.title}</h2>
          <p>
            {formatDate(detail.date)}
            {detail.massif ? ` · ${detail.massif}` : ''}
          </p>
          {context ? <p className="lkdv-sortie-hero-with">avec {context}</p> : null}
        </div>
      </div>

      <div className="lkdv-sortie-tiles">
        <div>
          <small>Distance</small>
          <b>{formatNumber(detail.km)} km</b>
        </div>
        <div>
          <small>Dénivelé</small>
          <b>+{formatNumber(detail.dplus)} m</b>
        </div>
        <div>
          <small>Alt. max</small>
          <b>{detail.maxAlt ? `${formatNumber(detail.maxAlt)} m` : '—'}</b>
        </div>
        <div>
          <small>Durée</small>
          <b>{formatDuration(detail.durationS)}</b>
        </div>
      </div>

      {editing ? (
        <form
          className="lkdv-sortie-edit"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ title: title.trim(), notes, visibility });
          }}
        >
          <label>
            <span>Titre</span>
            <input
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Titre de la sortie"
              required
            />
          </label>
          <label>
            <span>Récit</span>
            <textarea
              value={notes}
              maxLength={2000}
              rows={3}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Deux ou trois phrases sur cette sortie…"
            />
          </label>
          <label>
            <span>Visibilité</span>
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as OutingVisibility)}>
              <option value="private">Privé</option>
              <option value="collective_anonymized">Collectif anonymisé</option>
            </select>
          </label>
          <div className="lkdv-sortie-edit-actions lkdv-apill-row">
            <ActionPill label="Annuler" icon={<X />} onClick={() => setEditing(false)} />
            <ActionPill type="submit" tone="primary" label="Enregistrer" icon={<Check />} busy={saving} disabled={!title.trim()} />
          </div>
        </form>
      ) : (
        detail.notes ? <p className="lkdv-sortie-notes">{detail.notes}</p> : null
      )}

      <section className="lkdv-sortie-section">
        <header>
          <b>Profil altimétrique</b>
          <span>{detail.maxAlt ? `${formatNumber(detail.maxAlt)} m au plus haut` : 'Altitudes non renseignées'}</span>
        </header>
        <ElevationProfile points={detail.points} />
      </section>

      <section className="lkdv-sortie-section">
        <header>
          <b>Preuve terrain</b>
          <span>{detail.verified ? 'Trace GPS présente' : 'Sans trace GPS'}</span>
        </header>
      </section>

      {detail.canEdit ? (
        <section className="lkdv-sortie-danger">
          {confirmDelete ? (
            <>
              <p>Supprimer la sortie et tout son contenu ?</p>
              <div className="lkdv-sortie-edit-actions lkdv-apill-row">
                <ActionPill label="Annuler" icon={<X />} onClick={() => setConfirmDelete(false)} />
                <ActionPill tone="danger" label="Supprimer" icon={<Trash2 />} onClick={onDelete} />
              </div>
            </>
          ) : (
            <button type="button" className="lkdv-sortie-danger-link" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} aria-hidden="true" /> Supprimer cette sortie
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}

export default OutingSummary;
