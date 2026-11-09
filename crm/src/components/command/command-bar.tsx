'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import s from '../../ui/crm.module.css';
import { cx } from '../../ui/cx';
import { Chip } from '../../ui/chip';
import { IconAlert, IconSearch } from '../../ui/icons';
import { Kbd } from '../../ui/kbd';
import { canRun } from '../../lib/rbac';
import type { InboxItem, StaffContext } from '../../lib/rpc';
import {
  commandVisual,
  displayLabel,
  loadCatalog,
  matches,
  POLE_LABELS,
  type CatalogCommand
} from './catalog';
import { CommandDrawer } from './command-drawer';

type Row =
  | { kind: 'command'; key: string; command: CatalogCommand }
  | { kind: 'link'; key: string; href: string; title: string; subtitle: string };

type Section = { title: string; rows: Row[] };

const RECENT_KEY = 'lkdv-crm-recents';

/** Exemples du pied de la maquette : ils remplissent la requête, ils n'exécutent rien. */
const EXAMPLES = ['suspendre @…', 'masquer', 'SOS en cours', "erreurs aujourd'hui", "arrêter l'agent Trieur"];

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
 * Sections Actions / Membres / Commandes / Récents, aucune action hors rôle.
 * Rendue dans un portail : le `backdrop-filter` de la coque piégerait un `fixed`.
 */
