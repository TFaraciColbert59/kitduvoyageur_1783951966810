'use client';

import React from 'react';
import type { TerraDraftAction } from '../../types/terra.types';

export interface TerraDraftActionCardProps {
  draft: TerraDraftAction;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  className?: string;
}

export const TerraDraftActionCard: React.FC<TerraDraftActionCardProps> = ({
  draft,
  onApprove,
  onReject,
  className = '',
}) => {
  const sequences = draft.source_message_sequences || draft.sourceMessageSequences || [];
  const payload = draft.proposed_payload || draft.proposedPayload || {};
  const actionType = draft.action_type || draft.actionType;

  return (
    <article
      aria-label="Proposition Terra en attente de validation"
      className={`bg-stone-900/90 border border-stone-700/60 rounded-2xl p-4 text-stone-100 shadow-lg ${className}`}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800">
        <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-forest-900/60 text-forest-300 border border-forest-700/40">
          Proposition Terra • Brouillon
        </span>
        <span className="text-xs text-stone-400 font-mono">
          seqs: [{sequences.join(', ')}]
        </span>
      </div>

      <div className="my-2">
        <h4 className="text-sm font-semibold text-stone-100">
          Type d&apos;action: {actionType}
        </h4>
        <pre className="mt-1 p-2 bg-stone-950/80 rounded-lg text-xs font-mono text-stone-300 overflow-x-auto border border-stone-800/60">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>

      <div className="mt-3 pt-3 flex gap-3 border-t border-stone-800/80">
        <button
          type="button"
          aria-label="Approuver la proposition"
          onClick={() => onApprove && onApprove(draft.id)}
          className="min-h-[44px] min-w-[44px] h-[44px] flex-1 px-4 rounded-xl bg-forest-600 hover:bg-forest-500 text-stone-100 font-medium text-sm flex items-center justify-center transition-colors active:scale-95"
        >
          Approuver
        </button>
        <button
          type="button"
          aria-label="Rejeter la proposition"
          onClick={() => onReject && onReject(draft.id)}
          className="min-h-[44px] min-w-[44px] h-[44px] flex-1 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-sm flex items-center justify-center border border-stone-700 transition-colors active:scale-95"
        >
          Rejeter
        </button>
      </div>
    </article>
  );
};
