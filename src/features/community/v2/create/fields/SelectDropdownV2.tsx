'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useFormContext, useFormState } from 'react-hook-form';
import { readError } from './FieldV2';

export interface SelectOptionV2 {
  value: string;
  label: string;
}

export interface SelectDropdownV2Props {
  name: string;
  label?: string;
  options: readonly SelectOptionV2[];
  multiple?: boolean;
  placeholder?: string;
  hint?: string;
  className?: string;
  icon?: React.ReactNode;
  compact?: boolean;
  menuPlacement?: 'bottom' | 'top';
  /** Valeur contrôlée (sinon RHF). */
  value?: string | string[];
  onChange?: (next: string | string[]) => void;
}

/**
 * Menu déroulant moderne unifié (choix simple et choix multiple) :
 * déclencheur en verre/crème + panneau flottant avec coches actives.
 */
export function SelectDropdownV2({
  name,
  label,
  options,
  multiple = false,
  placeholder = 'Sélectionner…',
  hint,
  className,
  icon,
  compact = false,
  menuPlacement = 'bottom',
  value,
  onChange,
}: SelectDropdownV2Props) {
  const form = useFormContext();
  const { errors } = useFormState({ control: form.control, name });
  const message = readError(errors, name);
  const id = useId();
  const labelId = `${id}-label`;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const current = value !== undefined ? value : (form.watch(name) as string | string[] | undefined);
  const selectedArray = Array.isArray(current) ? current : current ? [current] : [];

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleSelectSingle = (optValue: string) => {
    if (onChange) onChange(optValue);
    else form.setValue(name, optValue, { shouldDirty: true, shouldValidate: true });
    setOpen(false);
  };

  const toggleMulti = (optValue: string) => {
    const next = selectedArray.includes(optValue)
      ? selectedArray.filter((entry) => entry !== optValue)
      : [...selectedArray, optValue];
    if (onChange) onChange(next);
    else form.setValue(name, next, { shouldDirty: true, shouldValidate: true });
  };

  const singleValue = Array.isArray(current) ? (current[0] ?? '') : (current ?? '');
  const singleLabel = options.find((opt) => opt.value === singleValue)?.label ?? '';

  const selectedLabels = options
    .filter((opt) => selectedArray.includes(opt.value))
    .map((opt) => opt.label);

  const summaryText = multiple
    ? selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(', ')
        : `${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2}`
    : singleLabel || placeholder;

  const isPlaceholder = multiple ? selectedLabels.length === 0 : !singleLabel;

  return (
    <div
      ref={wrapRef}
      className={['lkdv-cv2-field lkdv-cv2c-multiselect', compact ? 'is-compact' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {label ? (
        <span id={labelId} className="lkdv-cv2-field-label">
          {label}
        </span>
      ) : null}
      <button
        id={id}
        type="button"
        className="lkdv-cv2c-multiselect-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? labelId : undefined}
        aria-label={!label ? placeholder : undefined}
        aria-invalid={message ? true : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="lkdv-cv2c-select-trigger-value" data-placeholder={isPlaceholder ? 'true' : undefined}>
          {icon ? <span className="lkdv-cv2c-select-ico">{icon}</span> : null}
          <span>{summaryText}</span>
        </span>
        <ChevronDown
          size={compact ? 13 : 15}
          aria-hidden="true"
          style={{
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 0.16s ease',
          }}
        />
      </button>
      {open ? (
        <div
          className={`lkdv-cv2c-multiselect-menu ${menuPlacement === 'top' ? 'is-top' : ''}`}
          role="listbox"
          aria-multiselectable={multiple || undefined}
          aria-labelledby={label ? labelId : undefined}
        >
          {options.map((opt) => {
            const active = multiple ? selectedArray.includes(opt.value) : singleValue === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                className="lkdv-cv2c-multiselect-opt"
                data-active={active}
                onClick={() => (multiple ? toggleMulti(opt.value) : handleSelectSingle(opt.value))}
              >
                <span>{opt.label}</span>
                <span className="lkdv-cv2c-multiselect-check" aria-hidden="true">
                  {active ? <Check size={12} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {hint ? <p className="lkdv-cv2-field-hint">{hint}</p> : null}
      {message ? (
        <p className="lkdv-cv2-field-error" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
