'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Compass, Share2, Check, Plus } from 'lucide-react';
import { GlassSubCard, GlassPill, GlassCapsuleBtn } from '@/components/ui';
import { getPhaseLabel, type TripPhase } from '../engine/temporalPhaseEngine';
import type { TripProfile } from '../engine/tripProfileEngine';
import {
  tripSectionRegistry,
  tripSectionHref,
  sectionIdFromPathname,
  type TripSectionDef,
} from '../registry/tripSectionRegistry';
import type { TripFull } from '../types/trip.types';

export type { TripSectionId } from '../engine/tripProfileEngine';

export interface TripSidebarLeftProps {
  trip: TripFull;
  profile: TripProfile;
  activePhase: TripPhase;
  onToggleActive: () => void;
  isTripActive: boolean;
  isPending: boolean;
  onShare: () => void;
  /** Ouvre le TripSectionPicker (Y2.4) — sections masquées activables. */
  onOpenSectionPicker?: () => void;
}

/**
 * Y2.3 — Colonne gauche canonique du hub, pilotée par le registre des sections.
 * Navigation par <Link> (URLs réelles, partageables), état actif dérivé du
 * pathname, toutes les permissions appliquées (budget → canManageBudget,
 * docs → canViewDocuments), sections filtrées par profil (matrice) et phase.
 * Recettes de classes : docs/Y_HUB_SPEC §5 (au caractère près).
 */
export default function TripSidebarLeft({
  trip,
  profile,
  activePhase,
  onToggleActive,
  isTripActive,
  isPending,
  onShare,
  onOpenSectionPicker,
}: TripSidebarLeftProps) {
  const pathname = usePathname();
  const activeSection = sectionIdFromPathname(pathname);

  const visible = tripSectionRegistry.filter((s: TripSectionDef) => {
    if (!profile.sections.includes(s.id)) return false;
    if (!s.phases.includes(activePhase)) return false;
    if (s.permission && !trip.permissions[s.permission]) return false;
    return true;
  });

  const hiddenCount = profile.sections.length - visible.length;

  return (
    <aside
      className="h-full max-h-full w-full flex-1 flex flex-col justify-between glass rounded-[var(--lkv-radius-card)] p-3.5 text-[var(--lkv-text-primary)] font-sans overflow-hidden border border-white/40 shadow-sm select-none"
      aria-label="Navigation du voyage"
    >
      <div className="shrink-0 space-y-2.5">
        <nav aria-label="Fil d'Ariane" className="text-xs text-[var(--lkv-text-primary)]">
          <Link href="/voyages" className="inline-flex items-center gap-1.5 font-medium hover:underline">
            <ArrowLeft size={13} />
            <span>Tous les voyages</span>
          </Link>
        </nav>
        <GlassSubCard className="p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-lg" aria-hidden="true">&#x1F9ED;</span>
            <div className="min-w-0 flex-1">
              <h4 className="font-display font-bold text-xs sm:text-sm text-[var(--lkv-text-primary)] truncate leading-tight">
                {trip.title}
              </h4>
              <span className="text-[9.5px] font-mono uppercase tracking-widest text-[var(--lkv-text-secondary)] block truncate">
                {getPhaseLabel(activePhase)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <GlassPill className="text-[9px] font-mono font-bold">{trip.status}</GlassPill>
            {trip.destination_country_code && (
              <GlassPill className="text-[9px] font-mono">{trip.destination_country_code}</GlassPill>
            )}
          </div>
        </GlassSubCard>
        <div className="grid grid-cols-2 gap-1.5">
          <GlassCapsuleBtn
            variant={isTripActive ? 'default' : 'primary'}
            size="sm"
            onClick={onToggleActive}
            disabled={isPending}
            icon={isTripActive ? <Check size={13} /> : <Compass size={13} />}
            className="flex items-center justify-center gap-1.5 !py-1.5 !px-2 !text-[10.5px] min-h-[var(--lkv-touch-min)] w-full"
          >
            <span>{isTripActive ? 'Active' : 'Activer'}</span>
          </GlassCapsuleBtn>
          <GlassCapsuleBtn
            variant="default"
            size="sm"
            onClick={onShare}
            icon={<Share2 size={13} />}
            className="flex items-center justify-center gap-1.5 !py-1.5 !px-2 !text-[10.5px] min-h-[var(--lkv-touch-min)] w-full"
          >
            <span>Partager</span>
          </GlassCapsuleBtn>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2 space-y-1.5" aria-label="Sections du voyage">
        <p className="text-[9.5px] font-mono font-bold uppercase tracking-widest text-[var(--lkv-text-secondary)] px-2 mb-1">
          Navigation
        </p>
        {visible.map((s) => {
          const isActive = activeSection === s.id;
          const Icon = s.icon;
          const count = s.counter(trip);
          return (
            <Link
              key={s.id}
              href={tripSectionHref(trip.slug, s.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full px-3 py-2.5 rounded-[var(--lkv-radius-md)] font-bold text-xs transition-all flex items-center justify-between group cursor-pointer border ${
                isActive
                  ? 'bg-[var(--lkv-primary)] text-white border-[var(--lkv-primary)] shadow-sm'
                  : 'glass-sub-card border border-white/60 text-[var(--lkv-text-primary)] hover:bg-white shadow-2xs'
              }`}
            >
              <span className="truncate text-left flex items-center gap-2">
                <Icon size={13} className={isActive ? 'text-white/90 shrink-0' : 'text-[var(--lkv-text-secondary)] shrink-0'} />
                {s.label}
                {count !== null && count > 0 && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${
                      isActive ? 'bg-white/20 text-white' : 'text-[var(--lkv-text-muted)]'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </span>
            </Link>
          );
        })}

        {hiddenCount > 0 && onOpenSectionPicker && (
          <button
            type="button"
            onClick={onOpenSectionPicker}
            className="w-full px-3 py-2.5 rounded-[var(--lkv-radius-md)] font-bold text-xs transition-all flex items-center gap-2 border border-dashed border-white/70 glass-sub-card text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] hover:bg-white shadow-2xs cursor-pointer"
          >
            <Plus size={13} />
            <span>Ajouter une section ({hiddenCount})</span>
          </button>
        )}
      </nav>

      <div className="shrink-0 pt-2 border-t border-[var(--lkv-border-subtle)]">
        <div className="text-center">
          <span className="text-[8.5px] font-mono text-[var(--lkv-text-secondary)] tracking-wider uppercase">
            Le Kit du Voyageur &middot; Voyage Cockpit
          </span>
        </div>
      </div>
    </aside>
  );
}
