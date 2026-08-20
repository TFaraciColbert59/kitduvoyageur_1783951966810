'use client';
import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Eyebrow } from '@/components/ui/Eyebrow';

export interface Participant {
  name: string;
  initial: string;
  color: string;
}

const AVATAR_COLORS = ['#5B7F55', '#4B6B7C', '#C89A3B', '#7A7365', '#A8443A'];

/** W-D-7 ParticipantsEmergency — avatars empilés + contact d'urgence masqué. */
export function ParticipantsEmergency({ participants, emergencyContact }: { participants: Participant[]; emergencyContact?: string | null }) {
  const [revealed, setRevealed] = useState(false);
  const shown = participants.slice(0, 5);
  const extra = Math.max(0, participants.length - 5);

  return (
    <GlassCard as="article" ariaLabelledBy="participants-title" className="p-4">
      <Eyebrow>Participants & urgence</Eyebrow>
      <h3 id="participants-title" className="sr-only">Participants et contact d'urgence</h3>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex -space-x-2">
          {shown.map((p, i) => (
            <span
              key={p.name}
              title={p.name}
              className="h-8 w-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white ring-2 ring-stone-50"
              style={{ backgroundColor: p.color || AVATAR_COLORS[i % AVATAR_COLORS.length] }}
            >
              {p.initial}
            </span>
          ))}
          {extra > 0 && (
            <span className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-[color:var(--label)] bg-stone-200 ring-2 ring-stone-50">
              +{extra}
            </span>
          )}
        </div>
        <span className="text-sm text-[color:var(--label-secondary)]">{participants.length} participant(s)</span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-[color:var(--label-tertiary)]">Contact d'urgence</span>
        {revealed && emergencyContact ? (
          <span className="text-sm font-medium text-[color:var(--label)]">{emergencyContact}</span>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="glass interactive h-8 px-3 rounded-full text-xs font-medium text-sage-600"
          >
            Révéler
          </button>
        )}
      </div>
    </GlassCard>
  );
}
