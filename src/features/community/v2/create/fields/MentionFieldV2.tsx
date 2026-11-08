'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AtSign, Loader2 } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import {
  fetchMentionProfiles,
  normalizeMentionQuery,
  type MentionProfile,
} from '@/features/community/feed/MentionPicker';
import { createClient } from '@/lib/supabase/client';

export interface MentionFieldV2Props {
  /** Champ `string[]` des ids mentionnés (stockés dans `creation_meta`). */
  idsName?: string;
  /** Texte publié où le `@handle` est inséré. */
  contentName?: string;
  label?: string;
}

/**
 * Mentions V2 (`Publication#9`) : suggestions de profils réelles (vue
 * `public_profiles`, `fetchMentionProfiles`), insertion du `@handle` dans le
 * texte et des ids dans `mentions` (métadonnées de création). La RPC
 * `create_community_post` ne porte pas la colonne `mentions` : les ids restent
 * dans `creation_meta`, le texte garde la mention visible.
 */
export function MentionFieldV2({
  idsName = 'mentions',
  contentName = 'content',
  label = 'Mentions',
}: MentionFieldV2Props) {
  const form = useFormContext();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MentionProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const ids = (form.watch(idsName) as string[] | undefined) ?? [];

  useEffect(() => {
    const normalized = normalizeMentionQuery(query);
    if (normalized.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setNotice(null);
      try {
        const profiles = await fetchMentionProfiles(createClient(), normalized, 5);
        setResults(profiles);
      } catch {
        setResults([]);
        setNotice('Suggestions indisponibles.');
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const pick = (profile: MentionProfile) => {
    const handle = profile.handle ?? profile.full_name ?? '';
    if (!handle) return;
    const current = (form.getValues(contentName) as string | undefined) ?? '';
    const separator = current.trim().length > 0 && !current.endsWith(' ') ? ' ' : '';
    if (!current.includes(`@${handle}`)) {
      form.setValue(contentName, `${current}${separator}@${handle}`, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (!ids.includes(profile.id)) {
      form.setValue(idsName, [...ids, profile.id], { shouldDirty: true, shouldValidate: true });
    }
    setQuery('');
    setResults([]);
  };

  return (
    <div className="lkdv-cv2-field">
      <label htmlFor="cv2c-mentions" className="lkdv-cv2-field-label">
        {label}
      </label>
      <div className="lkdv-cv2c-place">
        <AtSign size={16} aria-hidden="true" />
        <input
          id="cv2c-mentions"
          type="text"
          role="combobox"
          className="lkdv-cv2-input"
          value={query}
          placeholder="Chercher une personne à mentionner"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={results.length > 0}
          aria-controls="cv2c-mentions-list"
          onChange={(event) => setQuery(event.target.value)}
          onBlur={() => window.setTimeout(() => setResults([]), 160)}
        />
        {loading ? <Loader2 size={15} className="lkdv-cv2c-spin" aria-label="Recherche" /> : null}
      </div>
      {results.length > 0 ? (
        <ul id="cv2c-mentions-list" className="lkdv-cv2c-place-list" role="listbox" aria-label="Personnes trouvées">
          {results.map((profile) => (
            <li key={profile.id} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => pick(profile)}>
                <span>
                  <b>{profile.full_name ?? profile.handle}</b>
                  <small>{profile.handle ? `@${profile.handle}` : ''}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {notice ? (
        <p className="lkdv-cv2-field-hint" role="status">
          {notice}
        </p>
      ) : null}
      {ids.length > 0 ? (
        <p className="lkdv-cv2-field-hint">{ids.length} personne{ids.length > 1 ? 's' : ''} mentionnée{ids.length > 1 ? 's' : ''}.</p>
      ) : null}
    </div>
  );
}
