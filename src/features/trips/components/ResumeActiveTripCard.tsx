'use client';

import Icon from '@/components/ui/Icon';
import React from 'react';
import Link from 'next/link';
import { useActiveTrip } from '@/features/trips/context/ActiveTripContext';
import { tripSectionHref } from '@/features/trips/registry/tripSectionRegistry';
import { IconButton } from '@/components/ui';

const LINK_SECONDARY_CLASS =
  'inline-flex min-h-[var(--control-height-sm)] items-center gap-[var(--space-2)] rounded-full border border-[color:var(--glass-border)] bg-[color:var(--card-tint-strong)] px-[var(--space-4)] text-[length:var(--lkv-text-footnote)] font-semibold text-[color:var(--card-content)] backdrop-blur-[var(--blur-md)] transition-colors hover:bg-[color:var(--lkv-hover-surface)]';

export function ResumeActiveTripCard() {
  const { activeTrip, clearActiveTrip, isPending } = useActiveTrip();

  if (!activeTrip) return null;

  return (
    <section className="relative z-[var(--z-sticky)] mx-auto -mb-16 max-w-[var(--page-max-w)] px-4 pt-24">
      <div className="relative overflow-hidden rounded-[var(--lkv-radius-card)] border border-[color:var(--lkv-secondary)]/30 bg-[linear-gradient(to_right,var(--lkv-primary),var(--lkv-primary-soft),var(--lkv-primary-soft))] p-[var(--space-5)] text-[color:var(--lkv-text-inverted)] shadow-elevation-3 backdrop-blur-[var(--blur-md)] transition-all hover:border-[color:var(--lkv-secondary)]/50 sm:p-[var(--space-6)]">
        {/* Glow ambient background */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[color:var(--lkv-secondary)]/15 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between gap-[var(--space-4)] md:flex-row md:items-center">
          <div className="min-w-0 space-y-[var(--space-1)]">
            <div className="flex items-center gap-[var(--space-2)]">
              <span className="inline-flex items-center gap-[var(--space-2)] rounded-full border border-[color:var(--lkv-secondary)]/30 bg-[color:var(--lkv-secondary)]/20 px-[var(--space-3)] py-0.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--lkv-text-inverted)]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--lkv-secondary)] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--lkv-secondary)]" />
                </span>
                Expédition en cours
              </span>
              <span className="hidden text-[length:var(--lkv-text-footnote)] text-white/50 sm:inline">
                • Reprise rapide
              </span>
            </div>

            <h3 className="truncate text-[length:var(--lkv-text-title-sm)] font-bold tracking-tight sm:text-[length:var(--lkv-text-title-lg)]">
              {activeTrip.title}
            </h3>
            <p className="text-[length:var(--lkv-text-footnote)] text-white/70 sm:text-[length:var(--lkv-text-body-sm)]">
              Votre itinéraire et matériel sont synchronisés sur tout le site.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-[var(--space-3)] pt-[var(--space-2)] md:pt-0">
            <Link
              href={tripSectionHref(activeTrip.slug, 'overview')}
              className="inline-flex min-h-[var(--control-height-sm)] items-center gap-[var(--space-2)] rounded-full bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn px-[var(--space-4)] text-[length:var(--lkv-text-footnote)] font-bold text-[color:var(--lkv-text-primary)] transition-colors hover:brightness-[1.05]"
            >
              <Icon name="compass" size={14} />
              <span>Reprendre le voyage</span>
              <Icon name="arrow-right" size={13} />
            </Link>

            <Link href={`${tripSectionHref(activeTrip.slug, 'overview')}?phase=live`} className={LINK_SECONDARY_CLASS}>
              <Icon name="radio" size={13} />
              <span>Cockpit</span>
            </Link>

            <Link href="/hub" className={LINK_SECONDARY_CLASS}>
              <Icon name="package" size={13} />
              <span>Mon sac</span>
            </Link>

            <IconButton
              type="button"
              size="sm"
              onClick={() => clearActiveTrip()}
              disabled={isPending}
              aria-label="Fermer l'expédition active"
              title="Désactiver l'expédition active"
            >
              <Icon name="x" size={14} />
            </IconButton>
          </div>
        </div>
      </div>
    </section>
  );
}
