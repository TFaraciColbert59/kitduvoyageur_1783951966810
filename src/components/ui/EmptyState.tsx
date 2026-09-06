'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, RotateCcw, AlertTriangle, Compass } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = '',
}: EmptyStateProps) {
  const actionBtn = (
    <button
      type="button"
      onClick={onAction}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-lkv-primary text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-lkv-primary-hover active:scale-[0.97] transition-all duration-150 min-h-[44px] shadow-sm"
    >
      <span>{actionLabel}</span>
      <ArrowRight className="w-4 h-4" />
    </button>
  );

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      {icon ? (
        <div className="mb-4 text-lkv-secondary flex items-center justify-center">{icon}</div>
      ) : (
        <div className="mb-4 w-14 h-14 rounded-2xl bg-lkv-primary/5 border border-lkv-primary/10 flex items-center justify-center text-lkv-secondary">
          <Compass className="w-7 h-7" />
        </div>
      )}
      <h3 className="text-base font-bold text-lkv-primary mb-1.5">{title}</h3>
      {description && (
        <p className="text-xs sm:text-sm text-lkv-text-muted max-w-sm mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && actionHref && (
        <Link href={actionHref}>{actionBtn}</Link>
      )}
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
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      <div className="mb-4 w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600">
        <AlertTriangle className="w-7 h-7" />
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
          <RotateCcw className="w-4 h-4" />
          <span>Réessayer</span>
        </button>
      )}
    </div>
  );
}

export default EmptyState;
