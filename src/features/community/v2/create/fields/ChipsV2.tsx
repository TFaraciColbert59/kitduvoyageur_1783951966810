'use client';

import React, { useId, type ReactNode } from 'react';
import { useFormContext, useFormState } from 'react-hook-form';
import { readError } from './FieldV2';

/**
 * Chips V2 — un seul geste, deux modes :
 * - `multiple` (activités, check-list sécurité) : `aria-pressed`, libellé complet ;
 * - `single` (activité d'une sortie) : `role="radiogroup"`, options `role="radio"`
 *   avec `aria-checked` (`Sortie#1`, `Sortie#20`).
 * Cibles 44 px (`lkdv-cv2-chip--lg`).
 */

export interface ChipOptionV2 {
  value: string;
  label: string;
  icon?: ReactNode;
}

export interface ChipsFieldV2Props {
  name: string;
  label: string;
  options: readonly ChipOptionV2[];
  multiple?: boolean;
  hint?: string;
  className?: string;
  /** Valeur contrôlée (sinon RHF). */
  value?: string | string[];
  onChange?: (next: string | string[]) => void;
}

export function ChipsFieldV2({
  name,
  label,
  options,
  multiple = false,
  hint,
  className,
  value,
  onChange,
}: ChipsFieldV2Props) {
  const form = useFormContext();
  const { errors } = useFormState({ control: form.control, name });
  const message = readError(errors, name);
  const labelId = `${useId()}-label`;
  const current = value !== undefined ? value : (form.watch(name) as string | string[] | undefined);
  const selected = Array.isArray(current) ? current : current ? [current] : [];

  const toggle = (option: string) => {
    let next: string | string[];
    if (multiple) {
      next = selected.includes(option)
        ? selected.filter((entry) => entry !== option)
        : [...selected, option];
    } else {
      next = option;
    }
    if (onChange) onChange(next);
    else form.setValue(name, next, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <div className={['lkdv-cv2-field', className].filter(Boolean).join(' ')}>
      <span id={labelId} className="lkdv-cv2-field-label">
        {label}
      </span>
      <div
        className="lkdv-cv2-chips"
        role={multiple ? 'group' : 'radiogroup'}
        aria-labelledby={labelId}
        aria-invalid={message ? true : undefined}
      >
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className="lkdv-cv2-chip lkdv-cv2-chip--lg lkdv-cv2c-chip"
              role={multiple ? undefined : 'radio'}
              aria-checked={multiple ? undefined : active}
              aria-pressed={multiple ? active : undefined}
              onClick={() => toggle(option.value)}
            >
              {option.icon ? <span className="lkdv-cv2c-chip-ico" aria-hidden="true">{option.icon}</span> : null}
              {option.label}
            </button>
          );
        })}
      </div>
      {hint ? <p className="lkdv-cv2-field-hint">{hint}</p> : null}
      {message ? (
        <p className="lkdv-cv2-field-error" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export interface SegmentedFieldV2Props {
  name?: string;
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Segmented contrôlé (recadrage, visibilité courte, audience compacte). */
export function SegmentedFieldV2({ name, label, options, value, onChange, className }: SegmentedFieldV2Props) {
  const labelId = `${useId()}-seg`;
  return (
    <div className={['lkdv-cv2c-seg-field', className].filter(Boolean).join(' ')}>
      <span id={labelId} className="lkdv-cv2-field-label">
        {label}
      </span>
      <div className="lkdv-cv2-seg lkdv-cv2c-seg" role="group" aria-labelledby={labelId} data-field={name}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
