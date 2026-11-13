'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import s from '../../ui/crm.module.css';
import { Avatar } from '../../ui/avatar';
import { Banner, EmptyState } from '../../ui/states';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { Field, TextArea, TextInput } from '../../ui/field';
import { Tabs, TabPanel } from '../../ui/tabs';
import { useToast } from '../../ui/toast';
import { supabaseBrowser } from '../../lib/supabase/browser';
import { euros, relativeFr } from '../../lib/format';
import type { Member360, MemberActivityEvent } from '../../lib/rpc';
import { errorMessage, runCommand } from '../data/cmd';
import { LOCAL_CATALOG, type CatalogCommand } from '../command/catalog';
import { CommandDrawer, type CommandTarget } from '../command/command-drawer';

const STATUS_CHIP: Record<Member360['account_status'], { tone: 'sage' | 'warn' | 'danger'; label: string }> = {
  active: { tone: 'sage', label: 'Compte actif' },
  suspended: { tone: 'warn', label: 'Compte suspendu' },
  banned: { tone: 'danger', label: 'Compte banni' }
};

/** Pastille carrée d'un événement : fond + encre du jeton, jamais une couleur littérale. */
const EVENT_KIND: Record<MemberActivityEvent['kind'], { background: string; color: string; mark: string }> = {
  avertissement: { background: 'var(--lkv-warning-bg)', color: 'var(--lkv-warning-dark)', mark: '!' },
  publication: { background: 'var(--sage-100)', color: 'var(--sage-800)', mark: 'C' },
  commande: { background: 'var(--lkv-info-bg)', color: 'var(--lkv-text-primary)', mark: '€' },
  moderation: { background: 'var(--lkv-danger-bg)', color: 'var(--lkv-danger-dark)', mark: 'M' },
  sortie: { background: 'var(--lkv-surface-muted)', color: 'var(--lkv-text-muted)', mark: 'S' },
  message: { background: 'var(--lkv-warning-bg)', color: 'var(--lkv-warning-dark)', mark: 'P' },
  note: { background: 'var(--lkv-surface-muted)', color: 'var(--lkv-text-muted)', mark: 'N' }
};

/** Actions de l'en-tête, dans l'ordre de la maquette. Chaque libellé ouvre une commande du registre. */
const HEADER_ACTIONS: { command: string; label: string; tone: 'soft' | 'bad'; title?: string }[] = [
  {
    command: 'ticket_reply',
    label: 'Écrire au membre',
    tone: 'soft',
    title: 'Écrire au membre : réponse support (la commande demande la référence du ticket)'
  },
  { command: 'member_revoke_sessions', label: 'Déconnecter partout', tone: 'soft' },
  { command: 'member_suspend', label: 'Suspendre…', tone: 'bad' }
];

const VISIBILITY: Record<'public' | 'membres' | 'prive', string> = {
  public: 'Public',
  membres: 'Membres',
  prive: 'Privé'
};

const DAY_MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const MONTH_YEAR = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const DAY_MONTH = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

function fullDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const stamp = Date.parse(iso);
  return Number.isFinite(stamp) ? DAY_MONTH_YEAR.format(new Date(stamp)) : null;
}

function monthYear(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const stamp = Date.parse(iso);
  return Number.isFinite(stamp) ? MONTH_YEAR.format(new Date(stamp)) : null;
}

function shortDate(iso: string): string {
  const stamp = Date.parse(iso);
  return Number.isFinite(stamp) ? DAY_MONTH.format(new Date(stamp)) : 'date inconnue';
}

/** Libellé d'événement : partie forte + détail atténué (le détail explicite gagne, sinon on coupe au « · »). */
function splitEvent(event: MemberActivityEvent): { main: string; detail: string | null } {
  if (event.detail) return { main: event.label, detail: event.detail };
  const cut = event.label.indexOf(' · ');
  if (cut === -1) return { main: event.label, detail: null };
  return { main: event.label.slice(0, cut), detail: event.label.slice(cut + 3) };
}

/** Référence de commande mise en mono dans un libellé (mise en forme seule, aucune donnée ajoutée). */
function withMonoReference(main: string, className: string): ReactNode {
  const match = main.match(/LKDV-\d+/);
  if (!match || match.index === undefined) return main;
  return (
    <>
      {main.slice(0, match.index)}
      <span className={className}>{match[0]}</span>
      {main.slice(match.index + match[0].length)}
    </>
  );
}

