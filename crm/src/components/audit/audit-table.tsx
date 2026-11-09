'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import s from '@/ui/crm.module.css';
import { cx } from '@/ui/cx';
import { Chip } from '@/ui/chip';
import { Button } from '@/ui/button';
import { Select, Field } from '@/ui/field';
import { EmptyState } from '@/ui/states';
import type { AuditRow } from '@/lib/rpc';

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
export function AuditTable({ rows, nextBefore }: { rows: AuditRow[]; nextBefore: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState('');

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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.command, row.actor, row.target_id, row.reason, row.request_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [rows, query]);

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
        <Button tone="soft" disabled title="L’export serveur de la période n’est pas encore branché.">
          Exporter la période
        </Button>
      </div>

      <div className={s.rowFlexWrap} style={{ alignItems: 'flex-end' }}>
        <Field label="Période" htmlFor="audit-period">
          <Select id="audit-period" value={filters.period} onChange={(event) => push({ periode: event.target.value })}>
            <option value="aujourdhui">Aujourd’hui</option>
            <option value="7j">7 derniers jours</option>
            <option value="30j">30 derniers jours</option>
          </Select>
        </Field>
        <Field label="Acteur" htmlFor="audit-actor">
          <Select id="audit-actor" value={filters.actor} onChange={(event) => push({ acteur: event.target.value })}>
            <option value="tous">Tout le monde</option>
            <option value="humain">Humains</option>
            <option value="agent">Agents IA</option>
            <option value="systeme">Système</option>
          </Select>
        </Field>
        <Field label="Type" htmlFor="audit-type">
          <Select id="audit-type" value={filters.type} onChange={(event) => push({ type: event.target.value })}>
            <option value="toutes">Toutes les actions</option>
            <option value="decisions">Décisions</option>
            <option value="sensibles">Consultations sensibles</option>
            <option value="argent">Argent</option>
          </Select>
        </Field>
        <Field label="Rechercher" htmlFor="audit-search">
          <input
            id="audit-search"
            className={s.field}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Commande, acteur, cible, motif…"
            type="search"
          />
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
                    {row.actor_kind === 'agent' ? <Chip tone="stone">Agent</Chip> : null} {row.actor}
                  </td>
                  <td>
                    <strong>{row.command}</strong>
                    <div className={s.rowFlexWrap} style={{ marginTop: 4 }}>
                      {row.solo ? <Chip tone="warn">Validé seul · mode solo</Chip> : null}
                      {row.pii ? <Chip tone="info">Accès sensible · 15 min</Chip> : null}
                      {row.actor_kind === 'systeme' ? <Chip tone="stone">Système</Chip> : null}
                    </div>
                  </td>
                  <td className={s.mono}>
                    {row.target_kind ? `${row.target_kind} ` : ''}
                    {row.target_id ?? '—'}
                  </td>
                  <td>{row.reason ?? <span className={s.muted}>—</span>}</td>
                  <td className={s.mono}>{beforeAfter(row)}</td>
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
        ) : (
          <span className={s.muted} style={{ fontSize: 12.5 }}>Fin de la période chargée.</span>
        )}
      </div>
    </>
  );
}
