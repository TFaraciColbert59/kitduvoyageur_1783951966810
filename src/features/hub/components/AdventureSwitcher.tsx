'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Cmd from 'cmdk';
import { ChevronsUpDown, Compass, Package, Users, Search, Check, RefreshCw, Sparkles } from 'lucide-react';
import { GlassSheet } from '@/components/ui/GlassSheet';
import { useActiveAdventure } from '../context/ActiveAdventureContext';
import {
  adventureKey,
  filterAdventures,
  resolveAdventureHref,
  shouldToggleSwitcher,
  type AdventureEntry,
} from '../context/adventureLists';

/**
 * H2.3 — Sélecteur d'aventure du hub (généralisation d'ActiveTripSwitcher).
 *
 * Desktop : palette `cmdk` (Ctrl/Cmd+K ou J, Escape ferme) ; mobile :
 * `GlassSheet` plein écran. Liste groupée par nature (Mon matériel /
 * Mes voyages / Mes groupes) avec compteurs et sous-titres de contexte,
 * recherche, restauration de la dernière section, rechargement.
 * La liste affiche toujours les 3 groupes — jamais de restriction.
 */
export function AdventureSwitcher({ forceOpenSignal = 0 }: { forceOpenSignal?: number }) {
  const {
    activeAdventure,
    setActiveAdventure,
    setActiveAdventureByKey,
    clearActiveAdventure,
    isCurrentAdventure,
    groups,
    reloadAdventures,
    suggestion,
    getLastSection,
    isPending,
  } = useActiveAdventure();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState('');

  // H6.1 — Pilotage externe (retour Android) : signal croissant → ouvre.
  const firstSignal = React.useRef(true);
  useEffect(() => {
    if (firstSignal.current) {
      firstSignal.current = false;
      return;
    }
    setOpen(true);
    setSheetOpen(window.innerWidth < 768);
  }, [forceOpenSignal]);

  // H6.1 — Dialogue d'état (retour Android) : publie ouvert/fermé, écoute la fermeture.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('hub:switcher-state', { detail: { open: open || sheetOpen } }));
  }, [open, sheetOpen]);
  useEffect(() => {
    const close = () => {
      setOpen(false);
      setSheetOpen(false);
    };
    window.addEventListener('hub:close-switcher', close);
    return () => window.removeEventListener('hub:close-switcher', close);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (shouldToggleSwitcher(e)) {
        e.preventDefault();
        setOpen((v) => !v);
        setSheetOpen((v) => (window.innerWidth < 768 ? !v : v));
      }
      if (e.key === 'Escape') {
        setOpen(false);
        setSheetOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filtered = useMemo(() => filterAdventures(groups, query), [groups, query]);

  // Suggestion IA déterministe (non restrictive : la liste complète reste affichée).
  const suggestedEntry: AdventureEntry | null = useMemo(() => {
    if (!suggestion || query.trim()) return null;
    const all: AdventureEntry[] = [...groups.possession, ...groups.sorties, ...groups.collectifs];
    return all.find((e) => adventureKey(e) === suggestion.key) ?? null;
  }, [suggestion, groups, query]);

  const activateByKey = async (key: string) => {
    const all: AdventureEntry[] = [...groups.possession, ...groups.sorties, ...groups.collectifs];
    const entry = all.find((e) => adventureKey(e) === key);
    if (!entry) return;
    await setActiveAdventureByKey(key);
    goToAdventure(entry);
  };

  const goToAdventure = (entry: AdventureEntry) => {
    const href = resolveAdventureHref(entry, getLastSection);
    setOpen(false);
    setSheetOpen(false);
    setQuery('');
    router.push(href);
  };

  const activate = async (entry: AdventureEntry) => {
    if (entry.nature === 'possession') {
      await setActiveAdventure({ nature: 'possession' });
    } else if (entry.nature === 'sortie') {
      await setActiveAdventure({ nature: 'sortie', id: entry.id, slug: entry.slug, title: entry.title });
    } else {
      await setActiveAdventure({ nature: 'collectif', kind: entry.kind, id: entry.id, title: entry.title });
    }
    goToAdventure(entry);
  };

  const entrySubtitle = (entry: AdventureEntry): string => {
    if (entry.nature === 'possession') {
      return `${entry.itemsCount} objet(s) · ${entry.alertsCount} alerte(s)`;
    }
    if (entry.nature === 'sortie') {
      const bits = [entry.status, entry.primary_activity].filter(Boolean);
      return bits.join(' · ') || 'Voyage';
    }
    return entry.subtitle;
  };

  const renderEntry = (entry: AdventureEntry) => {
    const key = adventureKey(entry);
    const isCurrent =
      isCurrentAdventure(key) ||
      (activeAdventure?.nature === 'possession' && entry.nature === 'possession');
    const Icon = entry.nature === 'possession' ? Package : entry.nature === 'sortie' ? Compass : Users;
    const value =
      entry.nature === 'possession'
        ? 'mon materiel possession inventaire'
        : entry.nature === 'sortie'
          ? `${entry.title} ${entry.status ?? ''} ${entry.primary_activity ?? ''}`
          : `${entry.title} ${entry.subtitle}`;
    return (
      <Cmd.CommandItem
        key={key}
        value={value}
        onSelect={() => activate(entry)}
        className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--lkv-radius-md)] text-left cursor-pointer aria-selected:bg-white/40 aria-selected:text-[var(--lkv-text-primary)]"
      >
        <Icon size={14} className="shrink-0 text-[var(--lkv-text-secondary)]" aria-hidden="true" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-[var(--lkv-text-primary)] truncate">
            {entry.nature === 'possession' ? 'Mon matériel' : entry.title}
          </span>
          <span className="block text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-secondary)] truncate">
            {entrySubtitle(entry)}
          </span>
        </span>
        {isCurrent && <Check size={14} className="shrink-0 text-[var(--lkv-secondary)]" aria-hidden="true" />}
      </Cmd.CommandItem>
    );
  };

  const renderGroup = (title: string, entries: AdventureEntry[], emptyLabel: string) => (
    <div>
      <p className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">
        {title} · {entries.length}
      </p>
      {entries.length === 0 ? (
        <p className="px-3 py-2 text-xs text-[var(--lkv-text-muted)]">{emptyLabel}</p>
      ) : (
        entries.map(renderEntry)
      )}
    </div>
  );

  const listContent = (
    <Cmd.CommandRoot loop onValueChange={() => {}}>
      <Cmd.CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Rechercher (matériel, voyage, groupe)…"
        autoFocus
        className="w-full bg-transparent outline-none font-body text-[15px] text-[color:var(--label)] placeholder:text-[color:var(--label-tertiary)]"
        aria-label="Rechercher une aventure"
      />
      <Cmd.CommandEmpty className="px-3 py-4 text-xs text-[color:var(--label-tertiary)]">
        Aucune aventure ne correspond à « {query} ».
      </Cmd.CommandEmpty>
      <Cmd.CommandList className="mt-1 flex flex-col gap-1 max-h-[340px] overflow-y-auto no-scrollbar">
        {suggestedEntry && suggestion && (
          <div>
            <p className="px-3 pt-2 pb-1 text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-muted)]">
              Suggestion
            </p>
            <Cmd.CommandItem
              key={`suggest-${adventureKey(suggestedEntry)}`}
              value={`suggestion ${suggestion.reason}`}
              onSelect={() => activateByKey(suggestion.key)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--lkv-radius-md)] text-left cursor-pointer aria-selected:bg-white/40 aria-selected:text-[var(--lkv-text-primary)]"
            >
              <Sparkles size={14} className="shrink-0 text-[var(--lkv-text-secondary)]" aria-hidden="true" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-[var(--lkv-text-primary)] truncate">
                  {suggestedEntry.nature === 'possession' ? 'Mon matériel' : suggestedEntry.title}
                </span>
                <span className="block text-[10px] font-mono uppercase tracking-widest text-[var(--lkv-text-secondary)] truncate">
                  {suggestion.reason}
                </span>
              </span>
            </Cmd.CommandItem>
          </div>
        )}
        {renderGroup('Mon matériel', filtered.possession, 'Aucun matériel.')}
        {renderGroup('Mes voyages', filtered.sorties, 'Aucun voyage pour cette recherche.')}
        {renderGroup('Mes groupes', filtered.collectifs, 'Aucun groupe pour cette recherche.')}
      </Cmd.CommandList>

      <Cmd.CommandSeparator className="my-2 border-t border-[var(--lkv-border-subtle)]" />
      <div className="flex items-center justify-between px-2 pb-1">
        {activeAdventure ? (
          <button
            type="button"
            onClick={() => { clearActiveAdventure(); setOpen(false); setSheetOpen(false); }}
            disabled={isPending}
            className="text-[10.5px] font-semibold text-[var(--lkv-danger)] hover:underline cursor-pointer"
          >
            Détacher l&apos;aventure active
          </button>
        ) : (
          <span className="text-[10.5px] text-[var(--lkv-text-muted)]">Aucune aventure active</span>
        )}
        <button
          type="button"
          onClick={() => reloadAdventures()}
          className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[var(--lkv-text-secondary)] hover:text-[var(--lkv-text-primary)] cursor-pointer"
          aria-label="Recharger la liste des aventures"
        >
          <RefreshCw size={11} />
          Recharger
        </button>
      </div>
    </Cmd.CommandRoot>
  );

  const triggerLabel =
    !activeAdventure || activeAdventure.nature === 'possession'
      ? 'Mon matériel'
      : activeAdventure.title;

  return (
    <>
      {/* Desktop : bouton déclencheur + palette cmdk.
          Le wrapper porte le responsive (H-AUTO-19) : .glass-capsule-btn
          (non layeré) bat md:hidden (layer utilities) — jamais de classe
          responsive display sur le bouton lui-même. */}
      <div className="hidden md:block">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-capsule-btn text-xs font-semibold text-[var(--lkv-text-primary)] min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
          aria-haspopup="dialog"
          aria-expanded={open}
          title="Changer d'aventure (Ctrl/Cmd+K ou J)"
        >
          <Compass size={14} className="text-[var(--lkv-secondary)]" aria-hidden="true" />
          <span className="max-w-[160px] truncate hidden sm:inline">{triggerLabel}</span>
          <ChevronsUpDown size={12} className="text-[var(--lkv-text-muted)]" aria-hidden="true" />
        </button>
      </div>

      {/* Palette desktop (cmdk via dialog) */}
      {open && (
        <div
          role="dialog"
          aria-label="Changer d'aventure"
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

      {/* Mobile : déclencheur -> GlassSheet (wrapper responsive, cf. H-AUTO-19) */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full glass-capsule-btn text-xs font-semibold text-[var(--lkv-text-primary)] min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)]"
          aria-haspopup="dialog"
        >
          <Compass size={14} className="text-[var(--lkv-secondary)]" aria-hidden="true" />
          <span className="max-w-[140px] truncate">{triggerLabel}</span>
        </button>
      </div>

      <GlassSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Changer d'aventure">
        <div className="glass p-2 rounded-[var(--lkv-radius-card)]">{listContent}</div>
      </GlassSheet>
    </>
  );
}

export default AdventureSwitcher;
