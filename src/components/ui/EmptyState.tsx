'use client';

import React from 'react';
import Link from 'next/link';

interface EmptyStateProps {
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
      onClick={onAction}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1C2620] text-white text-sm font-semibold rounded-xl hover:bg-[#2D3F35] active:scale-[0.97] transition-all duration-150 shadow-sm"
    >
      {actionLabel}
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </button>
  );

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      {icon ? (
        <div className="mb-5 text-[#C8D4C0]">{icon}</div>
      ) : (
        <div className="mb-5 w-16 h-16 rounded-full bg-[#F0ECE1] flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A0B0A0" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 10a1 1 0 012 0v2a1 1 0 01-2 0v-2z" />
            <path d="M15 10a1 1 0 012 0v2a1 1 0 01-2 0v-2z" />
            <path d="M8 16c.5-1 2-2 4-2s3.5 1 4 2" />
          </svg>
        </div>
      )}
      <h3 className="text-base font-bold text-[#1C2620] mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-[#7A8A7D] max-w-xs mb-6 leading-relaxed">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link href={actionHref}>{actionBtn}</Link>
      )}
      {actionLabel && onAction && !actionHref && actionBtn}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Une erreur est survenue',
  message = 'Nous n&apos;avons pas pu charger cette page. Vérifiez votre connexion et réessayez.',
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div className="mb-5 w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="13" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="text-base font-bold text-[#1C2620] mb-1.5">{title}</h3>
      <p className="text-sm text-[#7A8A7D] max-w-xs mb-6 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1C2620] text-white text-sm font-semibold rounded-xl hover:bg-[#2D3F35] active:scale-[0.97] transition-all duration-150 shadow-sm"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
          Réessayer
        </button>
      )}
    </div>
  );
}
