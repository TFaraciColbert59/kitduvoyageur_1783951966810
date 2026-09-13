'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { GlassModal } from '@/components/ui/GlassModal';
import { GlassCapsuleBtn } from '@/components/ui/GlassCapsuleBtn';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { TripFull } from '../types/trip.types';

export interface TripInviteButtonProps {
  trip: TripFull;
  className?: string;
}

/** URL canonique du flux « Rejoindre » (token de partage si disponible). */
export function buildJoinUrl(
  slug: string,
  shareToken?: string | null,
  origin = ''
): string {
  const base = origin.replace(/\/$/, '');
  const query = shareToken ? `?token=${encodeURIComponent(shareToken)}` : '';
  return `${base}/rejoindre/${encodeURIComponent(slug)}${query}`;
}

/**
 * Task 17 — Bouton « Inviter des amis » de l'itinéraire : ouvre une modale
 * glass (patron `TripShareModal`) qui partage le lien `/rejoindre/<slug>`.
 * La personne invitée consent explicitement avant tout snapshot de profil.
 */
export function TripInviteButton({ trip, className }: TripInviteButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { triggerHaptic } = useHapticFeedback();

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://lekitduvoyageur.fr';
  const joinUrl = buildJoinUrl(trip.slug, trip.share_token, origin);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Copie manuelle possible : le champ reste sélectionnable.
    }
  };

  return (
    <>
      <GlassCapsuleBtn
        type="button"
        size="sm"
        className={className}
        icon={<Icon name="user-plus" className="w-3.5 h-3.5" />}
        aria-label="Inviter des amis"
        onClick={() => {
          triggerHaptic('light');
          setOpen(true);
        }}
      >
        Inviter des amis
      </GlassCapsuleBtn>

      <GlassModal
        open={open}
        onOpenChange={setOpen}
        title="Inviter des amis"
        variant="sheet"
      >
        <div className="space-y-4 pb-2">
          <p className="text-sm font-bold text-[var(--lkv-text-primary)]">
            Partager ce lien pour préparer à plusieurs
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={joinUrl}
              aria-label="Lien d'invitation"
              className="glass-input w-full px-3 py-2 text-xs font-mono text-[var(--lkv-text-primary)] select-all"
            />
            <GlassCapsuleBtn
              type="button"
              onClick={handleCopy}
              variant="primary"
              size="sm"
              icon={copied ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}
              className="shrink-0"
            >
              {copied ? 'Copié !' : 'Copier'}
            </GlassCapsuleBtn>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--lkv-text-primary)]/70">
            Chaque personne qui rejoint choisit explicitement d&apos;utiliser son profil
            d&apos;auto-apprentissage ; sinon la préparation s&apos;appuie sur des moyennes
            population. Les quantités et le budget se recalculent à chaque arrivée.
          </p>
        </div>
      </GlassModal>
    </>
  );
}

export default TripInviteButton;
