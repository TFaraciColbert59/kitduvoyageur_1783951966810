'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import Icon from '@/components/ui/Icon';
import Button from '@/components/ui/Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
  /** compact = inline, pour les blocs d'aperçu du hub (pas de padding 44px). */
  compact?: boolean;
}

/**
 * EmptyState — État vide canonique en Liquid Glass iOS 27 (Lot 2).
 * 100% monochrome, lisibilité WCAG 2.2 AA (>= 4.5:1), icône en capsule de verre G1.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = '',
  compact = false,
}: EmptyStateProps) {
  const actionButton = actionLabel ? (
    <Button
      variant="primary"
      size={compact ? 'sm' : 'md'}
      onClick={onAction}
      icon={<Icon name="arrow-right" size={14} />}
      iconPosition="trailing"
    >
      {actionLabel}
    </Button>
  ) : null;

  if (compact) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-6 px-4 text-center select-none',
          className
        )}
      >
        {icon && (
          <div className="mb-2 text-[color:var(--glass-label)] flex items-center justify-center">
            {icon}
          </div>
        )}
        <h3 className="text-sm font-bold text-[color:var(--glass-label)]">{title}</h3>
        {description && (
          <p className="text-xs text-[color:var(--glass-secondary)] max-w-xs mt-1 leading-relaxed">
            {description}
          </p>
        )}
        {actionButton && actionHref && (
          <Link href={actionHref} className="mt-3 inline-flex">
            {actionButton}
          </Link>
        )}
        {actionButton && onAction && !actionHref && (
          <span className="mt-3 inline-flex">{actionButton}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'g1 flex flex-col items-center justify-center py-12 px-6 text-center select-none',
        'rounded-[var(--lkv-radius-card)] border border-[color:var(--glass-rim)] shadow-sm',
        className
      )}
    >
      {icon ? (
        <div className="mb-4 text-[color:var(--glass-label)] flex items-center justify-center">
          {icon}
        </div>
      ) : (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full g2 border border-[color:var(--glass-rim)] text-[color:var(--glass-label)] shadow-sm">
          <Icon name="compass" size={28} />
        </div>
      )}
      <h3 className="text-base font-bold text-[color:var(--glass-label)] mb-1.5">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-[color:var(--glass-secondary)] max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {actionButton && actionHref && (
        <Link href={actionHref} className="inline-flex">
          {actionButton}
        </Link>
      )}
      {actionButton && onAction && !actionHref && actionButton}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * ErrorState — État d'erreur canonique en Liquid Glass iOS 27 (Lot 2).
 */
export function ErrorState({
  title = 'Une erreur est survenue',
  message = "Nous n'avons pas pu charger ces données. Vérifiez votre connexion et réessayez.",
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'g1 flex flex-col items-center justify-center py-12 px-6 text-center select-none',
        'rounded-[var(--lkv-radius-card)] border border-red-500/20 shadow-sm',
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/30 text-red-300">
        <Icon name="alert-triangle" size={28} />
      </div>
      <h3 className="text-base font-bold text-[color:var(--glass-label)] mb-1.5">{title}</h3>
      <p className="text-xs sm:text-sm text-[color:var(--glass-secondary)] max-w-sm mb-6 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <Button
          variant="secondary"
          size="md"
          onClick={onRetry}
          icon={<Icon name="rotate-ccw" size={14} />}
          iconPosition="leading"
        >
          Réessayer
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
