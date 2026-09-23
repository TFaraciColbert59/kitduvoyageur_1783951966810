'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import Icon from '@/components/ui/Icon';

export interface InsetGroupedListProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function InsetGroupedList({
  children,
  header,
  footer,
  className = '',
}: InsetGroupedListProps) {
  return (
    <div className={cn('w-full select-none space-y-1.5', className)}>
      {header && (
        <div className="px-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--glass-secondary)]">
          {header}
        </div>
      )}
      <div className="g1 overflow-hidden rounded-[var(--lkv-radius-card)] border border-[color:var(--glass-rim)] divide-y divide-[color:var(--glass-rim)]">
        {children}
      </div>
      {footer && (
        <div className="px-3 text-xs leading-relaxed text-[color:var(--glass-secondary)] opacity-85">
          {footer}
        </div>
      )}
    </div>
  );
}

export interface InsetGroupedItemProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  chevron?: boolean;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
  className?: string;
}

export function InsetGroupedItem({
  icon,
  title,
  subtitle,
  trailing,
  chevron = false,
  href,
  onClick,
  destructive = false,
  className = '',
}: InsetGroupedItemProps) {
  const content = (
    <div className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04] active:bg-white/[0.08]">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--g2-bg)] text-[color:var(--glass-label)]">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'truncate text-sm font-medium',
              destructive
                ? 'text-[color:var(--lkv-danger)]'
                : 'text-[color:var(--glass-label)]'
            )}
          >
            {title}
          </div>
          {subtitle && (
            <div className="mt-0.5 truncate text-xs text-[color:var(--glass-secondary)]">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {trailing && (
          <span className="text-xs text-[color:var(--glass-secondary)] tabular-nums">
            {trailing}
          </span>
        )}
        {chevron && (
          <Icon
            name="chevron-right"
            size={16}
            className="text-[color:var(--glass-label-secondary)] opacity-60"
          />
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={cn('block w-full focus-visible:outline-none', className)}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn('block w-full focus-visible:outline-none', className)}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

export default InsetGroupedList;
