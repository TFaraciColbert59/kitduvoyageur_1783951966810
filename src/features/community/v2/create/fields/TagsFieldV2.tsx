'use client';

import React, { useId, useRef, useState } from 'react';
import { Hash, X } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

const SUGGESTIONS = ['rando', 'bivouac', 'ski', 'velo', 'lac', 'montagne', 'refuge', 'trail'];

/** Hashtags V2 (`Publication#9`) : chips supprimables, suggestions, 10 maximum. */
export function TagsFieldV2({ name = 'tags', label = 'Hashtags' }: { name?: string; label?: string }) {
  const form = useFormContext();
  const { haptic } = useHapticFeedback();
  const inputId = `cv2c-${name}`;
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const raw = form.watch(name);
  const tags = Array.isArray(raw) ? (raw as string[]) : [];

  const add = (value: string) => {
    const tag = value.trim().replace(/^#+/, '').replace(/\s+/g, '').toLowerCase().slice(0, 24);
    if (!tag || tags.includes(tag) || tags.length >= 10) return;
    form.setValue(name, [...tags, tag], { shouldDirty: true, shouldValidate: true });
    haptic('selection');
    setDraft('');
  };

  const remove = (tag: string) => {
    form.setValue(
      name,
      tags.filter((entry) => entry !== tag),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  return (
    <div className="lkdv-cv2-field">
      <label htmlFor={inputId} className="lkdv-cv2-field-label">
        {label}
      </label>
      {tags.length > 0 ? (
        <ul className="lkdv-cv2-chips lkdv-cv2c-tag-list" aria-label="Hashtags ajoutés">
          {tags.map((tag) => (
            <li key={tag}>
              <span className="lkdv-cv2-chip lkdv-cv2-chip--sm">
                <Hash size={12} aria-hidden="true" />
                {tag}
                <button
                  type="button"
                  className="lkdv-cv2c-chip-x"
                  aria-label={`Retirer le hashtag ${tag}`}
                  onClick={() => remove(tag)}
                >
                  <X size={11} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="lkdv-cv2c-inline-add">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          className="lkdv-cv2-input"
          value={draft}
          maxLength={24}
          placeholder={tags.length >= 10 ? '10 hashtags maximum' : 'Ajouter un hashtag'}
          disabled={tags.length >= 10}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
              event.preventDefault();
              add(draft);
            }
          }}
          onBlur={() => add(draft)}
        />
      </div>
      <div className="lkdv-cv2-chips">
        {SUGGESTIONS.filter((tag) => !tags.includes(tag))
          .slice(0, 5)
          .map((tag) => (
            <button
              key={tag}
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--sm"
              onClick={() => add(tag)}
              disabled={tags.length >= 10}
            >
              #{tag}
            </button>
          ))}
      </div>
    </div>
  );
}

export { useId };
