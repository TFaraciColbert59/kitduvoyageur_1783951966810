'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, X } from 'lucide-react';

/**
 * Primitives du drawer de création — grammaire du Compte.
 *
 * Un seul gabarit de champ : 44 px, rayon 14, verre `rgba(255,255,255,.72)`,
 * liseré `.5px rgba(23,43,36,.10)`, focus `0 0 0 2px #17402C`.
 * Aucun libellé visible : le champ est nommé par son placeholder, son icône et
 * son `aria-label`. Styles : `create-drawer.css` (préfixe `lkdv-cd-`).
 */

export interface CreateOption {
  value: string;
  label: string;
}

/** Enveloppe d'un champ : support d'erreur sous le champ (11 px, #C13B34). */
export function CreateField({ error, children }: { error?: string | null; children: React.ReactNode }) {
  return (
    <div className={error ? 'lkdv-cd-field is-invalid' : 'lkdv-cd-field'}>
      {children}
      {error ? (
        <p className="lkdv-cd-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface CreateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'aria-label'> {
  label: string;
}

export function CreateInput({ label, className = '', ...props }: CreateInputProps) {
  return <input {...props} aria-label={label} className={`lkdv-cd-input ${className}`.trim()} />;
}

export interface CreateTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  onBlur?: () => void;
}

/**
 * Champ multiligne : rayon 18, min-height 96, padding 12.
 * Le compteur (10 px, opacité .55) n'apparaît qu'au focus ou une fois du texte
 * saisi : aucun libellé permanent, et un seul compteur par formulaire.
 */
export function CreateTextarea({ label, value, onChange, placeholder, disabled, maxLength, onBlur }: CreateTextareaProps) {
  const [focused, setFocused] = useState(false);
  const showCount = focused || value.length > 0;
  return (
    <div className="lkdv-cd-area">
      <textarea
        aria-label={label}
        className="lkdv-cd-textarea"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
      />
      {showCount ? (
        <span className="lkdv-cd-count" aria-hidden="true">
          {maxLength ? `${value.length}/${maxLength}` : value.length}
        </span>
      ) : null}
    </div>
  );
}

export interface CreateSelectProps {
  label: string;
  value: string;
  options: CreateOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Sélecteur au gabarit du champ (44 px) : chevron SF à droite, menu ouvert
 * vers le haut depuis le bas du drawer. Rôles `combobox` / `listbox`.
 */
export function CreateSelect({ label, value, options, onChange, disabled }: CreateSelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));
  const [box, setBox] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    node?.focus({ preventScroll: true });
  }, [open, active]);

  const openMenu = () => {
    if (disabled) return;
    const trigger = triggerRef.current;
    const rect = trigger?.getBoundingClientRect();
    if (!rect) return;
    // Bornes de la feuille : le menu ne doit jamais sortir du drawer.
    const sheet = trigger?.closest('.lkdv-overlay-sheet') as HTMLElement | null;
    const sheetRect = sheet?.getBoundingClientRect();
    const topBound = (sheetRect ? sheetRect.top : 0) + 8;
    const bottomBound = (sheetRect ? sheetRect.bottom : window.innerHeight) - 12;
    const desired = Math.min(216, options.length * 40 + 8);
    const spaceAbove = rect.top - topBound - 6;
    const spaceBelow = bottomBound - rect.bottom - 6;
    // Ouverture vers le haut par défaut ; bascule vers le bas si la place manque.
    const upward = spaceAbove >= desired || spaceAbove >= spaceBelow;
    setBox(
      upward
        ? {
            left: rect.left,
            width: rect.width,
            bottom: Math.max(8, window.innerHeight - rect.top + 6),
            maxHeight: Math.min(216, Math.max(96, spaceAbove)),
          }
        : {
            left: rect.left,
            width: rect.width,
            top: rect.bottom + 6,
            maxHeight: Math.min(216, Math.max(96, spaceBelow)),
          }
    );
    setActive(Math.max(0, options.findIndex((option) => option.value === value)));
    setOpen(true);
  };

  const closeMenu = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const pick = (index: number) => {
    const option = options[index];
    if (option) onChange(option.value);
    closeMenu();
  };

  const menu = open && box && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="lkdv-cd-select-menu"
          role="listbox"
          id={`${label}-listbox`}
          aria-label={label}
          ref={listRef}
          style={{
            position: 'fixed',
            left: box.left,
            width: box.width,
            top: box.top,
            bottom: box.bottom,
            maxHeight: box.maxHeight,
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              closeMenu();
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((index) => Math.min(options.length - 1, index + 1));
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(0, index - 1));
              return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              pick(active);
              return;
            }
            if (event.key === 'Tab') setOpen(false);
          }}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              data-index={index}
              aria-selected={option.value === value}
              tabIndex={index === active ? 0 : -1}
              className="lkdv-cd-option"
              onClick={() => pick(index)}
            >
              <span>{option.label}</span>
              {option.value === value ? <Check size={14} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <div className="lkdv-cd-select" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        className="lkdv-cd-input lkdv-cd-select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${label}-listbox` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            openMenu();
          }
        }}
      >
        <span className="lkdv-cd-select-value">{current?.label}</span>
        <ChevronDown size={16} aria-hidden="true" className="lkdv-cd-select-chevron" />
      </button>
      {menu}
    </div>
  );
}

export interface CreateMediaSlotProps {
  label: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
  removeLabel?: string;
  disabled?: boolean;
}

/**
 * Emplacement média : un seul carré 96 × 96, rayon 18, fond verre, icône 22 px.
 * Aperçu plein cadre ; bouton de retrait 22 px en haut à droite.
 */
export function CreateMediaSlot({ label, accept, file, onChange, removeLabel = 'Retirer le média', disabled }: CreateMediaSlotProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const isVideo = Boolean(file && file.type.startsWith('video/'));

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  if (file && preview) {
    return (
      <div className="lkdv-cd-slot has-media">
        {isVideo ? (
          <video className="lkdv-cd-slot-preview" src={preview} muted playsInline />
        ) : (
          <img className="lkdv-cd-slot-preview" src={preview} alt="" />
        )}
        <button
          type="button"
          className="lkdv-cd-slot-remove"
          aria-label={removeLabel}
          disabled={disabled}
          onClick={() => {
            onChange(null);
            if (inputRef.current) inputRef.current.value = '';
          }}
        >
          <X size={12} aria-hidden="true" />
        </button>
        <input
          id={inputId}
          ref={inputRef}
          className="sr-only"
          type="file"
          accept={accept}
          aria-label={label}
          disabled={disabled}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
      </div>
    );
  }

  return (
    <div className="lkdv-cd-slot">
      <input
        id={inputId}
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={accept}
        aria-label={label}
        disabled={disabled}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <label className="lkdv-cd-slot-add" htmlFor={inputId}>
        <span className="lkdv-cd-slot-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span className="sr-only">{label}</span>
      </label>
    </div>
  );
}

/** Actions : primaire pleine largeur 48 px (rayon 999) + secondaire textuelle. */
export function CreateActions({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="lkdv-cd-actions">
      <button type="button" className="lkdv-cd-primary" onClick={onPrimary} disabled={primaryDisabled}>
        {primaryLabel}
      </button>
      {secondaryLabel && onSecondary ? (
        <button type="button" className="lkdv-cd-secondary" onClick={onSecondary}>
          {secondaryLabel}
        </button>
      ) : null}
    </div>
  );
}

/** Progression sans texte : trois segments de 4 px. */
export function CreateProgress({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="lkdv-cd-progress" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1} aria-label={label}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={index <= step ? 'is-on' : ''} />
      ))}
    </div>
  );
}
