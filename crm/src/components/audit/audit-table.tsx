'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import s from '../../ui/crm.module.css';
import { cx } from '../../ui/cx';
import { Chip } from '../../ui/chip';
import { Select, Field } from '../../ui/field';
import { EmptyState } from '../../ui/states';
import type { AuditRow } from '../../lib/rpc';
import { BUNDLED_REASON_CODES } from '../data/reason-codes';

function time(iso: string): string {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
}

function beforeAfter(row: AuditRow): string {
  if (row.before === null && row.after === null) return '—';
  const format = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  return `${format(row.before)} → ${format(row.after)}`;
}

/** Journal d'audit (maquette `Journal.dc.html`) : filtres, pastilles, tableau. */
const COMMAND_LABELS: Record<string, string> = {
  order_refund: 'Remboursement validé',
  order_confirm: 'Commande confirmée',
  order_ship: 'Commande expédiée',
  comment_hide: 'Commentaire masqué',
  post_hide: 'Publication masquée',
  comment_remove: 'Commentaire supprimé',
  post_remove: 'Publication retirée',
  post_restore: 'Publication restaurée',
  post_report_resolve: 'Signalement de publication traité',
  comment_report_resolve: 'Signalement de commentaire traité',
  member_suspend: 'Compte suspendu',
  member_ban: 'Compte banni',
  member_reactivate: 'Compte réactivé',
  member_adjust_trust: 'Score de confiance ajusté',
  member_360: 'Fiche membre consultée',
  reveal_pii: 'Coordonnées affichées',
  membership_review: 'Adhésion examinée',
  ticket_reply: 'Réponse à un ticket',
  ticket_set_status: 'Statut de ticket modifié',
  feature_flag_toggle: 'Indicateur basculé',
  ai_kill_switch: 'IA du site coupée ou rallumée',
  agent_stop: 'Agent arrêté',
  agent_stop_all: 'Tous les agents arrêtés',
  stripe_event_replay: 'Événement Stripe rejoué',
  undo: 'Action annulée (10 s)'
};

function humanCommand(command: string): string {
  return COMMAND_LABELS[command] ?? command.replace(/_/g, ' ');
}

const BUSINESS_REASONS: Record<string, string> = {
  produit_defectueux: 'Produit défectueux',
  colis_perdu: 'Colis perdu',
  controle: 'Contrôle',
  reparation: 'Réparation',
  verification_identite: 'Vérification d’identité',
  recette: 'Recette',
  arret_manuel: 'Arrêt manuel'
};

