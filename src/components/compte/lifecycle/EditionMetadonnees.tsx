'use client';

/**
 * Lot A02 — édition des métadonnées, du sport, des tags et des médias
 * (K5.04, S1.20).
 *
 * Le formulaire ne modifie que les champs réellement changés. Les actions
 * média (couverture, retrait) passent par la route dédiée et renvoient l'état
 * persisté ; aucun réordonnancement n'est simulé côté client.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Check, ImageOff, Star, Trash2 } from 'lucide-react';
import {
  ACTIVITY_TAGS,
  type ActivityMetadataPatch,
  type LifecycleActivityRecord,
  type LifecycleMediaAction,
  type Sport,
} from '@/features/compte/lifecycle';
import { SPORT_FAMILIES } from '@/features/explorer-v2/sheet/sportSelection';
import { Notice, Section } from './primitives';
import { sportLabel, tagLabel, visibilityLabel } from './format';
import type { SubmitResult } from './types';

export interface EditionMetadonneesProps {
  record: LifecycleActivityRecord;
  busy?: boolean;
  emphasis?: 'metadata' | 'sport';
  onSubmit: (patch: ActivityMetadataPatch) => Promise<SubmitResult>;
  onMedia: (action: LifecycleMediaAction) => Promise<SubmitResult>;
}

export function EditionMetadonnees({
  record,
  busy = false,
  emphasis = 'metadata',
  onSubmit,
  onMedia,
}: EditionMetadonneesProps) {
  const [title, setTitle] = useState(record.title);
  const [notes, setNotes] = useState(record.notes);
  const [sport, setSport] = useState<Sport>(record.sport);
  const [tags, setTags] = useState<string[]>(record.tags);
  const [visibility, setVisibility] = useState(record.visibility);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mediaBusy, setMediaBusy] = useState(false);

  useEffect(() => {
    setTitle(record.title);
    setNotes(record.notes);
    setSport(record.sport);
    setTags(record.tags);
    setVisibility(record.visibility);
    setError(null);
  }, [
    record.id,
    record.revision,
    record.title,
    record.notes,
    record.sport,
    record.tags,
    record.visibility,
  ]);

  const dirty = useMemo(
    () =>
      title.trim() !== record.title ||
      notes !== record.notes ||
      sport !== record.sport ||
      visibility !== record.visibility ||
      tags.length !== record.tags.length ||
      tags.some((tag, index) => tag !== record.tags[index]),
    [title, notes, sport, visibility, tags, record]
  );

  const pending = busy || submitting || mediaBusy;

  async function submit() {
    setError(null);
    if (title.trim().length === 0) {
      setError('Le titre ne peut pas être vide.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await onSubmit({
        title: title.trim(),
        notes,
        sport,
        tags,
        visibility,
      });
      if (result.ok === false) setError(result.error);
    } finally {
      setSubmitting(false);
    }
  }

  async function media(action: LifecycleMediaAction) {
    setError(null);
    setMediaBusy(true);
    try {
      const result = await onMedia(action);
      if (result.ok === false) setError(result.error);
    } finally {
      setMediaBusy(false);
    }
  }

  return (
    <form
      className="lkv-life__fields"
      data-testid="edition-metadonnees"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="lkv-life__field">
        <label htmlFor="life-edit-title">Titre</label>
        <input
          id="life-edit-title"
          type="text"
          maxLength={120}
          value={title}
          autoFocus={emphasis === 'metadata'}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="lkv-life__field">
        <label htmlFor="life-edit-notes">Notes</label>
        <textarea
          id="life-edit-notes"
          maxLength={2000}
          value={notes}
          placeholder="Souvenir, météo, état du sentier…"
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <div className="lkv-life__field">
        <label htmlFor="life-edit-sport">Sport</label>
        <select
          id="life-edit-sport"
          value={sport}
          autoFocus={emphasis === 'sport'}
          onChange={(event) => setSport(event.target.value as Sport)}
        >
          {SPORT_FAMILIES.map((family) => (
            <option key={family.sport} value={family.sport}>
              {family.label}
            </option>
          ))}
        </select>
        {sport !== record.sport ? (
          <Notice tone="warning">
            Le sport passe de {sportLabel(record.sport)} à {sportLabel(sport)} : les statistiques
            seront recalculées et les records de l’ancien sport invalidés.
          </Notice>
        ) : null}
      </div>

      <div className="lkv-life__field">
        <span className="lkv-life__label">Tags</span>
        <div className="lkv-life__tags" role="group" aria-label="Tags de la séance">
          {ACTIVITY_TAGS.map((tag) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                className="lkv-life__tag-option"
                aria-pressed={active}
                onClick={() =>
                  setTags((current) =>
                    current.includes(tag)
                      ? current.filter((value) => value !== tag)
                      : [...current, tag]
                  )
                }
              >
                {tagLabel(tag)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="lkv-life__field">
        <span className="lkv-life__label">Visibilité</span>
        <div className="lkv-life__tags" role="radiogroup" aria-label="Visibilité">
          <button
            type="button"
            role="radio"
            aria-checked={visibility === 'private'}
            className="lkv-life__tag-option"
            onClick={() => setVisibility('private')}
          >
            Privée
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={visibility === 'collective_anonymized'}
            className="lkv-life__tag-option"
            onClick={() => setVisibility('collective_anonymized')}
          >
            Partagée, anonymisée
          </button>
        </div>
        <p className="lkv-life__hint">
          Visibilité actuelle : {visibilityLabel(record.visibility)}.
        </p>
      </div>

      {record.media.length > 0 ? (
        <Section title="Médias" hint={`${record.media.length} élément(s)`}>
          <div className="lkv-life__list">
            {record.media.map((item) => (
              <div
                key={item.id}
                className="lkv-life__row"
                style={{ cursor: 'default', minHeight: 56 }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    width: 36,
                    height: 36,
                    flex: '0 0 36px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 8,
                    background: 'var(--lkv-surface-muted)',
                  }}
                >
                  <ImageOff size={16} />
                </span>
                <span className="lkv-life__row-main">
                  <span className="lkv-life__row-title">
                    {item.caption ?? (item.kind === 'video' ? 'Vidéo' : 'Photo')}
                  </span>
                  <span className="lkv-life__row-meta">{item.storagePath}</span>
                </span>
                <span className="lkv-life__row-side" style={{ flexDirection: 'row', gap: 4 }}>
                  <button
                    type="button"
                    className="lkv-life__iconbtn"
                    aria-label={`Définir ${item.caption ?? 'ce média'} en couverture`}
                    disabled={pending || record.coverUrl === (item.url ?? item.storagePath)}
                    onClick={() => void media({ type: 'set_cover', id: item.id })}
                  >
                    <Star size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="lkv-life__iconbtn"
                    aria-label={`Retirer ${item.caption ?? 'ce média'}`}
                    disabled={pending}
                    onClick={() => void media({ type: 'remove', id: item.id })}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="lkv-life__actions">
        <button
          type="submit"
          className="lkv-life__btn"
          data-variant="primary"
          disabled={pending || !dirty}
        >
          <Check size={15} aria-hidden="true" /> Enregistrer
        </button>
      </div>
    </form>
  );
}
