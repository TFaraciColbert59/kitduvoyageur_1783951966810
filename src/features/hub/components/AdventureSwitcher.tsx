'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Cmd from 'cmdk';
import * as Dialog from '@radix-ui/react-dialog';
import { ChevronsUpDown, Compass, Package, Users, Search, Check, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
import { GlassSheet } from '@/components/ui/GlassSheet';
import { useActiveAdventure } from '../context/ActiveAdventureContext';
import {
  adventureKey,
  consumeSwitcherAutoOpen,
  filterAdventures,
  peekSwitcherAutoOpen,
  resolveAdventureHref,
  shouldToggleSwitcher,
  type AdventureEntry,
} from '../context/adventureLists';

/** Viewport mobile réactif (matchMedia — jamais window.innerWidth éphémère). */
function useIsMobileViewport(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isMobile;
}

/**
 * H2.3 — Sélecteur d'aventure du hub (généralisation d'ActiveTripSwitcher).
 *
 * Deux instances toujours montées (slot mobile + colonne desktop), chacune ne
 * pilote que le dialog de SA variante — mais les deux dialogs passent par un
 * PORTAL Radix : un élément `position: fixed` ne doit jamais être enfant d'un
 * panneau `.glass` (backdrop-filter = containing block + overflow hidden —
 * la palette desktop était clippée dans la sidebar). Échelle z-index :
 * overlays 10000 / contenu 10001, au-dessus de la tab bar (9999).
 *
 * Liste groupée par nature (Mon matériel / Mes voyages / Mes groupes) avec
 * recherche, suggestion IA, restauration de la dernière section, rechargement.
 */
export function AdventureSwitcher({
  forceOpenSignal = 0,
  variant = 'desktop',
}: {
  forceOpenSignal?: number;
  /** Quel dialog cette instance contrôle (un seul Root Radix ouvert à la fois). */
  variant?: 'mobile' | 'desktop';
}) {
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
  const isMobile = useIsMobileViewport();

  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [switchError, setSwitchError] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /**
   * H-AUTO-41 — Un SEUL dialog Radix ouvert à la fois : l'instance est
   * montée deux fois (slot mobile + colonne desktop) et Radix modal marque
   * `aria-hidden` le portal sœur — deux Roots ouverts s'excluaient mutuellement
   * de l'arbre d'accessibilité. Chaque instance ne contrôle que sa variante.
   */
  const controlsVariant = variant === 'mobile' ? isMobile : !isMobile;

  // H6.1 — Pilotage externe (retour Android) : signal croissant → ouvre.
  const firstSignal = React.useRef(true);
  useEffect(() => {
    if (firstSignal.current) {
      firstSignal.current = false;
      return;
    }
    if (!controlsVariant) return;
    if (variant === 'mobile') setSheetOpen(true);
    else setOpen(true);
  }, [forceOpenSignal, variant, controlsVariant]);

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

  // Appui long sur le tab Hub central hors surface hub : signal one-shot
  // consommé par L'INSTANCE du viewport courant (peek puis consume — sinon
  // l'instance mobile, montée en premier, avalait le signal sur desktop).
  const autoOpenDone = React.useRef(false);
  useEffect(() => {
    if (autoOpenDone.current || !controlsVariant) return;
    autoOpenDone.current = true;
    if (peekSwitcherAutoOpen() && consumeSwitcherAutoOpen()) {
      if (variant === 'mobile') setSheetOpen(true);
      else setOpen(true);
    }
  }, [controlsVariant, variant]);

  // Raccourci conservé (Ctrl/Cmd+K ou J). Escape : Radix ferme le dialog
  // ouvert via onOpenChange — aucun listener global dupliqué.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (shouldToggleSwitcher(e)) {
        e.preventDefault();
        if (!controlsVariant) return;
        if (variant === 'mobile') setSheetOpen((v) => !v);
        else setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [controlsVariant, variant]);

  const filtered = useMemo(() => filterAdventures(groups, query), [groups, query]);

  // Suggestion IA déterministe (non restrictive : la liste complète reste affichée).
  const suggestedEntry: AdventureEntry | null = useMemo(() => {
    if (!suggestion || query.trim()) return null;
    const all: AdventureEntry[] = [...groups.possession, ...groups.sorties, ...groups.collectifs];
    return all.find((e) => adventureKey(e) === suggestion.key) ?? null;
  }, [suggestion, groups, query]);

  const closeAll = useCallback(() => {
    setOpen(false);
    setSheetOpen(false);
    setQuery('');
    setSwitchError(false);
  }, []);

  /** Cookie posé → push + refresh (l'action revalide /hub côté serveur). */
  const goToAdventure = useCallback(
    (entry: AdventureEntry) => {
      const href = resolveAdventureHref(entry, getLastSection);
      closeAll();
      router.push(href);
      router.refresh();
    },
    [closeAll, getLastSection, router],
  );

  const activate = useCallback(
    async (entry: AdventureEntry): Promise<void> => {
      setSwitchError(false);
      let ok: boolean;
      if (entry.nature === 'possession') {
        ok = await setActiveAdventure({ nature: 'possession' });
      } else if (entry.nature === 'sortie') {
        ok = await setActiveAdventure({ nature: 'sortie', id: entry.id, slug: entry.slug, title: entry.title });
      } else {
        ok = await setActiveAdventure({ nature: 'collectif', kind: entry.kind, id: entry.id, title: entry.title });
      }
      if (!ok) {
        // Échec (offline / serveur) : le dialog reste ouvert, l'optimisme a été
        // annulé par le contexte — on l'affiche au lieu d'un "rien ne se passe".
        setSwitchError(true);
        return;
      }
      goToAdventure(entry);
    },
    [goToAdventure, setActiveAdventure],
  );

  const activateByKey = useCallback(
    async (key: string) => {
      setSwitchError(false);
      const ok = await setActiveAdventureByKey(key);
      if (!ok) {
        setSwitchError(true);
        return;
      }
      const all: AdventureEntry[] = [...groups.possession, ...groups.sorties, ...groups.collectifs];
      const entry = all.find((e) => adventureKey(e) === key);
      if (entry) goToAdventure(entry);
    },
    [goToAdventure, groups, setActiveAdventureByKey],
  );

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

  // H-AUTO-42 — Groupes cmdk natifs (jamais de wrapper <div> autour des
  // CommandItem dans CommandList) : cmdk 1.x + React 19 crashait au filtrage
  // (« appendChild … not of type Node ») quand la structure de la liste
  // changeait sous des divs non managés.
  const GROUP_HEADING_CLASS =
    '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-[var(--lkv-text-muted)]';

  const renderGroup = (title: string, entries: AdventureEntry[], emptyLabel: string) => (
    <Cmd.CommandGroup heading={`${title} · ${entries.length}`} className={GROUP_HEADING_CLASS}>
      {entries.length === 0 ? (
        <p className="px-3 py-2 text-xs text-[var(--lkv-text-muted)]">{emptyLabel}</p>
      ) : (
        entries.map(renderEntry)
      )}
    </Cmd.CommandGroup>
  );

  const footer = (
    <>
      <Cmd.CommandSeparator className="my-2 border-t border-[var(--lkv-border-subtle)]" />
      {switchError && (
        <p className="flex items-center gap-1.5 px-2 pb-1 text-[10.5px] font-semibold text-[var(--lkv-danger)]" role="alert">
          <AlertTriangle size={11} aria-hidden="true" />
          Impossible de changer d&apos;aventure — vérifiez la connexion puis réessayez.
        </p>
      )}
      <div className="flex items-center justify-between px-2 pb-1">
        {activeAdventure ? (
          <button
            type="button"
            onClick={() => { clearActiveAdventure(); closeAll(); }}
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
    </>
  );

  /** Contenu cmdk complet : input en entête + liste + pied (structure miroir desktop/sheet). */
  const listContent = (withSearchIcon: boolean) => (
    <Cmd.CommandRoot loop onValueChange={() => {}}>
      <div className="flex items-center gap-2 px-3 h-11 rounded-[var(--lkv-radius-md)] bg-white/35">
        {withSearchIcon && <Search size={16} className="shrink-0 text-[var(--lkv-text-secondary)]" aria-hidden="true" />}
        <Cmd.CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Rechercher (matériel, voyage, groupe)…"
          autoFocus
          className="w-full bg-transparent outline-none font-body text-[15px] text-[color:var(--label)] placeholder:text-[color:var(--label-tertiary)]"
          aria-label="Rechercher une aventure"
        />
      </div>
      <Cmd.CommandEmpty className="px-3 py-4 text-xs text-[color:var(--label-tertiary)]">
        Aucune aventure ne correspond à « {query} ».
      </Cmd.CommandEmpty>
      <Cmd.CommandList className="mt-1 flex flex-col gap-1 max-h-[340px] overflow-y-auto no-scrollbar">
        {suggestedEntry && suggestion && (
          <Cmd.CommandGroup heading="Suggestion" className={GROUP_HEADING_CLASS}>
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
          </Cmd.CommandGroup>
        )}
        {renderGroup('Mon matériel', filtered.possession, 'Aucun matériel.')}
        {renderGroup('Mes voyages', filtered.sorties, 'Aucun voyage pour cette recherche.')}
        {renderGroup('Mes groupes', filtered.collectifs, 'Aucun groupe pour cette recherche.')}
      </Cmd.CommandList>
      {footer}
    </Cmd.CommandRoot>
  );

  const triggerLabel =
    !activeAdventure || activeAdventure.nature === 'possession'
      ? 'Mon matériel'
      : activeAdventure.title;

  return (
    <>
      {/* Desktop : bouton déclencheur + palette cmdk (PORTAL — la palette ne
          doit jamais être enfant du panneau .glass : backdrop-filter = block
          contenant pour position:fixed, overflow:hidden la clippait). */}
      <div className="hidden md:block">
        <button
          type="button"
          onClick={() => {
            if (!isMobile) setOpen((v) => !v);
          }}
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

      {/* Palette desktop — Dialog Radix portal (focus trap + Escape gérés). */}
      {mounted && (
        <Dialog.Root
          open={open && !isMobile}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setSwitchError(false);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-[10000] bg-ink-900/30" />
            <Dialog.Content
              aria-label="Changer d'aventure"
              onClick={(e) => e.stopPropagation()}
              className="fixed left-1/2 top-20 -translate-x-1/2 w-[min(520px,92vw)] z-[10001] rounded-[var(--lkv-radius-card)] shadow-lg border border-white/40 overflow-hidden"
            >
              {/* .glass sur un enfant : la classe impose position:relative et
                  écraserait .fixed sur le Content lui-même. */}
              <div className="glass p-2">{listContent(true)}</div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Mobile : déclencheur -> GlassSheet (wrapper responsive, cf. H-AUTO-19) */}
      <div className="md:hidden min-w-0">
        <button
          type="button"
          onClick={() => {
            if (variant === 'mobile' && isMobile) setSheetOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full glass-capsule-btn text-xs font-semibold text-[var(--lkv-text-primary)] min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lkv-primary)] max-w-full"
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
        >
          <Compass size={14} className="shrink-0 text-[var(--lkv-secondary)]" aria-hidden="true" />
          <span className="max-w-[110px] truncate">{triggerLabel}</span>
        </button>
      </div>

      <GlassSheet open={variant === 'mobile' && isMobile && sheetOpen} onOpenChange={(v) => { setSheetOpen(v); if (!v) setSwitchError(false); }} title="Changer d'aventure">
        <div className="glass p-2 rounded-[var(--lkv-radius-card)]">{listContent(false)}</div>
      </GlassSheet>
    </>
  );
}

export default AdventureSwitcher;
