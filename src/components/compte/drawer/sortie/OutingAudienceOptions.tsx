'use client';

import React from 'react';
import { Check, Globe2, Lock, Mountain, Users } from 'lucide-react';
import {
  OUTING_AUDIENCE_OPTIONS,
  type OutingAudienceKey,
  type StoredOutingVisibility,
} from '@/features/compte/domain/outingAudience';

const ICONS: Record<OutingAudienceKey, typeof Lock> = {
  private: Lock,
  followers: Users,
  public: Globe2,
  collective_anonymized: Mountain,
};

export interface OutingAudienceOptionsProps {
  /** Valeur sélectionnée dans le brouillon local. */
  value: StoredOutingVisibility;
  onChange: (value: StoredOutingVisibility) => void;
  /** Toutes les options sont gelées pendant une écriture. */
  disabled?: boolean;
  /** Libellé du groupe ; la feuille de lot parle de plusieurs sorties. */
  label?: string;
}

/**
 * Choix d'audience d'une sortie. Les options non portées par le contrat
 * serveur restent visibles et focalisables, avec leur raison : les masquer
 * laisserait croire que Public et Abonnés existent déjà.
 */
export function OutingAudienceOptions({
  value,
  onChange,
  disabled = false,
  label = 'Qui peut voir cette sortie ?',
}: OutingAudienceOptionsProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-col gap-2"
      aria-busy={disabled ? 'true' : undefined}
    >
      {OUTING_AUDIENCE_OPTIONS.map((option) => {
        const selected =
          option.storedVisibility !== null && option.storedVisibility === value;
        const Icon = ICONS[option.key];
        const blocked = !option.available || option.storedVisibility === null;
        return (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={blocked || disabled ? 'true' : undefined}
            disabled={disabled}
            onClick={() => {
              if (!blocked && option.storedVisibility) {
                onChange(option.storedVisibility);
              }
            }}
            className={`flex w-full items-start gap-3 rounded-[var(--lkv-radius-md)] border px-3 py-2.5 text-left transition-colors motion-reduce:transition-none ${
              selected
                ? 'border-[color:var(--lkv-primary)] bg-[color:var(--lkv-primary)] text-white'
                : blocked
                  ? 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--label2)] opacity-70'
                  : 'border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] text-[color:var(--label)]'
            }`}
            style={{ minHeight: 56 }}
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                selected
                  ? 'bg-white/15 text-white'
                  : 'bg-[color:var(--lkv-primary)]/10 text-[color:var(--lkv-primary)]'
              }`}
            >
              <Icon size={17} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-semibold leading-tight">
                  {option.label}
                </span>
                {blocked ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.06em] ${
                      selected
                        ? 'bg-white/15 text-white'
                        : 'bg-[color:var(--label2)]/10 text-[color:var(--label2)]'
                    }`}
                  >
                    Indisponible
                  </span>
                ) : null}
              </span>
              <span
                className={`mt-0.5 block text-[11.5px] leading-snug ${
                  selected ? 'text-white/80' : 'text-[color:var(--label2)]'
                }`}
              >
                {option.hint}
              </span>
              {option.reason ? (
                <span
                  className={`mt-1 block text-[11px] leading-snug ${
                    selected ? 'text-white/75' : 'text-[color:var(--label2)]'
                  }`}
                >
                  {option.reason}
                </span>
              ) : null}
              {option.note ? (
                <span
                  className={`mt-1 block text-[11px] leading-snug ${
                    selected ? 'text-white/75' : 'text-[color:var(--label2)]'
                  }`}
                >
                  {option.note}
                </span>
              ) : null}
            </span>
            {selected ? (
              <Check
                size={17}
                aria-hidden="true"
                className="mt-1 shrink-0 text-white"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export default OutingAudienceOptions;
