'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import s from '../../ui/crm.module.css';
import { cx } from '../../ui/cx';
import { Chip } from '../../ui/chip';
import { IconArrowRight, IconSearch } from '../../ui/icons';
import { Kbd } from '../../ui/kbd';
import { canRun } from '../../lib/rbac';
import type { InboxItem, StaffContext } from '../../lib/rpc';
import { loadCatalog, matches, normalize, POLE_LABELS, type CatalogCommand } from './catalog';
import { CommandDrawer } from './command-drawer';

type Row =
  | { kind: 'command'; key: string; command: CatalogCommand }
  | { kind: 'link'; key: string; href: string; title: string; subtitle: string; icon: string };

const RECENT_KEY = 'lkdv-crm-recents';

function readRecents(): { command: string; label: string }[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is { command: string; label: string } =>
      typeof item === 'object' && item !== null && typeof (item as { command?: unknown }).command === 'string'
    );
  } catch {
    return [];
  }
}

function pushRecent(command: CatalogCommand) {
  if (typeof window === 'undefined') return;
  try {
    const list = readRecents().filter((item) => item.command !== command.command);
    list.unshift({ command: command.command, label: command.label });
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
  } catch {
    /* stockage local indisponible : sans effet */
  }
}

/**
 * Barre de commande ⌘K (maquette `Commande.dc.html`).
 * Sections Actions / Membres / Commandes / Récents. Aucune action hors rôle.
 */
export function CommandBar({ ctx, items = [] }: { ctx: StaffContext | null; items?: InboxItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<CatalogCommand[]>([]);
  const [source, setSource] = useState<'base' | 'registre'>('registre');
  const [loaded, setLoaded] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [drawer, setDrawer] = useState<{ command: CatalogCommand; readOnly: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery('');
    setCursor(0);
  }, []);

  // ⌘K / Ctrl+K partout ; Échap ferme.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => {
          if (!value) {
            setQuery('');
            setCursor(0);
          }
          return !value;
        });
        return;
      }
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (loaded) return;
    let cancelled = false;
    void loadCatalog().then((result) => {
      if (cancelled) return;
      setCatalog(result.commands);
      setSource(result.source);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open, loaded]);

  const allowed = useMemo(() => {
    if (!ctx) return [];
    const actor = { role: ctx.role, poles: ctx.poles.map((p) => ({ code: p.code, role: p.role })) };
    return catalog.filter((command) => canRun(actor, command));
  }, [catalog, ctx]);

  const recents = useMemo(() => (open ? readRecents() : []), [open]);

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];
    const actions = allowed.filter((command) => matches(command, query)).slice(0, 40);
    for (const command of actions) {
      result.push({ kind: 'command', key: `cmd:${command.command}`, command });
    }

    const memberCommands = allowed.filter((command) => command.pole === 'MEMB' && matches(command, query)).slice(0, 6);
    for (const command of memberCommands) {
      result.push({ kind: 'command', key: `memb:${command.command}`, command });
    }

    const orderCommands = allowed.filter((command) => command.domain === 'D11' && matches(command, query)).slice(0, 6);
    for (const command of orderCommands) {
      result.push({ kind: 'command', key: `cmd-order:${command.command}`, command });
    }

    const inboxLinks = items
      .filter((item) => (query.trim() ? normalize(`${item.title} ${item.subtitle}`).includes(normalize(query)) : true))
      .slice(0, 6);
    for (const item of inboxLinks) {
      result.push({
        kind: 'link',
        key: `case:${item.key}`,
        href: `/cas/${item.source}/${item.id}`,
        title: item.title,
        subtitle: `${POLE_LABELS[item.pole] ?? item.pole} · ${item.subtitle}`,
        icon: '!'
      });
    }

    if (!query.trim()) {
      for (const recent of recents) {
        const command = allowed.find((candidate) => candidate.command === recent.command);
        if (command) result.push({ kind: 'command', key: `recent:${command.command}`, command });
      }
    }

    return result;
  }, [allowed, query, items, recents]);

  useEffect(() => {
    setCursor((value) => (value >= rows.length ? 0 : value));
  }, [rows.length]);

  const activate = (row: Row | undefined, readOnly = false) => {
    if (!row) return;
    if (row.kind === 'link') {
      setOpen(false);
      router.push(row.href);
      return;
    }
    setOpen(false);
    setDrawer({ command: row.command, readOnly });
  };

  const groups = useMemo(() => {
    const actions = rows.filter((row) => row.kind === 'command').slice(0, 40);
    const members = rows.filter((row) => row.kind === 'command' && row.command.pole === 'MEMB');
    const orders = rows.filter((row) => row.kind === 'command' && row.command.domain === 'D11');
    const links = rows.filter((row) => row.kind === 'link');
    return { actions, members, orders, links };
  }, [rows]);

  return (
    <>
      <button
        type="button"
        className={s.searchBtn}
        onClick={openPalette}
        aria-label="Chercher un membre, une commande… ou agir (Ctrl ou Commande + K)"
        aria-keyshortcuts="Meta+K Control+K"
      >
        <span className={s.rowFlex} style={{ minWidth: 0 }}>
          <IconSearch size={16} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Chercher un membre, une commande… ou agir
          </span>
        </span>
        <Kbd>⌘K</Kbd>
      </button>

      {open ? (
        <div className={s.overlay} role="presentation" onClick={() => setOpen(false)}>
          <div
            className={s.palette}
            role="dialog"
            aria-modal="true"
            aria-label="Barre de commande"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={s.paletteInput}>
              <IconSearch size={20} />
              <input
                ref={inputRef}
                className={s.paletteField}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCursor(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setCursor((value) => Math.min(value + 1, Math.max(rows.length - 1, 0)));
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setCursor((value) => Math.max(value - 1, 0));
                  } else if (event.key === 'Enter') {
                    event.preventDefault();
                    activate(rows[cursor], event.metaKey || event.ctrlKey);
                  }
                }}
                placeholder="Chercher un membre, une commande… ou agir"
                aria-label="Chercher ou agir"
                autoComplete="off"
                spellCheck={false}
              />
              <Kbd>Échap</Kbd>
            </div>

            <div className={s.paletteList} ref={listRef}>
              {!loaded ? (
                <span className={cx(s.muted, s.pad)}>Chargement du catalogue d’actions…</span>
              ) : rows.length === 0 ? (
                <span className={cx(s.muted, s.pad)}>
                  Aucune action autorisée pour votre rôle ne correspond à « {query} ».
                </span>
              ) : (
                <>
                  <Section title="Actions" rows={groups.actions} cursor={cursor} all={rows} onActivate={activate} />
                  <Section title="Membres" rows={groups.members} cursor={cursor} all={rows} onActivate={activate} />
                  <Section title="Commandes" rows={groups.orders} cursor={cursor} all={rows} onActivate={activate} />
                  <Section title="Récents" rows={groups.links} cursor={cursor} all={rows} onActivate={activate} />
                </>
              )}
            </div>

            <div className={s.paletteFoot}>
              <span>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> choisir
              </span>
              <span>
                <Kbd>↵</Kbd> lancer
              </span>
              <span>
                <Kbd>⌘↵</Kbd> ouvrir sans agir
              </span>
              <span style={{ marginLeft: 'auto' }}>
                {source === 'base' ? 'Seules les actions autorisées pour votre rôle apparaissent' : 'Catalogue du registre généré (base non joignable)'}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <CommandDrawer
        open={drawer !== null}
        command={drawer?.command ?? null}
        readOnly={drawer?.readOnly ?? false}
        ctx={ctx}
        onClose={() => setDrawer(null)}
        onDone={(command) => {
          pushRecent(command);
          router.refresh();
        }}
      />
    </>
  );
}

