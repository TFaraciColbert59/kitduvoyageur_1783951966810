'use client';

import React from 'react';
import type { QuietCatchUpSummary } from '../../types/terra.types';
import { QuietCatchUpCard } from './QuietCatchUpCard';

export interface QuietCatchUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: QuietCatchUpSummary | null;
  onCitationClick?: (seq: number) => void;
  className?: string;
}

export const QuietCatchUpModal: React.FC<QuietCatchUpModalProps> = ({
  isOpen,
  onClose,
  summary,
  onCitationClick,
  className = '',
}) => {
  if (!isOpen || !summary) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modal Résumé Quiet Catch-Up"
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm ${className}`}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-stone-900 border border-stone-800 shadow-xl">
        <QuietCatchUpCard
          summary={summary}
          onDismiss={onClose}
          onCitationClick={(seq) => {
            if (onCitationClick) onCitationClick(seq);
            onClose();
          }}
        />
      </div>
    </div>
  );
};
