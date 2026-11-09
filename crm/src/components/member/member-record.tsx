'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import s from '../../ui/crm.module.css';
import { cx } from '../../ui/cx';
import { Avatar } from '../../ui/avatar';
import { Banner, EmptyState } from '../../ui/states';
import { Button } from '../../ui/button';
import { Chip } from '../../ui/chip';
import { Field, TextArea, TextInput } from '../../ui/field';
import { Tabs, TabPanel } from '../../ui/tabs';
import { useToast } from '../../ui/toast';
import { IconEye } from '../../ui/icons';
import { supabaseBrowser } from '../../lib/supabase/browser';
import { relativeFr } from '../../lib/format';
import type { Member360 } from '../../lib/rpc';
import { errorMessage, runCommand } from '../data/cmd';
import { LOCAL_CATALOG, type CatalogCommand } from '../command/catalog';
import { CommandDrawer } from '../command/command-drawer';

const STATUS_CHIP: Record<Member360['account_status'], { tone: 'sage' | 'warn' | 'danger'; label: string }> = {
  active: { tone: 'sage', label: 'Compte actif' },
  suspended: { tone: 'warn', label: 'Compte suspendu' },
  banned: { tone: 'danger', label: 'Compte banni' }
};

type Reveal = { email: string; phone: string; revealed_until: string };

/**
 * Fiche membre 360° (maquette `Membre.dc.html`) : identité, activité, contexte.
 * Les coordonnées sont masquées par défaut ; les révéler demande un motif et
 * laisse une ligne au journal.
 */
