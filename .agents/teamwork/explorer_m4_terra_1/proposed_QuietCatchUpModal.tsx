'use client';

import React from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { QuietCatchUpCard } from './proposed_QuietCatchUpCard';
import type { QuietCatchUpSummary } from '../types/terra.types';

export interface QuietCatchUpModalProps {
  isOpen: boolean;
  summary: QuietCatchUpSummary | null;
  onClose: () => void;
  onSelectCitation?: (sequenceNumber: number) => void;
}

export const QuietCatchUpModal: React.FC<QuietCatchUpModalProps> = ({
  isOpen,
  summary,
  onClose,
  onSelectCitation,
}) => {
  const { haptic } = useHapticFeedback();

  if (!isOpen || !summary) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      haptic('light');
      onClose();
    }
  };

  const handleSelectCitation = (seq: number) => {
    onSelectCitation?.(seq);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rattrapage Quiet Catch-Up"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm transition-all sm:items-center sm:p-4"
    >
      <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-200">
        <QuietCatchUpCard
          summary={summary}
          onSelectCitation={handleSelectCitation}
          onDismiss={onClose}
          className="max-h-[85vh] overflow-y-auto rounded-b-none sm:rounded-2xl"
        />
      </div>
    </div>
  );
};
