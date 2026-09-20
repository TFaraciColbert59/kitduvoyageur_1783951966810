'use client';

import Icon from '@/components/ui/Icon';
import React, { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import type { TripFull } from '../types/trip.types';

export interface TripInviteButtonProps {
  trip: TripFull;
  className?: string;
}

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] w-full select-all rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] font-mono text-[length:var(--lkv-text-footnote)] text-[var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

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
 * (`Sheet` canonique) qui partage le lien `/rejoindre/<slug>`.
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
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className={className}
        icon={<Icon name="user-plus" size={14} />}
        aria-label="Inviter des amis"
        onClick={() => {
          triggerHaptic('light');
          setOpen(true);
        }}
      >
        Inviter des amis
      </Button>

      <Sheet open={open} onOpenChange={setOpen} title="Inviter des amis">
        <div className="space-y-[var(--space-4)] pb-2">
          <p className="text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)]">
            Partager ce lien pour préparer à plusieurs
          </p>
          <div className="flex items-center gap-[var(--space-2)]">
            <input
              type="text"
              readOnly
              value={joinUrl}
              aria-label="Lien d'invitation"
              className={FIELD_CLASS}
            />
            <Button
              type="button"
              onClick={handleCopy}
              variant="primary"
              size="sm"
              icon={copied ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}
              className="shrink-0"
            >
              {copied ? 'Copié !' : 'Copier'}
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-[color:var(--lkv-text-primary)]/70">
            Chaque personne qui rejoint choisit explicitement d&apos;utiliser son profil
            d&apos;auto-apprentissage ; sinon la préparation s&apos;appuie sur des moyennes
            population. Les quantités et le budget se recalculent à chaque arrivée.
          </p>
        </div>
      </Sheet>
    </>
  );
}

export default TripInviteButton;