export function MemberRecord({ member }: { member: Member360 }) {
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
  const [query, setQuery] = useState('');

  const status = STATUS_CHIP[member.account_status] ?? { tone: 'stone' as const, label: 'Statut non renseigné' };

  const commands = useMemo(() => {
    return member.actions
      .map((action) => {
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
      })
      .slice(0, 3);
  }, [member.actions]);

  const moreCommands = useMemo(() => {
    return member.actions
      .map((action) => LOCAL_CATALOG.find((candidate) => candidate.command === action.command))
      .filter((candidate): candidate is CatalogCommand => Boolean(candidate))
      .slice(3, 8);
  }, [member.actions]);

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

  return (
    <div className={s.col} style={{ gap: 0 }}>
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
        <div className={s.col} style={{ gap: 4, flex: 1, minWidth: 240 }}>
          <h1 className={s.titleSm}>{member.display_name}</h1>
          <span className={s.rowFlexWrap}>
            <Chip tone={status.tone}>{status.label}</Chip>
            {member.suspended_until ? <Chip tone="warn">Suspendu jusqu’au {member.suspended_until}</Chip> : null}
            <Chip tone="stone">
              {member.member_since ? `Membre depuis ${member.member_since}` : 'Ancienneté : non renseignée'}
            </Chip>
            {member.strikes.some((strike) => strike.active) ? (
              <Chip tone="warn">
                {member.strikes.filter((strike) => strike.active).length} avertissement(s) actif(s)
              </Chip>
            ) : null}
          </span>
        </div>
        <div className={s.rowFlexWrap}>
          {commands.map((command) => (
            <Button
              key={command.command}
              tone={command.command.includes('suspend') || command.command.includes('ban') ? 'bad' : 'soft'}
              onClick={() => setDrawer(command)}
            >
              {command.label}
            </Button>
          ))}
          {moreCommands.length > 0 ? (
            <Button tone="soft" aria-label="Plus d’actions" onClick={() => setDrawer(moreCommands[0] ?? null)}>
              …
            </Button>
          ) : null}
        </div>
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', flex: 1 }}>
        <aside
          aria-label="Identité"
          style={{
            flex: '1 1 260px',
            maxWidth: 300,
            padding: '18px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            borderRight: '1px solid var(--lkv-border-subtle)'
          }}
        >
          <span className={s.label} style={{ paddingBottom: 4 }}>Coordonnées</span>

          <div className={s.kv} style={{ borderBottom: '0.5px solid var(--lkv-border)', flexDirection: 'column', alignItems: 'stretch' }}>
            <span className={s.muted} style={{ fontSize: 12 }}>E-mail</span>
            <span className={s.rowFlex} style={{ justifyContent: 'space-between' }}>
              <span className={s.mono} style={{ fontSize: 13 }}>{reveal ? reveal.email : member.email_masked || 'non renseigné'}</span>
              <Button size="sm" tone="soft" icon={<IconEye size={14} />} onClick={() => setAskingReason((value) => !value)}>
                Afficher
              </Button>
            </span>
          </div>

          <div className={s.kv} style={{ borderBottom: '0.5px solid var(--lkv-border)', flexDirection: 'column', alignItems: 'stretch' }}>
            <span className={s.muted} style={{ fontSize: 12 }}>Téléphone</span>
            <span className={s.rowFlex} style={{ justifyContent: 'space-between' }}>
              <span className={s.mono} style={{ fontSize: 13 }}>{reveal ? reveal.phone : member.phone_masked || 'non renseigné'}</span>
            </span>
          </div>

          {askingReason ? (
            <div className={s.colGapSm} style={{ paddingTop: 8 }}>
              <Field label="Motif de l’affichage" htmlFor="pii-reason" required error={revealError} hint="Inscrit au journal ; les coordonnées restent visibles 15 minutes.">
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
          ) : (
            <p className={s.muted} style={{ fontSize: 12, margin: '6px 0 10px' }}>
              Chaque affichage est inscrit au journal.
            </p>
          )}

          {reveal?.revealed_until ? (
            <Banner tone="info">Visible jusqu’à {new Date(reveal.revealed_until).toLocaleTimeString('fr-FR')}.</Banner>
          ) : null}

          <span className={s.label} style={{ padding: '8px 0 4px' }}>Compte</span>
          <div className={s.kv} style={{ borderBottom: '0.5px solid var(--lkv-border)' }}>
            <span className={s.muted} style={{ fontSize: 12 }}>Pseudo public</span>
            <span>{member.display_name}</span>
          </div>
          <div className={s.kv} style={{ borderBottom: '0.5px solid var(--lkv-border)' }}>
            <span className={s.muted} style={{ fontSize: 12 }}>Score de confiance</span>
            <span>{member.trust_score === null ? 'non renseigné' : `${member.trust_score} / 100`}</span>
          </div>
          <div className={s.kv} style={{ borderBottom: '0.5px solid var(--lkv-border)' }}>
            <span className={s.muted} style={{ fontSize: 12 }}>Palier de fidélité</span>
            <span>{member.loyalty_level ?? 'non renseigné'}</span>
          </div>
          <div className={s.kv} style={{ borderBottom: '0.5px solid var(--lkv-border)' }}>
            <span className={s.muted} style={{ fontSize: 12 }}>Dernière activité</span>
            <span>{relativeFr(member.activity.last_seen)}</span>
          </div>
          <div className={s.kv} style={{ borderBottom: 0, flexDirection: 'column', alignItems: 'stretch' }}>
            <span className={s.muted} style={{ fontSize: 12 }}>Documents d’identité</span>
            <span className={s.muted} style={{ fontSize: 12 }}>
              Super admin seul · motif · 15 min · journalisé. Cet écran ne les ouvre pas.
            </span>
          </div>
        </aside>

        <main style={{ flex: '999 1 420px', minWidth: 0, padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className={`${s.cardSoft} ${s.pad}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className={s.between}>
              <span className={s.label}>Résumé</span>
              <Chip tone="stone">Agent Résumeur · à relire</Chip>
            </span>
            <span style={{ fontSize: 13.5 }}>
              {member.ai_summary ?? 'Résumé non renseigné : l’agent n’a pas encore traité cette fiche.'}
            </span>
          </div>

          <Tabs
            tabs={[
              { id: 'activite', label: 'Activité' },
              { id: 'moderation', label: `Modération · ${member.activity.reports_against}` },
              { id: 'commandes', label: `Commandes · ${member.activity.orders}` },
              { id: 'notes', label: `Notes · ${member.notes.length}` },
              { id: 'acces', label: 'Accès à cette fiche' }
            ]}
            value={tab}
            onChange={setTab}
            ariaLabel="Sections de la fiche"
          />

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

          <TabPanel active={tab === 'activite'}>
            <div className={s.miniGrid} style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              <span className={s.mini}>
                <span className={s.muted} style={{ fontSize: 12 }}>Publications</span>
                <strong className={s.statValue}>{member.activity.posts}</strong>
              </span>
              <span className={s.mini}>
                <span className={s.muted} style={{ fontSize: 12 }}>Commentaires</span>
                <strong className={s.statValue}>{member.activity.comments}</strong>
              </span>
              <span className={s.mini}>
                <span className={s.muted} style={{ fontSize: 12 }}>Carnets</span>
                <strong className={s.statValue}>{member.activity.carnets}</strong>
              </span>
              <span className={s.mini}>
                <span className={s.muted} style={{ fontSize: 12 }}>Commandes</span>
                <strong className={s.statValue}>{member.activity.orders}</strong>
              </span>
              <span className={s.mini}>
                <span className={s.muted} style={{ fontSize: 12 }}>Signalements reçus</span>
                <strong className={s.statValue}>{member.activity.reports_against}</strong>
              </span>
              <span className={s.mini}>
                <span className={s.muted} style={{ fontSize: 12 }}>Dernière activité</span>
                <strong className={s.statValue} style={{ fontSize: 13 }}>{relativeFr(member.activity.last_seen)}</strong>
              </span>
            </div>
            <div className={s.card}>
              <EmptyState title="Fil d’activité détaillé : non renseigné">
                `admin.member_360` expose les compteurs, pas les événements. Le détail arrivera quand la RPC le
                fournira — aucun événement n’est inventé ici.
              </EmptyState>
            </div>
          </TabPanel>

          <TabPanel active={tab === 'moderation'}>
            {member.strikes.length === 0 ? (
              <div className={s.card}>
                <EmptyState title="Aucun avertissement">Ce compte n’a jamais été sanctionné.</EmptyState>
              </div>
            ) : (
              <div className={s.card}>
                {member.strikes.map((strike) => (
                  <div key={strike.id} className={s.row} style={{ cursor: 'default' }}>
                    <span className={cx(s.dot, strike.active ? s.dotWarn : s.dot)} aria-hidden="true" />
                    <span className={s.rowMain}>
                      <span className={s.rowTitle}>{strike.reason}</span>
                      <span className={s.rowSub}>
                        {relativeFr(strike.created_at)} · expire {strike.expires_at}
                      </span>
                    </span>
                    <Chip tone={strike.active ? 'warn' : 'stone'}>{strike.active ? 'Actif' : 'Expiré'}</Chip>
                  </div>
                ))}
              </div>
            )}
          </TabPanel>

          <TabPanel active={tab === 'commandes'}>
            <div className={s.card}>
              <EmptyState title={`${member.activity.orders} commande(s) au compteur`}>
                Le détail des commandes s’ouvre depuis <Link href="/catalogue">le catalogue</Link> (commande « Ouvrir une
                commande ») — cet écran ne reçoit pas la liste.
              </EmptyState>
            </div>
          </TabPanel>

          <TabPanel active={tab === 'notes'}>
            <div className={s.card} style={{ padding: '6px 16px' }}>
              {member.notes.length === 0 ? (
                <EmptyState title="Aucune note interne">Les notes ne sont visibles que par l’équipe.</EmptyState>
              ) : (
                member.notes.map((entry) => (
                  <div key={entry.id} className={s.row} style={{ cursor: 'default', alignItems: 'flex-start' }}>
                    <span className={s.rowMain}>
                      <span className={s.rowTitle} style={{ whiteSpace: 'normal' }}>{entry.body}</span>
                      <span className={s.rowSub}>{entry.author} · {relativeFr(entry.created_at)}</span>
                    </span>
                  </div>
                ))
              )}
            </div>
            <Field label="Ajouter une note interne" htmlFor="member-note" error={noteError} hint="Visible seulement par l’équipe.">
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

          <TabPanel active={tab === 'acces'}>
            <div className={s.card}>
              <EmptyState title="Accès journalisés">
                Chaque affichage de coordonnées, chaque action et chaque consultation sensible de cette fiche sont
                inscrits au journal d’audit. <Link href="/journal">Ouvrir le journal</Link>
              </EmptyState>
            </div>
          </TabPanel>
        </main>
      </div>

      <CommandDrawer
        open={drawer !== null}
        command={drawer}
        ctx={null}
        target={{ kind: 'membre', id: member.id, label: member.display_name }}
        onClose={() => setDrawer(null)}
      />
    </div>
  );
}