function humanReason(code: string): string {
  const found = BUNDLED_REASON_CODES.find((candidate) => candidate.code === code);
  if (found) return found.label;
  if (BUSINESS_REASONS[code]) return BUSINESS_REASONS[code];
  const words = code.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function AuditTable({ rows, nextBefore }: { rows: AuditRow[]; nextBefore: string | null }) {
  const router = useRouter();
  const params = useSearchParams();


  const filters = useMemo(
    () => ({
      period: params.get('periode') ?? 'aujourdhui',
      actor: params.get('acteur') ?? 'tous',
      type: params.get('type') ?? 'toutes'
    }),
    [params]
  );

  const push = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) next.set(key, value);
    router.push(`/journal?${next.toString()}`);
  };

  const filtered = rows;

  const soloCount = rows.filter((row) => row.solo).length;
  const piiCount = rows.filter((row) => row.pii).length;

  return (
    <>
      <div className={s.between} style={{ alignItems: 'flex-end' }}>
        <div className={s.col} style={{ gap: 4 }}>
          <h1 className={s.titleSm} style={{ fontSize: 28 }}>Journal d’audit</h1>
          <span className={s.subtitle}>
            Ajout seul : aucune ligne ne peut être modifiée ni supprimée · décisions conservées 3 ans, consultations 1 an
          </span>
        </div>
        <a
          className={`${s.btn} ${s.btnSoft}`}
          href={`/api/audit/export?periode=${encodeURIComponent(filters.period)}&acteur=${encodeURIComponent(filters.actor)}&type=${encodeURIComponent(filters.type)}`}
        >
          Exporter la période
        </a>
      </div>

      <div className={s.rowFlexWrap} style={{ alignItems: 'flex-end' }}>
        <Field label={<span className={s.label}>Période</span>} htmlFor="audit-period">
          <Select id="audit-period" value={filters.period} onChange={(event) => push({ periode: event.target.value })}>
            <option value="aujourdhui">Aujourd’hui</option>
            <option value="7j">7 derniers jours</option>
            <option value="30j">30 derniers jours</option>
          </Select>
        </Field>
        <Field label={<span className={s.label}>Acteur</span>} htmlFor="audit-actor">
          <Select id="audit-actor" value={filters.actor} onChange={(event) => push({ acteur: event.target.value })}>
            <option value="tous">Tout le monde</option>
            <option value="humain">Humains</option>
            <option value="agent">Agents IA</option>
            <option value="systeme">Système</option>
          </Select>
        </Field>
        <Field label={<span className={s.label}>Type</span>} htmlFor="audit-type">
          <Select id="audit-type" value={filters.type} onChange={(event) => push({ type: event.target.value })}>
            <option value="toutes">Toutes les actions</option>
            <option value="decisions">Décisions</option>
            <option value="sensibles">Consultations sensibles</option>
            <option value="argent">Argent</option>
          </Select>
        </Field>
        <span className={s.rowFlexWrap} style={{ marginLeft: 'auto' }}>
          <Chip tone="warn">{soloCount} validation{soloCount > 1 ? 's' : ''} seule{soloCount > 1 ? 's' : ''}</Chip>
          <Chip tone="info">{piiCount} accès sensible{piiCount > 1 ? 's' : ''}</Chip>
        </span>
      </div>

      <section className={cx(s.card, s.tableWrap)} aria-label="Lignes du journal">
        {filtered.length === 0 ? (
          <EmptyState title="Aucune ligne pour ces filtres">
            Élargissez la période ou changez d’acteur. Le journal ne contient que des faits : rien n’est complété.
          </EmptyState>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Heure</th>
                <th scope="col">Acteur</th>
                <th scope="col">Action</th>
                <th scope="col">Cible</th>
                <th scope="col">Motif</th>
                <th scope="col">Avant → après</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className={s.mono}>{time(row.created_at)}</td>
                  <td>
                    {row.actor_kind === 'agent' ? <Chip tone="stone">Agent</Chip> : null}{' '}
                    {row.actor_kind === 'agent' ? row.actor.replace(/^Agent\s+/i, '') : row.actor}
                  </td>
                  <td>
                    <strong>{humanCommand(row.command)}</strong>
                    <div className={s.rowFlexWrap} style={{ marginTop: 4 }}>
                      {row.solo ? <Chip tone="warn">Validé seul · mode solo</Chip> : null}
                      {row.pii ? <Chip tone="info">Accès sensible · 15 min</Chip> : null}
                      {row.actor_kind === 'systeme' ? <Chip tone="stone">Système</Chip> : null}
                    </div>
                  </td>
                  <td>
                    {row.target_label ?? row.target_id ?? '—'}
                  </td>
                  <td>{row.reason ? humanReason(row.reason) : <span className={s.muted}>—</span>}</td>
                  <td className={s.mono}>{row.summary ?? beforeAfter(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className={s.between}>
        <p className={s.muted} style={{ margin: 0, fontSize: 12.5 }}>
          Les journaux servent à la sécurité et à la contestation des décisions ; ils ne mesurent jamais le temps de travail.
        </p>
        {nextBefore ? (
          <Link href={`/journal?avant=${nextBefore}`} className={`${s.btn} ${s.btnSoft} ${s.btnSm}`}>
            Charger la suite
          </Link>
        ) : null}
      </div>
    </>
  );
}
