'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useActiveAdventure, SECTION_RESUME_MAX_AGE_MS } from '../context/ActiveAdventureContext';
import {
  hubSectionRegistry,
  hubSectionHref,
  isHubSectionServable,
  type HubAdventureRef,
} from '../registry/hubSectionRegistry';
import type { HubSectionId } from '../engine/hubProfileEngine';
import type { ActiveAdventureData } from '../context/adventureSchema';

export interface HubResumeBannerProps {
  adventure?: ActiveAdventureData | null;
  className?: string;
}

export function HubResumeBanner({ adventure: propAdventure, className = '' }: HubResumeBannerProps) {
  const { activeAdventure: contextAdventure, getLastSectionRecord } = useActiveAdventure();
  const adventure = propAdventure ?? contextAdventure;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !adventure) return null;

  const key =
    adventure.nature === 'possession'
      ? 'possession'
      : adventure.nature === 'sortie' && adventure.slug
        ? `sortie:${adventure.slug}`
        : adventure.nature === 'collectif' && adventure.id
          ? `collectif:${adventure.id}`
          : null;

  if (!key) return null;

  const record = getLastSectionRecord(key);
  if (!record || !record.sectionId || !record.timestamp) return null;

  // Verification 24h (86_400_000 ms)
  const age = Date.now() - record.timestamp;
  if (age < 0 || age >= SECTION_RESUME_MAX_AGE_MS) return null;

  const def = hubSectionRegistry.find((s) => s.id === record.sectionId);
  if (!def || def.id === 'overview') return null;

  if (!isHubSectionServable(def, adventure.nature)) return null;

  const adventureRef: HubAdventureRef =
    adventure.nature === 'sortie'
      ? { nature: 'sortie', slug: adventure.slug }
      : { nature: adventure.nature };

  let href: string;
  try {
    href = hubSectionHref(adventureRef, def.id as HubSectionId);
  } catch {
    return null;
  }

  // Explicit, visible button: "Reprendre : <section_label>"
  // Strictly NO automatic redirection or drawer opening
  return (
    <div
      data-testid="hub-resume-banner"
      className={`w-full rounded-xl border border-[var(--lkv-border)] bg-[var(--lkv-surface)] p-3 text-[var(--lkv-text-primary)] shadow-sm backdrop-blur-md ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--lkv-primary)]/10 text-[var(--lkv-primary)]">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="truncate">
            <p className="text-xs text-[var(--lkv-text-secondary)]">Dernière section consultée</p>
            <p className="text-sm font-semibold truncate">{def.label}</p>
          </div>
        </div>
        <Link
          href={href}
          data-testid="hub-resume-button"
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg bg-[var(--lkv-primary)] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 active:scale-95"
        >
          <span>Reprendre : {def.label}</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
