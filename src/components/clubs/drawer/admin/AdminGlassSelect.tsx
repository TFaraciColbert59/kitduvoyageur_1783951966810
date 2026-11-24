'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface AdminGlassSelectOption {
  value: string;
  label: string;
}

export interface AdminGlassSelectProps {
  value: string;
  options: readonly AdminGlassSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  compact?: boolean;
  style?: React.CSSProperties;
}

/**
 * Sélecteur Liquid Glass sur mesure (remplace les <select> natifs qui affichent
 * une double flèche sur certains navigateurs et cassent l'alignement vertical).
 */
export function AdminGlassSelect({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = 'Sélectionner…',
  compact = false,
  style,
}: AdminGlassSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);
  const height = compact ? 30 : 34;

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: '100%',
        minWidth: 0,
        ...style,
      }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          height,
          padding: compact ? '0 8px 0 10px' : '0 10px 0 12px',
          borderRadius: 12,
          border: '0.5px solid rgba(23, 64, 44, 0.14)',
          background: 'rgba(255, 255, 255, 0.86)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.96), 0 1px 4px rgba(23, 43, 36, 0.05)',
          color: current ? '#172b24' : '#56665d',
          fontSize: compact ? 11.5 : 12.5,
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          cursor: 'pointer',
          minWidth: 0,
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'left',
          }}
        >
          {current ? current.label : placeholder}
        </span>
        <ChevronDown
          size={compact ? 12 : 13}
          color="#17402c"
          aria-hidden="true"
          style={{
            flex: 'none',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.16s ease',
          }}
        />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'absolute',
            top: height + 4,
            left: 0,
            right: 0,
            minWidth: 150,
            maxHeight: 210,
            overflowY: 'auto',
            zIndex: 60,
            padding: 4,
            borderRadius: 14,
            background: 'rgba(251, 250, 246, 0.97)',
            backdropFilter: 'blur(20px) saturate(160%)',
            WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            border: '0.5px solid rgba(23, 64, 44, 0.14)',
            boxShadow: 'inset 0 1px 0 #fff, 0 10px 28px rgba(17, 29, 23, 0.16)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  minHeight: 30,
                  padding: '5px 8px',
                  borderRadius: 10,
                  border: 0,
                  background: selected ? 'rgba(23, 64, 44, 0.10)' : 'transparent',
                  color: selected ? '#17402c' : '#172b24',
                  fontSize: 12,
                  fontWeight: selected ? 700 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opt.label}
                </span>
                {selected ? <Check size={12} color="#17402c" aria-hidden="true" style={{ flex: 'none' }} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
