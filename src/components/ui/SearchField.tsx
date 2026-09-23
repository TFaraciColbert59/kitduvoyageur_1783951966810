'use client';

import React from 'react';
import Icon from '@/components/ui/Icon';
import { cn } from '@/lib/utils';

export interface SearchFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
  containerClassName?: string;
}

/**
 * SearchField — apparence et états uniques de la recherche (Lot 3).
 * N'embarque aucune logique métier : les recherches existantes réutilisent
 * seulement son apparence, son icône, son bouton d'effacement et son focus.
 */
export function SearchField({
  onClear,
  containerClassName,
  className,
  value,
  placeholder = 'Rechercher',
  ...props
}: SearchFieldProps) {
  const hasValue = typeof value === 'string' && value.length > 0;

  return (
    <div
      className={cn(
        'flex h-[var(--control-height-md)] w-full items-center gap-[var(--space-2)] rounded-full',
        'border border-[color:var(--glass-rim)] bg-[color:var(--g2-bg)] backdrop-blur-md shadow-[var(--glass-specular)] px-[var(--space-3)]',
        'focus-within:ring-2 focus-within:ring-[color:var(--lkv-focus-ring)]',
        containerClassName
      )}
    >
      <Icon
        name="MagnifyingGlassIcon"
        size={18}
        className="shrink-0 text-[color:var(--glass-label-secondary)]"
      />
      <input
        {...props}
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={props['aria-label'] ?? placeholder}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-[length:var(--lkv-text-body)] text-[color:var(--glass-label)]',
          'placeholder:text-[color:var(--glass-label-tertiary)] focus:outline-none',
          '[&::-webkit-search-cancel-button]:hidden',
          className
        )}
      />
      {hasValue && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Effacer la recherche"
          className="inline-flex h-[var(--control-height-sm)] w-[var(--control-height-sm)] shrink-0 items-center justify-center rounded-full text-[color:var(--glass-label-secondary)] transition-colors hover:bg-[color:var(--lkv-hover-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
        >
          <Icon name="XMarkIcon" size={16} />
        </button>
      )}
    </div>
  );
}

export default SearchField;
