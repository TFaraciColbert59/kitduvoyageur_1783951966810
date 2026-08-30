'use client';
import { useState } from 'react';
import { Users, PhoneCall, ShieldCheck, Share2, Check, AlertOctagon, Radio } from 'lucide-react';
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
  const [copied, setCopied] = useState(false);

  if ((!participants || participants.length === 0) && !emergencyContact) return null;

  const handleShare = async () => {
    const text = `Fiche de départ LKDV\nÉquipe : ${participants.map((p) => p.name).join(', ')}\nContact d'urgence ICE : ${emergencyContact || 'Non renseigné'}\nLien : ${typeof window !== 'undefined' ? window.location.href : ''}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Fiche de départ & Sécurité LKDV',
          text,
          url: window.location.href,
        });
        return;
      } catch {}
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <GlassCard tone="neutral" as="article" ariaLabelledBy="participants-heading">
      <div className="p-4 sm:p-5 space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            id="participants-heading"
            className="text-xs sm:text-[13px] font-bold text-[#17402C] flex items-center gap-2"
          >
            <Users size={15} className="text-[#2D6B4A]" aria-hidden="true" />
            <span>Équipe & Sécurité</span>
          </h2>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#5A7064]">
              {participants.length} randonneur{participants.length > 1 ? 's' : ''}
            </span>

            <button
              type="button"
              onClick={handleShare}
              className="text-[11px] font-bold text-[#2D6B4A] hover:underline flex items-center gap-1 cursor-pointer"
              title="Partager les coordonnées d’urgence"
            >
              {copied ? <Check size={11} /> : <Share2 size={11} />}
              <span>{copied ? 'Copié !' : 'Partager'}</span>
            </button>
          </div>
        </div>

        {/* Liste des participants */}
        <div className="flex flex-wrap gap-2">
          {participants.map((p, idx) => (
            <div
              key={p.name || idx}
              className="glass-sub-card px-3 py-1.5 flex items-center gap-2"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10.5px] font-bold shadow-2xs shrink-0"
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
                <p className="text-xs font-mono font-bold text-[#17402C] truncate">
                  {emergencyContact}
                </p>
              </div>
            </div>

            <a
              href={`tel:${emergencyContact.replace(/\s+/g, '')}`}
              className="glass-capsule-btn danger px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shrink-0"
              aria-label={`Appeler le contact d'urgence au ${emergencyContact}`}
            >
              <PhoneCall size={12} aria-hidden="true" />
              <span>Appeler</span>
            </a>
          </div>
        )}

        {/* ════ NUMÉROS D'URGENCE & SECOURS MONTAGNE (§Phase 5) ════ */}
        <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A7064] block">
            Secours en Montagne & Territoire
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <a
              href="tel:112"
              className="p-2 rounded-xl bg-white/70 dark:bg-white/10 border border-white/60 flex items-center justify-between hover:bg-white text-[#17402C] font-semibold cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <AlertOctagon size={13} className="text-[#8A241B]" />
                <span>112 (Europe)</span>
              </div>
              <PhoneCall size={11} className="text-[#5A7064]" />
            </a>

            <a
              href="tel:15"
              className="p-2 rounded-xl bg-white/70 dark:bg-white/10 border border-white/60 flex items-center justify-between hover:bg-white text-[#17402C] font-semibold cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Radio size={13} className="text-[#2D6B4A]" />
                <span>15 (SAMU / Urgence)</span>
              </div>
              <PhoneCall size={11} className="text-[#5A7064]" />
            </a>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
