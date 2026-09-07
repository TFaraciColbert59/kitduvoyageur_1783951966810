'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import * as Cmd from 'cmdk';
import { ChevronsUpDown, Compass, Search, Check, RefreshCw } from 'lucide-react';
import { GlassSheet } from '@/components/ui/GlassSheet';
import { useActiveTrip } from '../context/ActiveTripContext';
import { sectionIdFromPathname, tripSectionHref, TRIP_SECTION_ORDER } from '../registry/tripSectionRegistry';
import type { TripSectionId } from '../engine/tripProfileEngine';

/**
 * Y3.3 — Sélecteur persistant de voyage actif (ex-`ActiveTripBanner`).
 *
 * Remplace la bande pleine largeur : même information, zéro décalage de mise en
 * page, et devenue actionnable. Desktop : palette `cmdk` (⌘/Ctrl+K ou clic) ;
 * mobile : `GlassSheet` plein écran. Alimenté par `ActiveTripContext.userTrips`
 * (cache §2.4, sans nouvelle requête à chaque ouverture), restaure la dernière
 * section visitée (mémoire §5.2) et navigue vers le voyage/section.
 */
export function ActiveTripSwitcher() {
  const { activeTrip, setActiveTripBySlug, clearActiveTrip, userTrips, reloadUserTrips, getLastSection, isPending } =
    useActiveTrip();
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Raccourci clavier : ⌘/Ctrl + K (n'a de sens que hors du champ de recherche)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const key = e.key.toLowerCase();
        if (key === 'j') {
          e.preventDefault();
          setOpen((v) => !v);
          setSheetOpen((v) => (window.innerWidth < 768 ? !v : v));
        }
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setSheetOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? userTrips.filter((t) => t.title.toLowerCase().includes(q)) : userTrips;
    return list.slice(0, 12);
  }, [userTrips, query]);

  const goToTrip = (slug: string) => {
    const lastSection = getLastSection(slug);
    // restore la section mémorisée, sinon overview — via le constructeur typé (règle 11)
    const section = (lastSection && isValidSection(lastSection) ? lastSection : 'overview') as TripSectionId;
    const href = tripSectionHref(slug, section);
    setOpen(false);
    setSheetOpen(false);
    setQuery('');
    router.push(href);
  };

  const activate = async (slug: string) => {
    await setActiveTripBySlug(slug);
    goToTrip(slug);
  };

  const activityLabel = (activity?: string) => (activity ? ` · ${activity}` : '');

  const listContent = (
    <Cmd.CommandRoot loop onValueChange={() => {}}>
      <Cmd.CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Rechercher un voyage… (statut, activité, titre)"
        autoFocus
        className="w-full bg-transparent outline-none font-body text-[15px] text-[color:var(--label)] placeholder:text-[color:var(--label-tertiary)]"
        aria-label="Rechercher un voyage"
      />
      <Cmd.CommandEmpty className="px-3 py-4 text-xs text-[color:var(--label-tertiary)]">
        Aucun voyage ne correspond à « {query} ».
      </Cmd.CommandEmpty>
      <Cmd.CommandList className="mt-1 flex flex-col gap-1 max-h-[340px] overflow-y-auto no-scrollbar">
        {filtered.map((t) => {
          const isCurrent = activeTrip?.slug === t.slug;
          return (
            <Cmd.CommandItem
              key={t.id}
              value={`${t.title} ${t.status ?? ''} ${t.primary_activity ?? ''}`}
              onSelect={() => activate(t.slug)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--lkv-radius-md)] text-left cursor-pointer aria-selected:bg-white/40 aria-selected:text-[var(--lkv-text-primary)]"
            >
              <Compass size={14} className="shrink-0 text-[var(--lkv-text-secondary)]" aria-hidden="true" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-[var(--lkv-text-primary)] truncate">{t.title}</span>
                <span className="block text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-secondary)] truncate">
                  {t.status}
                  {activityLabel(t.primary_activity)}
                </span>
              </span>
              {isCurrent && <Check size={14} className="shrink-0 text-[var(--lkv-secondary)]" aria-hidden="true" />}
            </Cmd.CommandItem>
          );
        })}
      </Cmd.CommandList>

      <Cmd.CommandSeparator className="my-2 border-t border-[var(--lkv-border-subtle)]" />
      <div className="flex items-center justify-between px-2 pb-1">
        {activeTrip ? (
          <button
            type="button"
            onClick={() => { clearActiveTrip(); setOpen(false); setSheetOpen(false); }}
            disabled={isPending}
            className="text-[10.5px] font-semibold text-[var(--lkv-danger)] hover:underline cursor-pointer"
          >
            Détacher le voyage actif
          </button>
        ) : (
          <span className="text-[10.5px] text-[var(--lkv-text-muted)]">Aucun voyage actif</span>
        )}
        <button
          type="button"
          onClick={() => reloadUserTrips()}
          className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] cursor-pointer"
          aria-label="Recharger la liste des voyages"
        >
          <RefreshCw size={11} />
          Recharger
        </button>
      </div>
    </Cmd.CommandRoot>
  );

  const triggerLabel = activeTrip ? activeTrip.title : 'Sélectionner un voyage';

  return (
    <>
      {/* Desktop : bouton déclencheur + palette cmdk */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-capsule-btn text-xs font-semibold text-[var(--lkv-text-primary)] min-h-[44px] cursor-pointer"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Changer de voyage (Ctrl/Cmd+J)"
      >
        <Compass size={14} className="text-[var(--lkv-secondary)]" aria-hidden="true" />
        <span className="max-w-[160px] truncate hidden sm:inline">{triggerLabel}</span>
        <ChevronsUpDown size={12} className="text-[var(--lkv-text-muted)]" aria-hidden="true" />
      </button>

      {/* Palette desktop (cmdk radix-like via dialog) */}
      {open && (
        <div
          role="dialog"
          aria-label="Changer de voyage"
          className="fixed z-[70] left-1/2 top-24 -translate-x-1/2 w-[min(520px,92vw)] glass p-2 rounded-[var(--lkv-radius-card)] shadow-lg border border-white/40 hidden md:block"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 px-3 h-11 rounded-[var(--lkv-radius-md)] bg-white/35">
            <Search size={18} className="text-[var(--lkv-text-secondary)]" aria-hidden="true" />
            {listContent}
          </div>
        </div>
      )}
      {open && (
        <button
          type="button"
          aria-label="Fermer"
          className="fixed inset-0 z-[60] hidden md:block cursor-default"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile : déclencheur dans l'en-tête -> GlassSheet */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-full glass-capsule-btn text-xs font-semibold text-[var(--lkv-text-primary)] min-h-[44px] cursor-pointer"
        aria-haspopup="dialog"
      >
        <Compass size={14} className="text-[var(--lkv-secondary)]" aria-hidden="true" />
        <span className="max-w-[140px] truncate">{triggerLabel}</span>
      </button>

      <GlassSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Changer de voyage">
        <div className="glass p-2 rounded-[var(--lkv-radius-card)]">{listContent}</div>
      </GlassSheet>
    </>
  );
}

/** Retourne la dernière section mémorisée (Y5.2) — exporté pour les tests. */
export { TRIP_SECTION_ORDER };

/** Vrai si la valeur est un identifiant de section connu du registre. */
function isValidSection(value: string): boolean {
  return TRIP_SECTION_ORDER.includes(value as TripSectionId);
}

export default ActiveTripSwitcher;
