'use client';

import React, { useEffect, useId, useState } from 'react';
import Icon from '@/components/ui/Icon';

/* ---------------------------------------------------------------------------
   Champs des formulaires en étapes. Cibles tactiles ≥ 44 px, libellés liés
   (`htmlFor`), états `aria-*`. Les styles sont dans `community-card.css`.
   --------------------------------------------------------------------------- */

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  type = 'text',
  inputMode,
  min,
  max,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: 'text' | 'date' | 'number' | 'search';
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  min?: string | number;
  max?: string | number;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className="lkdv-wz-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        min={min}
        max={max}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function CountedTextArea({
  label,
  value,
  onChange,
  max,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  max: number;
  placeholder?: string;
}) {
  const id = useId();
  const left = max - value.length;
  return (
    <div className="lkdv-wz-field lkdv-wz-field--grow">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={value}
        placeholder={placeholder}
        maxLength={max}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="lkdv-wz-counter" data-low={left < 40 ? 'true' : 'false'} aria-live="off">
        {value.length}/{max}
      </span>
    </div>
  );
}

export interface ChipOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

/** Puces à choix unique (`radiogroup`) ou multiple (`aria-pressed`). */
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<ChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
}) {
  const labelId = useId();
  return (
    <div className="lkdv-wz-field">
      <span className="lkdv-wz-label" id={labelId}>
        {label}
      </span>
      <div className="lkdv-wz-chips" role="radiogroup" aria-labelledby={labelId}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={value === option.id}
            className="lkdv-wz-chip"
            disabled={option.disabled}
            onClick={() => onChange(option.id)}
          >
            {option.icon ? <span className="lkdv-wz-chip-ico">{option.icon}</span> : null}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MultiChips({
  label,
  options,
  value,
  onChange,
  max,
}: {
  label: string;
  options: ReadonlyArray<ChipOption<string>>;
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
}) {
  return (
    <div className="lkdv-wz-field">
      <span className="lkdv-wz-label">{label}</span>
      <div className="lkdv-wz-chips" role="group" aria-label={label}>
        {options.map((option) => {
          const on = value.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              className="lkdv-wz-chip"
              aria-pressed={on}
              disabled={!on && max !== undefined && value.length >= max}
              onClick={() => onChange(on ? value.filter((entry) => entry !== option.id) : [...value, option.id])}
            >
              {option.icon ? <span className="lkdv-wz-chip-ico">{option.icon}</span> : null}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Compteur − n + (participants, durée) : évite un champ numérique au clavier. */
export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="lkdv-wz-field">
      <span className="lkdv-wz-label">{label}</span>
      <div className="lkdv-wz-stepper" role="group" aria-label={label}>
        <button type="button" aria-label={`Diminuer ${label}`} disabled={value <= min} onClick={() => onChange(clamp(value - step))}>
          <Icon name="minus" size={16} aria-hidden="true" />
        </button>
        <output aria-live="polite">
          {value}
          {unit ? <small> {unit}</small> : null}
        </output>
        <button type="button" aria-label={`Augmenter ${label}`} disabled={value >= max} onClick={() => onChange(clamp(value + step))}>
          <Icon name="plus" size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** URL d'aperçu d'un fichier local, révoquée au démontage. */
export function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

/** Choix d'une image unique avec aperçu (couverture de carnet, kit, club). */
export function ImagePicker({
  label,
  file,
  onChange,
  aspect = '16 / 10',
  round = false,
  compact = false,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  aspect?: string;
  round?: boolean;
  /** Vignette carrée de 72 px, pour tenir sur la même ligne qu'un champ. */
  compact?: boolean;
}) {
  const preview = useObjectUrl(file);
  const id = useId();
  return (
    <div className="lkdv-wz-field">
      <span className="lkdv-wz-label">{label}</span>
      <div
        className={compact ? 'lkdv-wz-image lkdv-wz-image--square' : 'lkdv-wz-image'}
        data-round={round ? 'true' : 'false'}
        style={compact ? undefined : { aspectRatio: aspect }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:)
          <img src={preview} alt="" />
        ) : (
          <label htmlFor={id} className="lkdv-wz-image-empty">
            <Icon name="image-plus" size={compact ? 20 : 22} aria-hidden="true" />
            {compact ? null : <span>Ajouter une image</span>}
          </label>
        )}
        <input
          id={id}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
        {preview ? (
          <button type="button" className="lkdv-wz-image-clear" aria-label="Retirer l’image" onClick={() => onChange(null)}>
            <Icon name="x" size={14} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