function Section({
  title,
  rows,
  all,
  cursor,
  onActivate
}: {
  title: string;
  rows: Row[];
  all: Row[];
  cursor: number;
  onActivate: (row: Row | undefined, readOnly?: boolean) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <span className={cx(s.label, s.pad)} style={{ paddingBottom: 4 }}>{title}</span>
      {rows.map((row) => {
        const index = all.indexOf(row);
        const selected = index === cursor;
        return (
          <button
            key={row.key}
            type="button"
            className={cx(s.result, selected && s.resultSel)}
            onClick={() => onActivate(row)}
            aria-current={selected ? 'true' : undefined}
          >
            <span className={s.resultIcon} aria-hidden="true">
              {row.kind === 'link' ? row.icon : row.command.pole.slice(0, 2)}
            </span>
            <span className={cx(s.col, s.grow)}>
              <strong style={{ fontSize: 14 }}>{row.kind === 'link' ? row.title : row.command.label}</strong>
              <span className={s.muted} style={{ fontSize: 12.5 }}>
                {row.kind === 'link' ? row.subtitle : `${POLE_LABELS[row.command.pole] ?? row.command.pole} · ${row.command.id}`}
              </span>
            </span>
            {row.kind === 'command' ? (
              row.command.needsValidation ? <Chip tone="info">2 personnes</Chip> : null
            ) : (
              <IconArrowRight size={16} />
            )}
            <Kbd>↵</Kbd>
          </button>
        );
      })}
    </>
  );
}
