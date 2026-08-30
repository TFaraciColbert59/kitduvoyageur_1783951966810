'use client';
import { Users, PhoneCall, ShieldCheck } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import type { Participant } from '@/features/materiel/types/trekHub';

interface DepartParticipantsProps {
  participants: Participant[];
  emergencyContact: string | null;
}

export function DepartParticipants({
  participants,
  emergencyContact,
}: DepartParticipantsProps) {
  if ((!participants || participants.length === 0) && !emergencyContact) return null;

  return (
    <GlassCard tone="neutral" ariaLabelledBy="participants-heading">
      <div className="p-4 sm:p-5 space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            id="participants-heading"
            className="text-[13px] sm:text-sm font-semibold text-[#17402C] flex items-center gap-2"
          >
            <Users size={15} className="text-[#5A7064]" aria-hidden="true" />
            Équipe & Sécurité
          </h2>
          <span className="text-xs font-mono text-[#5A7064]">
            {participants.length} randonneur{participants.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Liste des participants */}
        <div className="flex flex-wrap gap-2">
          {participants.map((p, idx) => (
            <div
              key={p.name || idx}
              className="glass-sub-card px-3 py-1.5 flex items-center gap-2"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-2xs shrink-0"
                style={{ backgroundColor: p.color || '#17402C' }}
                aria-hidden="true"
              >
                {p.initial || p.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-[#17402C] truncate max-w-[140px]">
                {p.name}
              </span>
            </div>
          ))}
        </div>

        {/* Contact d'urgence ICE */}
        {emergencyContact && (
          <div className="glass-sub-card p-3 flex items-center justify-between gap-3 bg-[rgba(168,68,58,0.06)] border-[rgba(168,68,58,0.20)]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[rgba(168,68,58,0.12)] text-[#8A241B] flex items-center justify-center shrink-0">
                <ShieldCheck size={16} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A241B]">
                  Contact d’urgence (ICE)
                </p>
                <p className="text-xs sm:text-[13px] font-mono font-bold text-[#17402C] truncate">
                  {emergencyContact}
                </p>
              </div>
            </div>

            <a
              href={`tel:${emergencyContact.replace(/\s+/g, '')}`}
              className="glass-capsule-btn primary !h-8 !px-3 !text-xs shrink-0 flex items-center gap-1.5"
              aria-label={`Appeler le contact d'urgence : ${emergencyContact}`}
            >
              <PhoneCall size={12} aria-hidden="true" />
              <span>Appeler</span>
            </a>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
