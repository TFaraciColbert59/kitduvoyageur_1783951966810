'use client';

import type { ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import ds from './cockpitDrawers.module.css';

export type BadgeTone = 'good' | 'warn' | 'bad' | 'water' | 'tint' | 'neutral';

export function StatusBadge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={ds.badge} data-tone={tone}>{children}</span>;
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className={ds.segmented} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={ds.segmentBtn}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function DrawerSection({
  title,
  right,
  children,
  padded = false,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={ds.section}>
      <div className={ds.sectionHeader}>
        <h3 className={ds.sectionTitle}>{title}</h3>
        {right}
      </div>
      <div className={padded ? `${ds.card} ${ds.cardPadded}` : ds.card}>{children}</div>
    </section>
  );
}

export function DrawerRow({
  icon,
  iconTone = 'good',
  title,
  subtitle,
  right,
  chevron = false,
  onClick,
  itemId,
}: {
  icon?: string;
  iconTone?: 'good' | 'warn' | 'bad' | 'water' | 'neutral';
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  chevron?: boolean;
  onClick?: (el: HTMLButtonElement) => void;
  itemId?: string;
}) {
  const inner = (
    <>
      {icon && (
        <span className={ds.rowIcon} data-tone={iconTone} aria-hidden="true">
          <Icon name={icon} size={17} />
        </span>
      )}
      <span className={ds.rowBody}>
        <span className={ds.rowTitle}>{title}</span>
        {subtitle && <span className={ds.rowSub}>{subtitle}</span>}
      </span>
      {(right || chevron) && (
        <span className={ds.rowRight}>
          {right}
          {chevron && <Icon name="chevron-right" size={15} />}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`${ds.row} ${ds.rowInteractive}`}
        data-hub-item={itemId}
        onClick={(e) => onClick(e.currentTarget)}
      >
        {inner}
      </button>
    );
  }
  return <div className={ds.row}>{inner}</div>;
}

export function ProgressBar({ value, tone = 'good' }: { value: number; tone?: 'good' | 'warn' | 'bad' | 'water' | 'tint' | 'accent' }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={ds.progressTrack} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div className={ds.progressFill} data-tone={tone} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function EmptyBox({ icon, message, action }: { icon: string; message: string; action?: ReactNode }) {
  return (
    <div className={ds.emptyBox}>
      <span className={ds.rowIcon} data-tone="neutral" aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <p style={{ margin: 0 }}>{message}</p>
      {action}
    </div>
  );
}
