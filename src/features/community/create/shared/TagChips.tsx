'use client';

import React, { useState } from 'react';
import './create-shared.css';

export interface TagChipsProps {
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  placeholder?: string;
  suggestions?: readonly string[];
  max?: number;
  maxLength?: number;
  disabled?: boolean;
  hint?: string;
}

function normalise(raw: string, maxLength: number): string {
  return raw.trim().replace(/^#+/, '').slice(0, maxLength);
}

/**
 * Chips de tags accessibles : ajout Entrée/virgule, retrait par bouton,
 * suggestions filtrées et déduplication insensible à la casse.
 */
export function TagChips({
  value,
  onChange,
  label = 'Tags',
  placeholder = 'rando, bivouac…',
  suggestions = [],
  max = 10,
  maxLength = 24,
  disabled = false,
  hint,
}: TagChipsProps) {
  const [draft, setDraft] = useState('');
  const full = value.length >= max;

  const add = (raw: string) => {
    if (disabled || full) return;
    const tag = normalise(raw, maxLength);
    if (!tag) return;
    if (value.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...value, tag].slice(0, max));
    setDraft('');
  };

  const remove = (tag: string) => {
    if (disabled) return;
    onChange(value.filter((item) => item !== tag));
  };

  const addFromInput = (raw: string) => {
    const parts = raw.split(',').map((part) => normalise(part, maxLength)).filter(Boolean);
    if (parts.length === 0) return;
    const next = [...value];
    for (const part of parts) {
      if (next.length >= max) break;
      if (!next.some((existing) => existing.toLowerCase() === part.toLowerCase())) next.push(part);
    }
    onChange(next);
    setDraft('');
  };

  return (
    <div className="lkdv-tag-chips">
      <span className="lkdv-form-label">{label}</span>
      {value.length > 0 ? (
        <ul className="lkdv-tag-chips-list" aria-label={`${label} sélectionnés`}>
          {value.map((tag) => (
            <li key={tag} className="lkdv-tag-chip">
              <span>{tag}</span>
              <button
                type="button"
                aria-label={`Retirer ${tag}`}
                disabled={disabled}
                onClick={() => remove(tag)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="lkdv-tag-chips-input">
        <input
          type="text"
          value={draft}
          disabled={disabled || full}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label={label}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw.includes(',')) addFromInput(raw);
            else setDraft(raw);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              add(draft);
            } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
              remove(value[value.length - 1]);
            }
          }}
        />
      </div>
      <span className="hint" aria-live="polite">
        {full ? `${max} tags maximum.` : (hint ?? `${value.length}/${max}`)}
      </span>
    </div>
  );
}

export default TagChips;
