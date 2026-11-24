'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Plus, X } from 'lucide-react';
import { CLUB_SPRING } from '../ClubDrawerMotion';

export type AdminTone = 'sage' | 'warn' | 'danger' | 'neutral';

const TONE_STYLES: Record<AdminTone, { bg: string; color: string; border: string }> = {
  sage: {
    bg: 'var(--club-soft-bg, #d3ebd9)',
    color: 'var(--tint, #17402c)',
    border: 'rgba(23, 64, 44, 0.16)',
  },
  warn: {
    bg: 'var(--club-warn-bg, #fbf1dc)',
    color: '#92400e',
    border: 'rgba(180, 83, 9, 0.22)',
  },
  danger: {
    bg: 'var(--club-danger-bg, #f5ddd9)',
    color: '#991b1b',
    border: 'rgba(185, 28, 28, 0.22)',
  },
  neutral: {
    bg: 'rgba(23, 43, 36, 0.06)',
    color: 'var(--label2, #56665d)',
    border: 'rgba(23, 43, 36, 0.10)',
  },
};

export function AdminStatusPill({
  children,
  tone = 'sage',
  style,
}: {
  children: React.ReactNode;
  tone?: AdminTone;
  style?: React.CSSProperties;
}) {
  const palette = TONE_STYLES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 20,
        padding: '0 7px',
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        background: palette.bg,
        color: palette.color,
        border: `0.5px solid ${palette.border}`,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export interface AdminAccordionCardProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  tone?: 'default' | 'warn' | 'danger';
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (next: boolean) => void;
  children: React.ReactNode;
  compact?: boolean;
}

export function AdminAccordionCard({
  title,
  icon,
  badge,
  tone = 'default',
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  children,
  compact = false,
}: AdminAccordionCardProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;

  const toggle = () => {
    const next = !isOpen;
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onToggle?.(next);
  };

  const titleColor =
    tone === 'danger' ? '#b91c1c' : tone === 'warn' ? '#92400e' : 'var(--tint, #17402c)';
  const borderColor =
    tone === 'danger'
      ? '0.5px solid rgba(185, 28, 28, 0.24)'
      : tone === 'warn'
        ? '0.5px solid rgba(180, 83, 9, 0.24)'
        : undefined;

  return (
    <div
      className="club-glass-card"
      style={{
        padding: compact ? '8px 10px' : '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        border: borderColor,
      }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={toggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: 0,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          minHeight: compact ? 24 : 28,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: compact ? 11.5 : 12.5,
            fontWeight: 700,
            color: titleColor,
            minWidth: 0,
          }}
        >
          {icon}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none' }}>
          {badge}
          <ChevronDown
            size={14}
            color={titleColor}
            aria-hidden="true"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.18s ease',
              opacity: 0.75,
            }}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={CLUB_SPRING}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: compact ? 8 : 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {children}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export interface AdminCollapsibleCreateProps {
  label: string;
  open: boolean;
  onToggle: (next: boolean) => void;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}

export function AdminCollapsibleCreate({
  label,
  open,
  onToggle,
  rightSlot,
  children,
}: AdminCollapsibleCreateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onToggle(!open)}
          className="lkdv-carnet-btn-soft"
          style={{
            height: 32,
            padding: '0 12px',
            fontSize: 12,
            fontWeight: 700,
            color: open ? 'var(--label, #172b24)' : 'var(--tint, #17402c)',
            background: open ? 'rgba(23, 43, 36, 0.08)' : 'var(--club-soft-bg, #d3ebd9)',
            borderRadius: 999,
          }}
        >
          {open ? <X size={13} aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}
          <span>{open ? 'Fermer' : label}</span>
        </button>
        {rightSlot}
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{ height: 'auto', opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -4 }}
            transition={CLUB_SPRING}
            style={{ overflow: 'hidden' }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