export function CommandBar({ ctx, items = [] }: { ctx: StaffContext | null; items?: InboxItem[] }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<CatalogCommand[]>([]);
  const [source, setSource] = useState<'base' | 'registre'>('registre');
  const [loaded, setLoaded] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [focused, setFocused] = useState(false);
  const [drawer, setDrawer] = useState<{ command: CatalogCommand; readOnly: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => setMounted(true), []);

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery('');
    setCursor(0);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  }, []);

  // ⌘K / Ctrl+K partout ; Échap ferme.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        // Un tiroir ouvert occupe l'écran : ne pas empiler une palette invisible dessous.
        if (drawer) return;
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
        setQuery('');
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, drawer]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open || loaded) return;
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

  const sections = useMemo<Section[]>(() => {
    const filtered = allowed.filter((command) => matches(command, query));
    const toRow = (command: CatalogCommand, prefix: string): Row => ({
      kind: 'command',
      key: `${prefix}:${command.id}`,
      command
    });

    const actions = filtered
      .filter((command) => command.pole !== 'MEMB' && command.domain !== 'D11')
      .slice(0, 6)
      .map((command) => toRow(command, 'act'));
    const members = filtered
      .filter((command) => command.pole === 'MEMB')
      .slice(0, 3)
      .map((command) => toRow(command, 'memb'));
    const orders = filtered
      .filter((command) => command.domain === 'D11' && command.pole !== 'MEMB')
      .slice(0, 3)
      .map((command) => toRow(command, 'cmd'));

    const shown = new Set(
      [...actions, ...members, ...orders].map((row) => (row.kind === 'command' ? row.command.id : row.key))
    );
    const recentsRows: Row[] = [];
    for (const recent of recents) {
      const command = allowed.find((candidate) => candidate.command === recent.command);
      if (command && !shown.has(command.id)) {
        shown.add(command.id);
        recentsRows.push(toRow(command, 'recent'));
      }
    }
    for (const item of items.slice(0, 3)) {
      recentsRows.push({
        kind: 'link',
        key: `case:${item.key}`,
        href: `/cas/${item.source}/${item.id}`,
        title: item.title,
        subtitle: `${POLE_LABELS[item.pole] ?? item.pole} · ${item.subtitle}`
      });
    }

    return [
      { title: 'Actions', rows: actions },
      { title: 'Membres', rows: members },
      { title: 'Commandes', rows: orders },
      { title: 'Récents', rows: recentsRows }
    ].filter((section) => section.rows.length > 0);
  }, [allowed, query, recents, items]);

  const rows = useMemo(() => sections.flatMap((section) => section.rows), [sections]);
  const total = rows.length;

  useEffect(() => {
    setCursor((value) => (value >= rows.length ? 0 : value));
  }, [rows.length]);

  useEffect(() => {
    if (!open) return;
    rowRefs.current[cursor]?.scrollIntoView({ block: 'nearest' });
  }, [cursor, open]);

  const activate = useCallback(
    (row: Row | undefined, readOnly = false) => {
      if (!row) return;
      if (row.kind === 'link') {
        setOpen(false);
        setQuery('');
        router.push(row.href);
        return;
      }
      setOpen(false);
      setQuery('');
      setDrawer({ command: row.command, readOnly });
    },
    [router]
  );

  // Le focus ne sort pas de la palette (Tab circule entre requête et exemples).
  const trapTab = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const nodes = overlayRef.current?.querySelectorAll<HTMLElement>('input, button:not([disabled])');
    if (!nodes || nodes.length === 0) return;
    const list = Array.from(nodes);
    const index = list.indexOf(document.activeElement as HTMLElement);
    event.preventDefault();
    const next = event.shiftKey ? (index <= 0 ? list.length - 1 : index - 1) : index === -1 || index === list.length - 1 ? 0 : index + 1;
    list[next]?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={s.searchBtn}
        onClick={openPalette}
        aria-label="Chercher un membre, une commande… ou agir (Ctrl ou Commande + K)"
        aria-keyshortcuts="Meta+K Control+K"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={s.rowFlex} style={{ minWidth: 0 }}>
          <IconSearch size={16} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Chercher un membre, une commande… ou agir
          </span>
        </span>
        <Kbd>⌘K</Kbd>
      </button>

      {mounted && open
        ? createPortal(
            <div
              ref={overlayRef}
              className={s.overlay}
              role="presentation"
              style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}
              onClick={closePalette}
              onKeyDown={trapTab}
            >
              <div
                className={s.palette}
                role="dialog"
                aria-modal="true"
                aria-label="Barre de commande"
                style={{ borderRadius: 22, maxHeight: 'min(566px, calc(100vh - 176px))' }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className={s.paletteInput} style={{ padding: '15px 24px' }}>
                  <IconSearch size={20} style={{ color: 'var(--lkv-action)', flex: 'none' }} />
                  <input
                    ref={inputRef}
                    className={s.paletteField}
                    value={query}
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="lkdv-command-list"
                    aria-autocomplete="list"
                    aria-activedescendant={rows[cursor] ? `lkdv-command-option-${cursor}` : undefined}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
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
                      } else if (event.key === 'Home') {
                        event.preventDefault();
                        setCursor(0);
                      } else if (event.key === 'End') {
                        event.preventDefault();
                        setCursor(Math.max(rows.length - 1, 0));
                      } else if (event.key === 'Enter') {
                        event.preventDefault();
                        activate(rows[cursor], event.metaKey || event.ctrlKey);
                      }
                    }}
                    placeholder="Chercher un membre, une commande… ou agir"
                    aria-label="Chercher ou agir"
                    style={{
                      outline: focused ? '2px solid var(--lkv-action)' : 'none',
                      outlineOffset: 2,
                      borderRadius: 4
                    }}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Kbd>Échap</Kbd>
                </div>

                {loaded && source === 'registre' ? (
                  <div
                    role="status"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 20px',
                      borderBottom: '1px solid var(--lkv-border-subtle)',
                      background: 'var(--lkv-surface-muted)',
                      color: 'var(--lkv-text-secondary)',
                      fontSize: 11.5
                    }}
                  >
                    <IconAlert size={13} style={{ color: 'var(--lkv-warning-dark)', flex: 'none' }} />
                    Base non joignable : catalogue du registre généré ({catalog.length} actions).
                  </div>
                ) : null}

                <div
                  className={s.paletteList}
                  id="lkdv-command-list"
                  role="listbox"
                  ref={listRef}
                  style={{ gap: 0 }}
                >
                  {!loaded ? (
                    <span className={cx(s.muted, s.pad)}>Chargement du catalogue d’actions…</span>
                  ) : total === 0 ? (
                    <span className={cx(s.muted, s.pad)}>
                      {query.trim()
                        ? `Aucune action autorisée pour votre rôle ne correspond à « ${query} ».`
                        : 'Aucune action autorisée pour votre rôle.'}
                    </span>
                  ) : (
                    sections.map((section, sectionIndex) => (
                      <Fragment key={section.title}>
                        <span
                          className={s.label}
                          role="presentation"
                          style={{ padding: sectionIndex === 0 ? '8px 14px 4px' : '12px 14px 4px' }}
                        >
                          {section.title}
                        </span>
                        {section.rows.map((row) => {
                          const index = rows.indexOf(row);
                          const selected = index === cursor;
                          const visual =
                            row.kind === 'command'
                              ? commandVisual(row.command)
                              : { glyph: '!', bg: 'var(--lkv-warning-bg)', fg: 'var(--lkv-warning-dark)' };
                          return (
                            <div
                              key={row.key}
                              id={`lkdv-command-option-${index}`}
                              role="option"
                              aria-selected={selected}
                              ref={(element) => {
                                rowRefs.current[index] = element;
                              }}
                              className={cx(s.result, selected && s.resultSel)}
                              style={{
                                borderRadius: 12,
                                cursor: 'pointer',
                                margin: '0 8px',
                                paddingLeft: 10,
                                gap: 10,
                                minHeight: 56,
                                width: 'auto'
                              }}
                              onMouseEnter={() => {
                                if (!selected) setCursor(index);
                              }}
                              onClick={() => activate(row)}
                            >
                              <span
                                className={s.resultIcon}
                                aria-hidden="true"
                                style={{ background: visual.bg, color: visual.fg }}
                              >
                                {visual.glyph}
                              </span>
                              <span className={cx(s.col, s.grow)}>
                                <strong
                                  style={{
                                    fontSize: 14,
                                    lineHeight: 1.35,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {row.kind === 'command' ? displayLabel(row.command.label) : row.title}
                                </strong>
                                <span
                                  className={s.muted}
                                  style={{
                                    fontSize: 12.5,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {row.kind === 'command'
                                    ? `${POLE_LABELS[row.command.pole] ?? row.command.pole} · ${row.command.id}`
                                    : row.subtitle}
                                </span>
                              </span>
                              {row.kind === 'command' ? (
                                <Kbd>{row.command.agent === 'read' ? '⌘↵' : '↵'}</Kbd>
                              ) : null}
                            </div>
                          );
                        })}
                      </Fragment>
                    ))
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
                  <span style={{ marginLeft: 'auto' }} aria-live="polite">
                    {loaded ? `${total} résultat${total > 1 ? 's' : ''}` : '—'}
                  </span>
                  <span style={{ flexBasis: '100%', textAlign: 'right' }}>
                    Seules les actions autorisées pour votre rôle apparaissent
                  </span>
                </div>
              </div>

              <div
                style={{
                  width: 'min(720px, 100%)',
                  marginTop: 12,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 10,
                  justifyContent: 'center'
                }}
              >
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setQuery(example);
                      setCursor(0);
                      inputRef.current?.focus();
                    }}
                    style={{
                      minHeight: 44,
                      padding: 0,
                      border: 0,
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center'
                    }}
                  >
                    <Chip tone="stone">« {example} »</Chip>
                  </button>
                ))}
              </div>
            </div>,
            document.body
          )
        : null}

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