function Prop({ label, children, last = false }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '10px 0',
        borderBottom: last ? 0 : '0.5px solid var(--lkv-border)'
      }}
    >
      <span className={s.muted} style={{ fontSize: 12 }}>
        {label}
      </span>
      {children}
    </div>
  );
}

type Reveal = { email: string; phone: string; revealed_until: string };

/**
 * Fiche membre 360° (maquette `Membre.dc.html`) : identité, activité, contexte.
 * Les coordonnées sont masquées par défaut ; les révéler demande un motif et
 * laisse une ligne au journal.
 */
export function MemberRecord({ member, rail }: { member: Member360; rail?: ReactNode }) {
  const { push } = useToast();
  const [tab, setTab] = useState('activite');
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [askingReason, setAskingReason] = useState(false);
  const [reason, setReason] = useState('');
  const [revealError, setRevealError] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<CatalogCommand | null>(null);
  const [drawerTarget, setDrawerTarget] = useState<CommandTarget | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const menuRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const status = STATUS_CHIP[member.account_status] ?? { tone: 'stone' as const, label: 'Statut non renseigné' };
  const activeStrikes = member.strikes.filter((strike) => strike.active).length;
  const warningUntil = fullDate(member.warning_expires_at);
  const since = monthYear(member.member_since);
  const events = useMemo(() => member.activity_events ?? [], [member.activity_events]);

  const resolve = (action: { command: string; label: string }): CatalogCommand => {
    const known = LOCAL_CATALOG.find((candidate) => candidate.command === action.command);
    if (known) return known;
    return {
      id: action.command,
      command: action.command,
      label: action.label,
      pole: 'MEMB' as const,
      roleMin: 'membre' as const,
      needsValidation: false,
      reasonRequired: true,
      undoable: false,
      agent: 'never' as const,
      realtime: 'P2',
      domain: 'D1'
    };
  };

  const moreActions = useMemo(() => {
    const inHeader = new Set(HEADER_ACTIONS.map((action) => action.command));
    return member.actions.filter((action) => !inHeader.has(action.command));
  }, [member.actions]);

  const openAction = (action: { command: string; label: string }) => {
    setDrawerTarget(
      action.command === 'ticket_reply'
        ? undefined
        : { kind: 'membre', id: member.id, label: member.display_name }
    );
    setDrawer(resolve(action));
  };

  const filtered = useMemo(() => {
    const needle = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (!needle) return events;
    return events.filter((event) =>
      `${event.label} ${event.detail ?? ''} ${event.group}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(needle)
    );
  }, [events, query]);

  const groups = useMemo(() => {
    const out: { group: string; events: MemberActivityEvent[] }[] = [];
    for (const event of filtered) {
      const current = out[out.length - 1];
      if (current && current.group === event.group) current.events.push(event);
      else out.push({ group: event.group, events: [event] });
    }
    return out;
  }, [filtered]);

  const doReveal = async () => {
    if (reason.trim().length < 3) {
      setRevealError('Indiquez un motif (au moins 3 caractères) : il est inscrit au journal.');
      return;
    }
    setRevealing(true);
    setRevealError(null);
    try {
      const client = supabaseBrowser().schema('admin') as unknown as {
        rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      };
      const { data, error } = await client.rpc('reveal_pii', { p_user_id: member.id, p_reason: reason.trim() });
      if (error) {
        setRevealError('La révélation a été refusée. Vérifiez votre rôle, puis réessayez.');
        return;
      }
      const payload = data as Partial<Reveal> | null;
      setReveal({
        email: payload?.email ?? 'non renseigné',
        phone: payload?.phone ?? 'non renseigné',
        revealed_until: payload?.revealed_until ?? ''
      });
      setAskingReason(false);
      push({ message: 'Coordonnées affichées : l’accès est inscrit au journal.', ttlMs: 6000 });
    } catch {
      setRevealError('La connexion à la base a échoué. Réessayez dans un instant.');
    } finally {
      setRevealing(false);
    }
  };

  const addNote = async () => {
    if (!note.trim()) {
      setNoteError('Écrivez la note avant d’enregistrer.');
      return;
    }
    const result = await runCommand('note_add', { target: `membre:${member.id}`, body: note.trim() });
    if (!result.ok) {
      setNoteError(errorMessage(result));
      return;
    }
    setNote('');
    setNoteError(null);
    push({ message: 'Note interne ajoutée.', ttlMs: 5000 });
  };

  const openDocuments = () => {
    push({
      message: 'Documents d’identité : hors de cet écran (super admin · 15 min · journalisé). Aucune commande ne les ouvre ici.',
      ttlMs: 7000
    });
  };

  const tabs = [
    { id: 'activite', label: 'Activité' },
    { id: 'moderation', label: `Modération · ${member.activity.reports_against}` },
    { id: 'commandes', label: `Commandes · ${member.activity.orders}` },
    {
      id: 'voyages',
      label: member.activity.voyages === undefined ? 'Voyages' : `Voyages · ${member.activity.voyages}`
    },
    { id: 'acces', label: 'Accès à cette fiche' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
      <section
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 18,
          alignItems: 'center',
          padding: '24px 28px 18px',
          borderBottom: '1px solid var(--lkv-border-subtle)'
        }}
      >
        <Avatar name={member.display_name} size={64} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 240 }}>
          <h1 className={s.titleSm}>{member.display_name}</h1>
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Chip tone={status.tone}>{status.label}</Chip>
            {member.suspended_until ? <Chip tone="warn">Suspendu jusqu’au {fullDate(member.suspended_until)}</Chip> : null}
            {activeStrikes > 0 ? (
              <Chip tone="warn">
                {activeStrikes} avertissement{activeStrikes > 1 ? 's' : ''} actif{activeStrikes > 1 ? 's' : ''}
                {warningUntil ? ` · expire le ${warningUntil}` : ''}
              </Chip>
            ) : null}
            <Chip tone="stone">{since ? `Membre depuis ${since}` : 'Ancienneté : non renseignée'}</Chip>
          </span>
        </div>
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setMenuOpen(false);
          }}
        >
          {HEADER_ACTIONS.map((action) => (
            <Button key={action.command} tone={action.tone} title={action.title} onClick={() => openAction(action)}>
              {action.label}
            </Button>
          ))}
          {moreActions.length > 0 ? (
            <span ref={menuRef} style={{ position: 'relative', display: 'inline-flex' }}>
              <Button
                tone="soft"
                aria-label="Plus d’actions"
                aria-expanded={menuOpen}
                aria-controls="member-more-actions"
                onClick={() => setMenuOpen((value) => !value)}
              >
                …
              </Button>
              {menuOpen ? (
                <div
                  id="member-more-actions"
                  role="group"
                  aria-label="Plus d’actions"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    zIndex: 20,
                    minWidth: 240,
                    padding: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    background: 'var(--lkv-surface-card)',
                    border: '1px solid var(--lkv-border)',
                    borderRadius: 'var(--lkv-radius-sm)',
                    boxShadow: '0 8px 24px color-mix(in srgb, var(--lkv-primary) 10%, transparent)'
                  }}
                >
                  {moreActions.map((action) => (
                    <button
                      key={action.command}
                      type="button"
                      className={s.row}
                      style={{ minHeight: 44, borderRadius: 10, textAlign: 'left', font: 'inherit', width: '100%' }}
                      onClick={() => {
                        setMenuOpen(false);
                        openAction(action);
                      }}
                    >
                      <span className={s.rowMain}>
                        <span className={s.rowTitle}>{action.label}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </span>
          ) : null}
        </div>
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', flex: 1 }}>
        <aside
          aria-label="Identité"
          style={{
            flex: '1 1 310px',
            maxWidth: 310,
            padding: '18px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            borderRight: '1px solid var(--lkv-border-subtle)'
          }}
        >
          <span className={s.label} style={{ paddingBottom: 4 }}>
            Coordonnées
          </span>

          <Prop label="E-mail">
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span className={s.mono} style={{ fontSize: 13 }}>
                {reveal ? reveal.email : member.email_masked || 'non renseigné'}
              </span>
              <Button
                size="sm"
                tone="soft"
                aria-label="Afficher l’e-mail"
                aria-expanded={askingReason}
                onClick={() => setAskingReason((value) => !value)}
              >
                Afficher
              </Button>
            </span>
          </Prop>

          <Prop label="Téléphone">
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span className={s.mono} style={{ fontSize: 13 }}>
                {reveal ? reveal.phone : member.phone_masked || 'non renseigné'}
              </span>
              <Button
                size="sm"
                tone="soft"
                aria-label="Afficher le téléphone"
                aria-expanded={askingReason}
                onClick={() => setAskingReason((value) => !value)}
              >
                Afficher
              </Button>
            </span>
          </Prop>

          <p className={s.muted} style={{ fontSize: 12, margin: '6px 0 10px' }}>
            Chaque affichage est inscrit au journal.
          </p>

          {askingReason ? (
            <div className={s.colGapSm} style={{ paddingTop: 8 }}>
              <Field
                label="Motif de l’affichage"
                htmlFor="pii-reason"
                required
                error={revealError}
                hint="Inscrit au journal ; les coordonnées restent visibles 15 minutes."
              >
                <TextInput
                  id="pii-reason"
                  value={reason}
                  invalid={Boolean(revealError)}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ex. : demande du membre"
                />
              </Field>
              <Button tone="pg" size="sm" onClick={() => void doReveal()} disabled={revealing}>
                {revealing ? 'Vérification…' : 'Afficher et journaliser'}
              </Button>
            </div>
          ) : null}

          {reveal?.revealed_until ? (
            <Banner tone="info">Visible jusqu’à {new Date(reveal.revealed_until).toLocaleTimeString('fr-FR')}.</Banner>
          ) : null}

          <span className={s.label} style={{ padding: '8px 0 4px' }}>
            Compte
          </span>
          <Prop label="Pseudo public">
            <span>{member.display_name}</span>
          </Prop>
          <Prop label="Visibilité du profil">
            <span>{member.profile_visibility ? VISIBILITY[member.profile_visibility] : 'non renseigné'}</span>
          </Prop>
          <Prop label="Double authentification">
            <span>{member.two_fa_enabled === null || member.two_fa_enabled === undefined ? 'non renseigné' : member.two_fa_enabled ? 'Activée' : 'Non activée'}</span>
          </Prop>
          <Prop label="Consentement e-mails">
            <span>{member.email_consent === null || member.email_consent === undefined ? 'non renseigné' : member.email_consent ? 'Accepté' : 'Refusé'}</span>
          </Prop>
          <Prop label="Documents d’identité" last>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>
                {member.documents_count === null || member.documents_count === undefined
                  ? 'non renseigné'
                  : `${member.documents_count} document${member.documents_count > 1 ? 's' : ''}`}
              </span>
              <Button
                size="sm"
                tone="soft"
                title="Les documents d’identité ne s’ouvrent pas depuis cette fiche (super admin · 15 min · journalisé)."
                onClick={openDocuments}
              >
                Ouvrir avec motif
              </Button>
            </span>
            <span className={s.muted} style={{ fontSize: 12 }}>
              Super admin seul · 15 min · journalisé
            </span>
          </Prop>
        </aside>

        <main style={{ flex: '999 1 420px', minWidth: 0, padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className={s.cardSoft} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className={s.between}>
              <span className={s.label}>Résumé</span>
              <Chip tone="stone">Agent Résumeur · à relire</Chip>
            </span>
            <span style={{ fontSize: 13.5 }}>
              {member.ai_summary ?? 'Résumé non renseigné : l’agent n’a pas encore traité cette fiche.'}
            </span>
          </div>

          <Tabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Sections de la fiche" />

          <TabPanel active={tab === 'activite'}>
          <label style={{ display: 'flex' }}>
            <span className={s.visuallyHidden}>Chercher dans l’activité</span>
            <TextInput
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Chercher dans l’activité…"
              aria-label="Chercher dans l’activité"
            />
          </label>

            <div className={s.card} style={{ padding: '6px 16px' }} aria-label="Activité">
              {groups.length === 0 ? (
                <EmptyState title={events.length === 0 ? 'Fil d’activité : non renseigné' : 'Aucun événement ne correspond'}>
                  {events.length === 0
                    ? '`admin.member_360` n’expose pas encore les événements de ce compte — aucun événement n’est inventé ici.'
                    : 'Modifiez la recherche pour retrouver un événement.'}
                </EmptyState>
              ) : (
                groups.map((group, groupIndex) => (
                  <div key={group.group}>
                    <div style={{ padding: groupIndex === 0 ? '10px 4px 4px' : '14px 4px 4px' }}>
                      <span className={s.label}>{group.group}</span>
                    </div>
                    {group.events.map((event, index) => {
                      const kind = EVENT_KIND[event.kind] ?? EVENT_KIND.note;
                      const { main, detail } = splitEvent(event);
                      const last = groupIndex === groups.length - 1 && index === group.events.length - 1;
                      return (
                        <div
                          key={`${event.at}-${index}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            minHeight: 48,
                            padding: '8px 4px',
                            borderBottom: last ? 0 : '0.5px solid var(--lkv-border)'
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: 9,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flex: 'none',
                              fontSize: 12,
                              fontWeight: 700,
                              background: kind.background,
                              color: kind.color
                            }}
                          >
                            {kind.mark}
                          </span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>
                            <strong style={{ fontWeight: 600 }}>
                              {event.kind === 'commande' ? withMonoReference(main, s.mono) : main}
                            </strong>
                            {detail ? <span className={s.muted}> · {detail}</span> : null}
                          </span>
                          {event.group === 'À venir' ? null : (
                            <span className={s.muted} style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
                              {shortDate(event.at)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </TabPanel>

          <TabPanel active={tab === 'moderation'}>
            <div className={s.card} style={{ padding: '6px 16px' }}>
              {member.strikes.length === 0 ? (
                <EmptyState title="Aucun avertissement">Ce compte n’a jamais été sanctionné.</EmptyState>
              ) : (
                member.strikes.map((strike) => (
                  <div key={strike.id} className={s.row} style={{ cursor: 'default' }}>
                    <span className={strike.active ? s.dotWarn : s.dot} aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none' }} />
                    <span className={s.rowMain}>
                      <span className={s.rowTitle}>{strike.reason}</span>
                      <span className={s.rowSub}>
                        {relativeFr(strike.created_at)} · expire le {fullDate(strike.expires_at)}
                      </span>
                    </span>
                    <Chip tone={strike.active ? 'warn' : 'stone'}>{strike.active ? 'Actif' : 'Expiré'}</Chip>
                  </div>
                ))
              )}
            </div>

            <div className={s.card} style={{ padding: '6px 16px' }}>
              {member.notes.length === 0 ? (
                <EmptyState title="Aucune note interne">Les notes ne sont visibles que par l’équipe.</EmptyState>
              ) : (
                member.notes.map((entry) => (
                  <div key={entry.id} className={s.row} style={{ cursor: 'default', alignItems: 'flex-start' }}>
                    <span className={s.rowMain}>
                      <span className={s.rowTitle} style={{ whiteSpace: 'normal' }}>
                        {entry.body}
                      </span>
                      <span className={s.rowSub}>
                        {entry.author} · {relativeFr(entry.created_at)}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </div>

            <Field
              label="Ajouter une note interne"
              htmlFor="member-note"
              error={noteError}
              hint="Visible seulement par l’équipe."
            >
              <TextArea
                id="member-note"
                rows={3}
                value={note}
                invalid={Boolean(noteError)}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ce qu’il faut savoir avant d’agir sur ce compte."
              />
            </Field>
            <Button tone="soft" onClick={() => void addNote()}>
              Enregistrer la note
            </Button>
          </TabPanel>

          <TabPanel active={tab === 'commandes'}>
            <div className={s.card} style={{ padding: '6px 16px' }}>
              {member.orders && member.orders.length > 0 ? (
                member.orders.map((order) => (
                  <div key={order.number} className={s.row} style={{ cursor: 'default' }}>
                    <span className={s.rowMain}>
                      <span className={s.rowTitle}>
                        <span className={s.mono}>{order.number}</span> · {euros(order.amount_cents)}
                      </span>
                      <span className={s.rowSub}>
                        {order.status} · {relativeFr(order.at)}
                      </span>
                    </span>
                    <Chip tone="stone">{order.status}</Chip>
                  </div>
                ))
              ) : (
                <EmptyState title="Aucune commande au compteur">
                  Le détail s’ouvre par la commande « Ouvrir une commande » — cet écran ne reçoit pas la liste.
                </EmptyState>
              )}
            </div>
          </TabPanel>

          <TabPanel active={tab === 'voyages'}>
            <div className={s.card}>
              <EmptyState title={`${member.activity.voyages ?? 0} voyage(s) au compteur`}>
                Le détail des voyages n’est pas exposé par `admin.member_360` : il s’ouvre depuis le pôle Membres.
              </EmptyState>
            </div>
          </TabPanel>

          <TabPanel active={tab === 'acces'}>
            <div className={s.card}>
              <EmptyState title="Accès journalisés">
                Chaque affichage de coordonnées, chaque action et chaque consultation sensible de cette fiche sont
                inscrits au journal d’audit. <Link href="/journal">Ouvrir le journal</Link>
              </EmptyState>
            </div>
          </TabPanel>
        </main>

        {rail ? (
          <aside className={s.rail} aria-label="Contexte">
            {rail}
          </aside>
        ) : null}
      </div>

      <CommandDrawer
        open={drawer !== null}
        command={drawer}
        ctx={null}
        target={drawerTarget}
        onClose={() => setDrawer(null)}
      />
    </div>
  );
}
