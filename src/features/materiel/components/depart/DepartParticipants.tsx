'use client';
import Icon from '@/components/ui/Icon';
import { useState } from 'react';
import { UsersIcon as Users } from '@/components/icons/users';
import { AlertOctagonIcon as AlertOctagon } from '@/components/icons/alert-octagon';
import { RadioIcon as Radio } from '@/components/icons/radio';
import { Share2Icon as Share2 } from '@/components/icons/share-2';
import { PhoneCallIcon as PhoneCallAnimated } from '@/components/icons/phone-call';
import { Badge, Button, Card } from '@/components/ui';
import type { Participant } from '@/features/materiel/types/trekHub';

interface DepartParticipantsProps {
  participants: Participant[];
  emergencyContact: string | null;
}

export function DepartParticipants({ participants, emergencyContact }: DepartParticipantsProps) {
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
    <Card tone="neutral" as="article" ariaLabelledBy="participants-heading">
      <div className="p-4 sm:p-5 space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            id="participants-heading"
            className="text-xs sm:text-[13px] font-bold text-[var(--lkv-primary)] flex items-center gap-2"
          >
            <Users size={15} className="text-[var(--lkv-primary-hover)]" aria-hidden="true" />
            <span>Équipe & Sécurité</span>
          </h2>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[var(--lkv-text-muted)]">
              {participants.length} randonneur{participants.length > 1 ? 's' : ''}
            </span>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              icon={copied ? <Icon name="check" size={11} /> : <Share2 size={11} />}
              className="h-auto gap-1 px-0 text-[11px] font-bold text-[var(--lkv-primary-hover)] hover:underline"
              title="Partager les coordonnées d’urgence"
            >
              {copied ? 'Copié !' : 'Partager'}
            </Button>
          </div>
        </div>

        {/* Liste des participants */}
        <div className="flex flex-wrap gap-2">
          {participants.map((p, idx) => (
            <Badge key={p.name || idx} tone="stone" className="gap-2 px-3 py-1.5">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold text-white shadow-2xs"
                style={{ backgroundColor: p.color || 'var(--lkv-primary)' }}
                aria-hidden="true"
              >
                {p.initial || p.name.charAt(0).toUpperCase()}
              </span>
              <span className="max-w-[140px] truncate text-xs font-semibold text-[var(--lkv-primary)]">
                {p.name}
              </span>
            </Badge>
          ))}
        </div>

        {/* Contact d'urgence ICE */}
        {emergencyContact && (
          <Card tone="danger" className="flex items-center justify-between gap-3 p-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--lkv-danger-bg)] text-[var(--lkv-danger)]">
                <Icon name="shield-check" size={16} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--lkv-danger)]">
                  Contact d’urgence (ICE)
                </p>
                <p className="text-xs font-mono font-bold text-[var(--lkv-primary)] truncate">
                  {emergencyContact}
                </p>
              </div>
            </div>

            <a
              href={`tel:${emergencyContact.replace(/\s+/g, '')}`}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-[var(--lkv-danger)] px-3 text-xs font-semibold text-[var(--lkv-text-inverted)] transition-transform active:scale-[var(--motion-press-scale)] motion-reduce:transition-none"
              aria-label={`Appeler le contact d'urgence au ${emergencyContact}`}
            >
              <PhoneCallAnimated size={12} aria-hidden="true" />
              <span>Appeler</span>
            </a>
          </Card>
        )}

        {/* ════ NUMÉROS D'URGENCE & SECOURS MONTAGNE (§Phase 5) ════ */}
        <div className="p-2.5 rounded-xl bg-black/5 space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--lkv-text-muted)] block">
            Secours en Montagne & Territoire
          </span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <a
              href="tel:112"
              className="p-2 rounded-xl bg-white/70 border border-white/60 flex items-center justify-between hover:bg-white text-[var(--lkv-primary)] font-semibold cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <AlertOctagon size={13} className="text-[var(--lkv-danger)]" />
                <span>112 (Europe)</span>
              </div>
              <Icon name="phone-call" size={11} className="text-[var(--lkv-text-muted)]" />
            </a>

            <a
              href="tel:15"
              className="p-2 rounded-xl bg-white/70 border border-white/60 flex items-center justify-between hover:bg-white text-[var(--lkv-primary)] font-semibold cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Radio size={13} className="text-[var(--lkv-primary-hover)]" />
                <span>15 (SAMU / Urgence)</span>
              </div>
              <Icon name="phone-call" size={11} className="text-[var(--lkv-text-muted)]" />
            </a>
          </div>
        </div>
      </div>
    </Card>
  );
}
