'use client';

import Icon from '@/components/ui/Icon';
import React, { useState, useTransition } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Button, Card, Chip } from '@/components/ui';
import { formatTripShareUrl } from '../engine/exportEngine';
import { tripSectionHref } from '../registry/tripSectionRegistry';
import { updateTripVisibilityAction } from '@/app/voyages/share-actions';
import type { TripFull, TripVisibility } from '../types/trip.types';

const FIELD_CLASS =
  'min-h-[var(--control-height-md)] w-full select-all rounded-[var(--lkv-radius-control)] border border-[color:var(--lkv-border)] bg-[color:var(--lkv-field-bg)] px-[var(--space-3)] font-mono text-[length:var(--lkv-text-footnote)] text-[var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]';

const LABEL_CLASS =
  'mb-[var(--space-2)] block text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)]';

const EXPORT_LINK_CLASS =
  'flex min-h-[44px] items-center justify-center gap-[var(--space-2)] rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-4)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--lkv-text-primary)] backdrop-blur-[var(--blur-md)] transition-colors hover:bg-[color:var(--lkv-hover-surface)]';

interface TripShareModalProps {
  trip: TripFull;
  isOpen: boolean;
  onClose: () => void;
}

export function TripShareModal({ trip, isOpen, onClose }: TripShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [visibility, setVisibility] = useState<TripVisibility>(trip.visibility);
  const [visError, setVisError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) return null;

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://lekitduvoyageur.fr';
  const shareUrl = formatTripShareUrl(trip.slug, trip.share_token, origin);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleVisibilityChange = (newVis: TripVisibility) => {
    setVisibility(newVis);
    setVisError(null);
    startTransition(async () => {
      const res = await updateTripVisibilityAction(trip.id, newVis, trip.slug);
      if (!res.success) {
        setVisError(res.error || 'Impossible de modifier la visibilité');
        setVisibility(trip.visibility);
      }
    });
  };

  const isOwner = trip.permissions.canInvite;

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Partager &amp; Exporter l'Expédition"
    >
      <div className="space-y-[var(--space-5)] pb-2">
        {/* 1. Visibilité du voyage */}
        <div className="space-y-[var(--space-2)]">
          <span className={LABEL_CLASS}>Niveau de confidentialité du voyage</span>
          <div className="grid grid-cols-3 gap-[var(--space-2)]">
            <Chip
              selected={visibility === 'private'}
              onClick={() => handleVisibilityChange('private')}
              disabled={!isOwner || isPending}
              className="flex-col items-start !rounded-[var(--lkv-radius-md)] p-[var(--space-3)] text-left"
            >
              <span className="flex items-center gap-[var(--space-2)] font-bold">
                <Icon name="lock" size={14} />
                <span>Privé</span>
              </span>
              <span className="mt-1 text-[10px] opacity-80">Membres seuls</span>
            </Chip>

            <Chip
              selected={visibility === 'unlisted'}
              onClick={() => handleVisibilityChange('unlisted')}
              disabled={!isOwner || isPending}
              className="flex-col items-start !rounded-[var(--lkv-radius-md)] p-[var(--space-3)] text-left"
            >
              <span className="flex items-center gap-[var(--space-2)] font-bold">
                <Icon name="eye-off" size={14} />
                <span>Lien secret</span>
              </span>
              <span className="mt-1 text-[10px] opacity-80">Ceux avec le lien</span>
            </Chip>

            <Chip
              selected={visibility === 'public'}
              onClick={() => handleVisibilityChange('public')}
              disabled={!isOwner || isPending}
              className="flex-col items-start !rounded-[var(--lkv-radius-md)] p-[var(--space-3)] text-left"
            >
              <span className="flex items-center gap-[var(--space-2)] font-bold">
                <Icon name="globe" size={14} />
                <span>Public</span>
              </span>
              <span className="mt-1 text-[10px] opacity-80">Visible de tous</span>
            </Chip>
          </div>
        </div>
        {visError && (
          <Card
            role="alert"
            tone="danger"
            className="p-[var(--space-3)] text-[length:var(--lkv-text-footnote)] text-[color:var(--lkv-danger-dark)]"
          >
            {visError}
          </Card>
        )}

        {/* 2. Lien de partage */}
        <div className="space-y-[var(--space-2)]">
          <span className={LABEL_CLASS}>Lien d&apos;accès direct</span>
          <div className="flex items-center gap-[var(--space-2)]">
            <input
              type="text"
              readOnly
              value={shareUrl}
              aria-label="Lien d'accès direct"
              className={FIELD_CLASS}
            />
            <Button
              onClick={handleCopy}
              variant="primary"
              size="sm"
              icon={copied ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}
              className="shrink-0"
            >
              {copied ? 'Copié !' : 'Copier'}
            </Button>
          </div>
        </div>

        {/* Règle RGPD Documents */}
        <Card variant="compact" className="flex items-start gap-[var(--space-2)] text-[11px] text-[color:var(--lkv-text-muted)]">
          <Icon
            name="shield-alert"
            size={16}
            className="mt-0.5 shrink-0 text-[color:var(--lkv-secondary)]"
          />
          <span>
            <strong>Sécurité des documents :</strong> Les pièces sensibles (passeports,
            attestations) restent protégées et ne sont jamais partagées via ce lien.
          </span>
        </Card>

        {/* 3. Exports disponibles */}
        <div className="space-y-[var(--space-2)] border-t border-[color:var(--lkv-border-subtle)] pt-[var(--space-2)]">
          <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
            <a
              href={`/api/voyages/${trip.slug}/gpx?token=${trip.share_token}`}
              download={`${trip.slug}.gpx`}
              className={EXPORT_LINK_CLASS}
            >
              <Icon name="download" size={15} className="text-[color:var(--lkv-secondary)]" />
              <span>Trace GPX 1.1</span>
            </a>

            <a
              href={tripSectionHref(trip.slug, 'export')}
              target="_blank"
              rel="noopener noreferrer"
              className={`${EXPORT_LINK_CLASS} w-full`}
            >
              <Icon name="printer" size={15} className="text-[color:var(--lkv-secondary)]" />
              <span>Feuille de Route / PDF</span>
            </a>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
