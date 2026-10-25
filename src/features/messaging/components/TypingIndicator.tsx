"use client";

import React from 'react';

interface TypingIndicatorProps {
  userNames: string[];
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ userNames }) => {
  if (userNames.length === 0) return null;

  const namesDisplay =
    userNames.length === 1
      ? userNames[0]
      : `${userNames.slice(0, 2).join(', ')}${userNames.length > 2 ? ' et d\'autres' : ''}`;

  return (
    <div aria-live="polite" className="ml-[var(--space-2)] mb-[var(--space-1)] flex w-fit items-center gap-[var(--space-2)] rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-3)] py-1.5 text-[length:var(--lkv-text-caption)] font-medium text-[color:var(--lkv-text-secondary)] shadow-elevation-1 backdrop-blur-[var(--blur-md)]">
      <div className="flex items-center gap-[var(--space-1)]" aria-hidden="true">
        <span className="size-1.5 animate-bounce rounded-full bg-[color:var(--lkv-secondary)] [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-[color:var(--lkv-secondary)] [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-[color:var(--lkv-secondary)]" />
      </div>
      <span>{namesDisplay} est en train d&apos;écrire...</span>
    </div>
  );
};
