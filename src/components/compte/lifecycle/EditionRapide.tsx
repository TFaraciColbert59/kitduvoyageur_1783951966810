'use client';

/**
 * Lot A02 — édition rapide après synchronisation (S1.18).
 *
 * L'invite n'est proposée que si le contrat la déclare visible et dans la
 * fenêtre de 24 h. Les champs du contrat sont respectés (`title`, `sport`,
 * `tags`, `visibility`) ; « Plus tard » ferme l'invite sans toucher aux
 * données durables.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock3 } from 'lucide-react';
import {
  ACTIVITY_TAGS,
  type ActivityMetadataPatch,
  type LifecycleActivityRecord,
  type Sport,
} from '@/features/compte/lifecycle';
import { SPORT_FAMILIES } from '@/features/explorer-v2/sheet/sportSelection';
import { Notice } from './primitives';
import { formatRemainingDays, sportLabel, tagLabel } from './format';
import type { SubmitResult } from './types';

export interface EditionRapideProps {
  record: LifecycleActivityRecord;
  busy?: boolean;
  onSubmit: (patch: ActivityMetadataPatch) => Promise<SubmitResult>;
  onDismiss: () => Promise<SubmitResult>;
}

export function EditionRapide({ record, busy = false, onSubmit, onDismiss }: EditionRapideProps) {
  const [title, setTitle] = useState(record.title);
  const [sport, setSport] = useState<Sport>(record.sport);
  const [tags, setTags] = useState<string[]>(record.tags);
  const [visibility, setVisibility] = useState(record.visibility);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setTitle(record.title);
    setSport(record.sport);
    setTags(record.tags);
    setVisibility(record.visibility);
    setError(null);
  }, [record.id, record.revision, record.title, record.sport, record.tags, record.visibility]);

  const expiry = useMemo(() => {
    const iso = record.quickEditState.expiresAt;
    if (!iso) return null;
    const expiresMs = Date.parse(iso);
    if (!Number.isFinite(expiresMs)) return null;
    return formatRemainingDays(Math.max(0, expiresMs - Date.now()));
  }, [record.quickEditState.expiresAt]);

  const normalizedTitle = title.trim();
  const dirty =
    normalizedTitle !== record.title ||
    sport !== record.sport ||
    visibility !== record.visibility ||
    tags.length !== record.tags.length ||
    tags.some((tag, index) => tag !== record.tags[index]);

  const pending = busy || submitting;

  async function submit() {
    setError(null);
    if (normalizedTitle.length === 0) {
      setError('Le titre ne peut pas être vide.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await onSubmit({
        title: normalizedTitle,
        sport,
        tags,
        visibility,
      });
      if (result.ok === false) setError(result.error);
    } finally {
      setSubmitting(false);
    }
  }

  async function dismiss() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await onDismiss();
      if (result.ok === false) setError(result.error);
    } finally {
      setSubmitting(false);
    }
  }

  if (!record.quickEditState.visible || record.quickEditState.status !== 'pending') {
    return (
      <Notice tone="info">
        Aucune édition rapide en attente pour cette séance. Les modifications restent disponibles
        depuis la fiche.
      </Notice>
    );
  }

  return (
    <form
      className="lkv-life__fields"
      data-testid="edition-rapide"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Notice tone="info">
        <span>
          <Clock3 size={14} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 4 }} />
          Synchronisée récemment : tu peux encore ajuster ces informations
          {expiry ? ` pendant ${expiry}` : ''}.
        </span>
      </Notice>

      <div className="lkv-life__field">
        <label htmlFor="life-quick-title">Titre de la séance</label>
        <input
          id="life-quick-title"
          type="text"
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="lkv-life__field">
        <label htmlFor="life-quick-sport">Sport</label>
        <select
          id="life-quick-sport"
          value={sport}
          onChange={(event) => setSport(event.target.value as Sport)}
        >
          {SPORT_FAMILIES.map((family) => (
            <option key={family.sport} value={family.sport}>
              {family.label}
            </option>
          ))}
        </select>
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
        <div className="lkv-life__tags" role="radiogroup" aria-label="Visibilité de la séance">
          <button
            type="button"
            className="lkv-life__tag-option"
            role="radio"
            aria-checked={visibility === 'private'}
            onClick={() => setVisibility('private')}
          >
            Privée
          </button>
          <button
            type="button"
            className="lkv-life__tag-option"
            role="radio"
            aria-checked={visibility === 'collective_anonymized'}
            onClick={() => setVisibility('collective_anonymized')}
          >
            Partagée, anonymisée
          </button>
        </div>
      </div>

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
        <button
          type="button"
          className="lkv-life__btn"
          data-variant="ghost"
          onClick={() => void dismiss()}
          disabled={pending}
        >
          Plus tard
        </button>
      </div>

      <p className="lkv-life__hint">
        Sport actuel : {sportLabel(record.sport)}. Un changement de sport recalcule les statistiques
        et invalide les records de l’ancien sport.
      </p>
    </form>
  );
}
