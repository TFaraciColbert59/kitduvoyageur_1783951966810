'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import Link from 'next/link';

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
  const actionBtn = (
    <button
      type="button"
      onClick={onAction}
      className={`inline-flex items-center gap-2 bg-lkv-primary text-white font-semibold rounded-xl hover:bg-lkv-primary-hover active:scale-[0.97] transition-all duration-150 min-h-[44px] shadow-sm ${
        compact ? 'px-4 py-2 text-xs' : 'px-5 py-2.5 text-xs sm:text-sm'
      }`}
    >
      <span>{actionLabel}</span>
      <Icon name="arrow-right" className="w-4 h-4" />
    </button>
  );

  if (compact) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-6 px-4 text-center ${className}`}
      >
        {icon && (
          <div className="mb-2.5 text-lkv-secondary flex items-center justify-center">{icon}</div>
        )}
        <h3 className="text-sm font-bold text-lkv-primary">{title}</h3>
        {description && (
          <p className="text-xs text-lkv-text-muted max-w-xs mt-1 leading-relaxed">{description}</p>
        )}
        {actionLabel && actionHref && (
          <Link href={actionHref} className="mt-3 inline-flex">
            {actionBtn}
          </Link>
        )}
        {actionLabel && onAction && !actionHref && (
          <span className="mt-3 inline-flex">{actionBtn}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}
    >
      {icon ? (
        <div className="mb-4 text-lkv-secondary flex items-center justify-center">{icon}</div>
      ) : (
        <div className="mb-4 w-14 h-14 rounded-2xl bg-lkv-primary/5 border border-lkv-primary/10 flex items-center justify-center text-lkv-secondary">
          <Icon name="compass" className="w-7 h-7" />
        </div>
      )}
      <h3 className="text-base font-bold text-lkv-primary mb-1.5">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-lkv-text-muted max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && actionHref && <Link href={actionHref}>{actionBtn}</Link>}
      {actionLabel && onAction && !actionHref && actionBtn}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Une erreur est survenue',
  message = "Nous n'avons pas pu charger cette vue. Vérifiez votre connexion et réessayez.",
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}
    >
      <div className="mb-4 w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600">
        <Icon name="alert-triangle" className="w-7 h-7" />
      </div>
      <h3 className="text-base font-bold text-lkv-primary mb-1.5">{title}</h3>
      <p className="text-xs sm:text-sm text-lkv-text-muted max-w-sm mb-6 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-lkv-primary text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-lkv-primary-hover active:scale-[0.97] transition-all duration-150 min-h-[44px] shadow-sm"
        >
          <Icon name="rotate-ccw" className="w-4 h-4" />
          <span>Réessayer</span>
        </button>
      )}
    </div>
  );
}

export default EmptyState;
