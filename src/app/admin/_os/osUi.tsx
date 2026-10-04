'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { NAV, type InspectorContent } from './routeConfig';
import { NoteComposer } from '../_components/NoteComposer';
import { Symbol, type IconName } from './Symbol';

interface OsUi {
  inspectorOpen: boolean;
  setInspectorOpen: (v: boolean) => void;
  outdoor: boolean;
  setOutdoor: (v: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

const OsUiContext = createContext<OsUi | null>(null);

export function useOsUi(): OsUi {
  const ctx = useContext(OsUiContext);
  if (!ctx) throw new Error('useOsUi hors AdminShell');
  return ctx;
}

export interface BadgeCounts {
  community: number;
  support: number;
  system: number;
}

export interface AccountInfo {
  initials: string;
  name: string;
  roleLine: string;
}

export interface PaletteAction {
  label: string;
  detail: string;
  href: string;
  icon: IconName;
}

function badgeFor(id: string, badges: BadgeCounts): number {
  if (id === 'community') return badges.community;
  if (id === 'support') return badges.support;
  if (id === 'system') return badges.system;
  return 0;
}

/** Coquille Admin OS : fond, sidebar, topbar, îlot, palette. */
export function AdminShell({
  eyebrow,
  badges,
  account,
  island,
  actions,
  children,
}: {
  eyebrow: string;
  badges: BadgeCounts;
  account: AccountInfo;
  island: { count: string; label: string; href: string };
  actions: PaletteAction[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [outdoor, setOutdoor] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(
    () => ({
      inspectorOpen,
      setInspectorOpen,
      outdoor,
      setOutdoor,
      paletteOpen,
      setPaletteOpen,
      sidebarOpen,
      setSidebarOpen,
    }),
    [inspectorOpen, outdoor, paletteOpen, sidebarOpen]
  );

  return (
    <OsUiContext.Provider value={value}>
      <div className={`admin-os${outdoor ? ' outdoor' : ''}`}>
        <div className="admin-os-bg" aria-hidden="true" />
        <div className="admin-os-scrim" aria-hidden="true" />
        <div className="admin-os-shell">
          <aside className={`os-sidebar os-regular${sidebarOpen ? ' open' : ''}`} aria-label="Navigation administration">
            <div className="os-brand-row">
              <span className="os-brand-mark" aria-hidden="true">L</span>
              <span className="os-brand-copy">
                <strong>Le Kit du Voyageur</strong>
                <span>Admin OS</span>
              </span>
            </div>
            <button type="button" className="os-env os-interactive" onClick={() => setPaletteOpen(true)}>
              <span className="os-env-dot" aria-hidden="true" />
              <span>Production</span>
              <kbd>⌘K</kbd>
            </button>
            <nav className="os-nav">
              {NAV.map((item) => {
                const active = pathname === item.href;
                const badge = item.badgeKey ? badgeFor(item.id, badges) : 0;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`os-nav-item${active ? ' active' : ''}`}
                  >
                    <span className="active-lens" aria-hidden="true" />
                    <Symbol name={item.icon} />
                    <span className="os-nav-label">{item.label}</span>
                    {badge > 0 ? <span className="os-nav-badge">{badge}</span> : null}
                  </Link>
                );
              })}
            </nav>
            <div className="os-account">
              <span className="os-avatar" aria-hidden="true">{account.initials}</span>
              <span className="os-account-copy">
                <strong>{account.name}</strong>
                <span>{account.roleLine}</span>
              </span>
            </div>
          </aside>
          {sidebarOpen ? (
            <div className="os-scrim" aria-hidden="true" onClick={() => setSidebarOpen(false)} />
          ) : null}
          <div className="os-main">
            <Topbar eyebrow={eyebrow} alert={badges.support + badges.community > 0} />
            {children}
          </div>
        </div>
        <div className="os-island">
          <span className="os-island-dot" aria-hidden="true" />
          <strong>{island.count}</strong>
          <span>{island.label}</span>
          <Link href={island.href}>Voir</Link>
        </div>
        {paletteOpen ? <CommandPalette actions={actions} /> : null}
      </div>
    </OsUiContext.Provider>
  );
}

function Topbar({ eyebrow, alert }: { eyebrow: string; alert: boolean }) {
  const { setPaletteOpen, outdoor, setOutdoor, setInspectorOpen, setSidebarOpen } = useOsUi();
  return (
    <header className="os-topbar os-regular">
      <button
        type="button"
        className="os-circle-btn os-interactive os-burger"
        aria-label="Ouvrir la navigation"
        onClick={() => setSidebarOpen(true)}
      >
        <Symbol name="sidebar" size={16} />
      </button>
      <div className="os-breadcrumb" aria-label="Fil d'Ariane">
        <span>LKDV</span>
        <span aria-hidden="true">›</span>
        <strong>{eyebrow}</strong>
      </div>
      <button type="button" className="os-search os-interactive" onClick={() => setPaletteOpen(true)}>
        <Symbol name="search" size={15} />
        <span>Rechercher partout</span>
        <kbd>⌘K</kbd>
      </button>
      <div className="os-toolbar">
        <button
          type="button"
          className="os-circle-btn os-interactive"
          aria-label="Basculer le mode extérieur"
          aria-pressed={outdoor}
          onClick={() => setOutdoor(!outdoor)}
        >
          <Symbol name="sun" size={16} />
        </button>
        <Link className="os-circle-btn os-interactive" href="/admin/support" aria-label="Notifications">
          <Symbol name="bell" size={16} />
          {alert ? <span className="os-env-dot" aria-hidden="true" /> : null}
        </Link>
        <button
          type="button"
          className="os-circle-btn os-interactive"
          aria-label="Afficher ou masquer l'inspecteur"
          onClick={() => setInspectorOpen(true)}
        >
          <Symbol name="sidebar" size={16} />
        </button>
      </div>
    </header>
  );
}

function CommandPalette({ actions }: { actions: PaletteAction[] }) {
  const { setPaletteOpen } = useOsUi();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const navRows = NAV.filter(
    (n) => !q || n.label.toLowerCase().includes(q)
  ).map((n) => ({
    label: n.label,
    detail: n.href,
    href: n.href,
    icon: n.icon,
  }));
  const actionRows = actions.filter(
    (a) => q && (a.label.toLowerCase().includes(q) || a.detail.toLowerCase().includes(q))
  );
  return (
    <div className="os-cmd-overlay" onMouseDown={() => setPaletteOpen(false)}>
      <div
        className="os-palette os-regular"
        role="dialog"
        aria-label="Palette de commande"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="os-palette-search os-clear">
          <Symbol name="search" size={17} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une personne, un voyage, un produit, une action…"
            aria-label="Rechercher"
          />
          <kbd>esc</kbd>
        </div>
        <div className="os-cmd-label">NAVIGATION RAPIDE</div>
        {navRows.map((row) => (
          <Link key={row.href} href={row.href} className="os-cmd-row" onClick={() => setPaletteOpen(false)}>
            <span className="os-cmd-icon">
              <Symbol name={row.icon} />
            </span>
            <div>
              <strong>{row.label}</strong>
              <small>{row.detail}</small>
            </div>
            <kbd>↵</kbd>
          </Link>
        ))}
        {actionRows.length > 0 ? <div className="os-cmd-label">ACTIONS</div> : null}
        {actionRows.map((row) => (
          <Link key={row.href + row.label} href={row.href} className="os-cmd-row" onClick={() => setPaletteOpen(false)}>
            <span className="os-cmd-icon">
              <Symbol name={row.icon} />
            </span>
            <div>
              <strong>{row.label}</strong>
              <small>{row.detail}</small>
            </div>
            <kbd>↵</kbd>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Enveloppe inspecteur : masquée quand l'utilisateur la referme. */
export function InspectorBox({
  content,
  noteTarget,
  openHref,
}: {
  content: InspectorContent;
  noteTarget?: { table: string; id: string };
  openHref?: string;
}) {
  const { inspectorOpen, setInspectorOpen } = useOsUi();
  if (!inspectorOpen) return null;
  return (
    <aside className="os-inspector os-regular" aria-label="Inspecteur contexte">
      <div className="os-grabber" aria-hidden="true" />
      <div className="os-inspector-head">
        <div>
          <span className="os-eyebrow">Contexte</span>
          <h2>{content.title}</h2>
        </div>
        <button
          type="button"
          className="os-circle-btn os-interactive"
          aria-label="Fermer l'inspecteur"
          onClick={() => setInspectorOpen(false)}
        >
          <Symbol name="close" size={14} />
        </button>
      </div>
      <div className="os-orb os-tint">
        <Symbol name="sparkles" size={25} />
      </div>
      <div className="os-copilot-title">
        <strong>{content.headline}</strong>
        <span>{content.subtitle}</span>
      </div>
      <div className="os-insight os-clear">
        <span>Analyse</span>
        <p>{content.text}</p>
      </div>
      <h3>État détaillé</h3>
      {content.rows.map((r, i) => (
        <div className="os-status-row" key={i}>
          <i className={r.tone} aria-hidden="true" />
          <div>
            <strong>{r.title}</strong>
            <span>{r.detail}</span>
          </div>
          <b>{r.value}</b>
        </div>
      ))}
      <h3>Actions</h3>
      <div className="os-inspector-actions">
        <NoteComposer targetTable={noteTarget?.table} targetId={noteTarget?.id} />
        {openHref ? (
          <Link className="os-interactive" href={openHref}>
            Ouvrir
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
