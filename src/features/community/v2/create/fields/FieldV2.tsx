'use client';

import React, { type ReactNode } from 'react';
import { useFormContext, useFormState, type FieldValues } from 'react-hook-form';
import { fieldLabel } from '../engine/errors';

/**
 * Champ V2 : libellé **visible** (600, 10 px, majuscules), contrôle 16 px de
 * 44-48 px, aide courte et **une seule** erreur sous le champ, reliée par
 * `aria-describedby` (`01 § 4.1`, `Publication#2-3`, `Sortie#20`).
 */

/** Lit une erreur RHF à un chemin pointé (`days.0.moments.2.text`). */
export function readError(errors: unknown, path: string): string | null {
  let node: unknown = errors;
  for (const key of path.split('.')) {
    if (!node || typeof node !== 'object') return null;
    node = (node as Record<string, unknown>)[key];
  }
  if (!node || typeof node !== 'object') return null;
  const message = (node as { message?: unknown }).message;
  return typeof message === 'string' && message.trim() ? message : null;
}

export interface FieldV2RenderProps {
  id: string;
  labelId: string;
  describedBy: string | undefined;
  invalid: boolean;
}

export interface FieldV2Props {
  /** Nom RHF (chemin complet). */
  name: string;
  label: string;
  hint?: string;
  /** Compteur de caractères : `max` affiché à droite du libellé. */
  counter?: { value: number; max: number } | null;
  required?: boolean;
  /** `id` explicite (défaut : `cv2c-<champ racine>`). */
  id?: string;
  className?: string;
  /** Libellé masqué visuellement (rare : champ en pilule). */
  labelHidden?: boolean;
  children: (props: FieldV2RenderProps) => ReactNode;
}

function rootName(name: string): string {
  return name.split('.')[0] ?? name;
}

export function FieldV2({
  name,
  label,
  hint,
  counter = null,
  required = false,
  id,
  className,
  labelHidden = false,
  children,
}: FieldV2Props) {
  const form = useFormContext<FieldValues>();
  const { errors } = useFormState({ control: form.control, name });
  const message = readError(errors, name);
  const invalid = Boolean(message);
  const fieldId = id ?? `cv2c-${rootName(name)}`;
  const labelId = `${fieldId}-label`;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(' ') || undefined;
  const near = counter ? counter.value >= counter.max * 0.9 : false;
  const over = counter ? counter.value > counter.max : false;

  return (
    <div
      className={['lkdv-cv2-field', 'lkdv-cv2c-field', className].filter(Boolean).join(' ')}
      data-testid={`cv2-field-${rootName(name)}`}
    >
      <div className="lkdv-cv2c-field-head">
        <label id={labelId} htmlFor={fieldId} className={`lkdv-cv2-field-label${labelHidden ? ' lkdv-cv2c-sr-only' : ''}`}>
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
          {required ? <span className="lkdv-cv2c-sr-only"> (obligatoire)</span> : null}
        </label>
        {counter ? (
          <span className="lkdv-cv2-counter" data-near={near} data-over={over} aria-hidden="true">
            {counter.value} / {counter.max}
          </span>
        ) : null}
      </div>
      {children({ id: fieldId, labelId, describedBy, invalid })}
      {hint ? <p id={hintId} className="lkdv-cv2-field-hint">{hint}</p> : null}
      {message ? (
        <p id={errorId} className="lkdv-cv2-field-error" role="alert">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4l9 16H3zM12 10v4M12 17v.5" />
          </svg>
          {message}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldV2Props {
  name: string;
  label: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  type?: 'text' | 'url' | 'email' | 'number' | 'search';
  inputMode?: 'text' | 'numeric' | 'decimal' | 'url' | 'search';
  maxLength?: number;
  autoComplete?: string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
}

/** Champ texte V2. Utilisable contrôlé (`value/onChange`) ou via RHF seul. */
export function TextFieldV2({ name, label, placeholder, hint, required, type = 'text', inputMode, maxLength, autoComplete, className, value, onChange }: TextFieldV2Props) {
  const form = useFormContext<FieldValues>();
  const registered = form.register(name);
  const isControlled = value !== undefined && onChange !== undefined;
  return (
    <FieldV2 name={name} label={label} hint={hint} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="lkdv-cv2-input"
          {...(isControlled
            ? { value, onChange: (event) => onChange?.(event.target.value) }
            : registered)}
        />
      )}
    </FieldV2>
  );
}

export interface TextAreaFieldV2Props {
  name: string;
  label: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  maxLength: number;
  rows?: number;
  /** Bouton d'aide à l'écriture (récit de carnet) rendu dans l'en-tête du champ. */
  action?: ReactNode;
  className?: string;
}

export function TextAreaFieldV2({ name, label, placeholder, hint, required, maxLength, rows = 5, action, className }: TextAreaFieldV2Props) {
  const form = useFormContext<FieldValues>();
  const value = form.watch(name);
  const length = typeof value === 'string' ? value.length : 0;
  return (
    <FieldV2
      name={name}
      label={label}
      hint={hint}
      required={required}
      counter={{ value: length, max: maxLength }}
      className={className}
    >
      {({ id, describedBy, invalid }) => (
        <>
          {action ? <div className="lkdv-cv2c-field-action">{action}</div> : null}
          <textarea
            id={id}
            rows={rows}
            maxLength={maxLength}
            placeholder={placeholder}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className="lkdv-cv2-input"
            {...form.register(name)}
          />
        </>
      )}
    </FieldV2>
  );
}

export { fieldLabel };
