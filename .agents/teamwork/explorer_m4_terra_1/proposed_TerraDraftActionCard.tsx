'use client';

import React, { useState } from 'react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type {
  TerraDraftAction,
  CreatePollPayload,
  CreateExpeditionPayload,
  ProposeTripDatePayload,
  UpdateChecklistPayload,
  AllocateGearPayload,
  SafetyAlertPayload,
  BroadcastRouteUpdatePayload,
} from '../types/terra.types';
import type { OutdoorRole } from '../types/clubs.types';

export interface TerraDraftActionCardProps {
  draftAction: TerraDraftAction;
  currentUserId?: string;
  userRole?: OutdoorRole;
  onApprove?: (actionId: string) => Promise<void> | void;
  onReject?: (actionId: string) => Promise<void> | void;
  onSelectCitation?: (sequenceNumber: number) => void;
  isProcessing?: boolean;
  className?: string;
}

export const TerraDraftActionCard: React.FC<TerraDraftActionCardProps> = ({
  draftAction,
  currentUserId,
  userRole = 'member',
  onApprove,
  onReject,
  onSelectCitation,
  isProcessing = false,
  className = '',
}) => {
  const { haptic } = useHapticFeedback();
  const [localStatus, setLocalStatus] = useState(draftAction.status);
  const [internalProcessing, setInternalProcessing] = useState(false);

  const status = localStatus;
  const isDraft = status === 'draft';
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';

  const handleApprove = async () => {
    haptic('success');
    setInternalProcessing(true);
    try {
      if (onApprove) {
        await onApprove(draftAction.id);
      }
      setLocalStatus('approved');
    } catch (err) {
      console.error('Failed to approve draft action', err);
    } finally {
      setInternalProcessing(false);
    }
  };

  const handleReject = async () => {
    haptic('warning');
    setInternalProcessing(true);
    try {
      if (onReject) {
        await onReject(draftAction.id);
      }
      setLocalStatus('rejected');
    } catch (err) {
      console.error('Failed to reject draft action', err);
    } finally {
      setInternalProcessing(false);
    }
  };

  const getActionHeader = () => {
    switch (draftAction.actionType) {
      case 'create_poll':
        return {
          icon: '📊',
          title: 'Sondage proposé',
          badge: 'Sondage',
          badgeBg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
        };
      case 'create_expedition':
      case 'propose_trip_date':
        return {
          icon: '⛺',
          title: 'Organisation de sortie',
          badge: 'Expédition',
          badgeBg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
        };
      case 'update_checklist':
      case 'allocate_gear':
        return {
          icon: '🎒',
          title: 'Mise à jour équipement',
          badge: 'Checklist / Matériel',
          badgeBg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
        };
      case 'safety_alert':
      case 'broadcast_route_update':
        return {
          icon: '⚠️',
          title: 'Alerte sécurité terrain',
          badge: 'Sécurité',
          badgeBg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
        };
      default:
        return {
          icon: '🤖',
          title: 'Proposition Terra AI',
          badge: 'Brouillon',
          badgeBg: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
        };
    }
  };

  const header = getActionHeader();

  const renderPayloadDetails = () => {
    const payload = draftAction.proposedPayload as Record<string, unknown>;

    if (draftAction.actionType === 'create_poll') {
      const poll = payload as unknown as CreatePollPayload;
      return (
        <div className="space-y-1.5 rounded-xl bg-black/[0.03] p-3 text-xs dark:bg-white/[0.03]">
          <p className="font-semibold text-[color:var(--lkv-text-primary)]">{poll.question}</p>
          {poll.options && (
            <ul className="mt-1 space-y-1">
              {poll.options.map((opt, i) => (
                <li key={i} className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border border-black/20 text-[10px] dark:border-white/20">
                    {i + 1}
                  </span>
                  <span>{opt}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    if (draftAction.actionType === 'create_expedition' || draftAction.actionType === 'propose_trip_date') {
      const exp = payload as unknown as CreateExpeditionPayload & ProposeTripDatePayload;
      return (
        <div className="space-y-1.5 rounded-xl bg-black/[0.03] p-3 text-xs dark:bg-white/[0.03]">
          <p className="font-semibold text-[color:var(--lkv-text-primary)]">{exp.title || exp.tripTitle}</p>
          {exp.destination && <p className="text-zinc-600 dark:text-zinc-300">📍 Destination : {exp.destination}</p>}
          {(exp.candidateDates || exp.proposedDates) && (
            <p className="text-zinc-600 dark:text-zinc-300">
              📅 Dates envisagées : {(exp.candidateDates || exp.proposedDates || []).join(', ')}
            </p>
          )}
        </div>
      );
    }

    if (draftAction.actionType === 'update_checklist' || draftAction.actionType === 'allocate_gear') {
      const gear = payload as unknown as UpdateChecklistPayload & AllocateGearPayload;
      return (
        <div className="space-y-1.5 rounded-xl bg-black/[0.03] p-3 text-xs dark:bg-white/[0.03]">
          {gear.gearItemName ? (
            <div>
              <p className="font-semibold">{gear.gearItemName}</p>
              <p className="text-zinc-600 dark:text-zinc-300">
                Poids : {gear.weightGrams}g — Porteur proposé : @{gear.assignedToName}
              </p>
            </div>
          ) : gear.items ? (
            <ul className="space-y-1">
              {gear.items.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span>•</span>
                  <span>{item.label}</span>
                  {item.assignedToName && <span className="opacity-75">(@{item.assignedToName})</span>}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      );
    }

    if (draftAction.actionType === 'safety_alert' || draftAction.actionType === 'broadcast_route_update') {
      const alert = payload as unknown as SafetyAlertPayload & BroadcastRouteUpdatePayload;
      return (
        <div className="space-y-1.5 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-900 dark:text-rose-200">
          <p className="font-semibold">{alert.hazardType ? `Alerte : ${alert.hazardType}` : alert.reason}</p>
          <p>{alert.message}</p>
          {alert.recommendedAction && <p className="italic">Consigne : {alert.recommendedAction}</p>}
        </div>
      );
    }

    return (
      <div className="rounded-xl bg-black/[0.03] p-2.5 text-xs text-zinc-600 dark:bg-white/[0.03] dark:text-zinc-400">
        {JSON.stringify(payload)}
      </div>
    );
  };

  return (
    <article
      aria-label={`Proposition Terra AI : ${header.title}`}
      className={`group relative my-2 flex w-full max-w-[340px] flex-col overflow-hidden rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-medium)] p-3.5 text-[color:var(--lkv-text-primary)] shadow-elevation-1 backdrop-blur-[var(--glass-blur-sm)] transition-all ${className}`}
    >
      {/* Top Bar : AI Tag & Status Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base select-none" aria-hidden="true">
            {header.icon}
          </span>
          <span className="font-semibold text-xs tracking-tight text-indigo-600 dark:text-indigo-400">
            Proposition Terra AI
          </span>
        </div>

        {/* Status Pill */}
        {isDraft && (
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
            Brouillon
          </span>
        )}
        {isApproved && (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
            ✓ Validé
          </span>
        )}
        {isRejected && (
          <span className="rounded-full bg-zinc-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-zinc-600 dark:text-zinc-400">
            ✕ Rejeté
          </span>
        )}
      </div>

      {/* Title & Explanation */}
      <div className="mt-2.5">
        <h4 className="text-sm font-bold leading-tight">{header.title}</h4>
        {draftAction.explanation && (
          <p className="mt-1 text-xs text-[color:var(--lkv-text-secondary)] leading-relaxed">
            {draftAction.explanation}
          </p>
        )}
      </div>

      {/* Source Citations */}
      {draftAction.sourceMessageSequences && draftAction.sourceMessageSequences.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-[color:var(--lkv-text-secondary)]">
          <span>Sources :</span>
          {draftAction.sourceMessageSequences.map((seq) => (
            <button
              key={`src-seq-${seq}`}
              type="button"
              onClick={() => {
                haptic('light');
                onSelectCitation?.(seq);
              }}
              className="inline-flex min-h-[28px] items-center rounded-md bg-black/[0.05] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-600 hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-indigo-300"
            >
              #seq {seq}
            </button>
          ))}
        </div>
      )}

      {/* Proposed Payload Content */}
      <div className="mt-3">{renderPayloadDetails()}</div>

      {/* Safety Notice for Draft State */}
      {isDraft && (
        <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400">
          🔒 Requiert une confirmation explicite d'un équipier avant exécution.
        </p>
      )}

      {/* Apple HIG 44px Interactive Actions Footer */}
      {isDraft ? (
        <div className="mt-3.5 flex items-center gap-2">
          {/* Approve Button (Apple HIG min-h 44px) */}
          <button
            type="button"
            disabled={isProcessing || internalProcessing}
            onClick={handleApprove}
            aria-label="Approuver la proposition Terra AI"
            className="flex h-11 min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
          >
            <span>✓</span>
            <span>Approuver</span>
          </button>

          {/* Reject Button (Apple HIG min-h 44px) */}
          <button
            type="button"
            disabled={isProcessing || internalProcessing}
            onClick={handleReject}
            aria-label="Rejeter la proposition Terra AI"
            className="flex h-11 min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-black/[0.06] px-4 text-xs font-semibold text-zinc-700 transition-all hover:bg-black/[0.10] active:scale-[0.98] disabled:opacity-50 dark:bg-white/[0.08] dark:text-zinc-200 dark:hover:bg-white/[0.12]"
          >
            <span>✕</span>
            <span>Rejeter</span>
          </button>
        </div>
      ) : (
        /* Resolved State Footer */
        <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-2 text-[11px] dark:border-white/[0.08]">
          <span className="text-zinc-500">
            {isApproved ? 'Action approuvée' : 'Action refusée'}
            {draftAction.reviewedByName ? ` par @${draftAction.reviewedByName}` : ''}
          </span>
          <span className="font-mono text-[10px] opacity-75">
            {draftAction.reviewedAt ? new Date(draftAction.reviewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
      )}
    </article>
  );
};
