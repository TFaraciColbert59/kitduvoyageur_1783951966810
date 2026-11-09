'use client';

import { useEffect, useMemo, useState } from 'react';
import s from '@/ui/crm.module.css';
import { cx } from '@/ui/cx';
import { Button } from '@/ui/button';
import { Chip } from '@/ui/chip';
import { Field, Select, TextInput } from '@/ui/field';
import { EmptyState, SkeletonList } from '@/ui/states';
import { canRun } from '@/lib/rbac';
import type { PoleCode, StaffContext } from '@/lib/rpc';
import { loadCatalog, matches, POLE_LABELS, type CatalogCommand } from '@/components/command/catalog';
import { CommandDrawer } from '@/components/command/command-drawer';

/**
 * Catalogue complet : les 144 actions du registre, filtrables, toutes exécutables.
 * Aucune action n'est atteignable seulement par le code.
 */
export function CatalogueScreen({
  ctx,
  initialPole,
  initialQuery
}: {
  ctx: StaffContext | null;
  initialPole?: string;
  initialQuery?: string;
}) {
  const [catalog, setCatalog] = useState<CatalogCommand[]>([]);
  const [source, setSource] = useState<'base' | 'registre'>('registre');
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState(initialQuery ?? '');
  const [pole, setPole] = useState(initialPole ?? 'tous');
  const [drawer, setDrawer] = useState<CatalogCommand | null>(null);

  useEffect(() => {
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
  }, []);

  const rows = useMemo(() => {
    const allowed = catalog.filter((command) => {
      if (!ctx) return true;
      return canRun({ role: ctx.role, poles: ctx.poles.map((item) => ({ code: item.code, role: item.role })) }, command);
    });
    return allowed
      .filter((command) => (pole === 'tous' ? true : command.pole === pole))
      .filter((command) => matches(command, query));
  }, [catalog, ctx, pole, query]);

  return (
    <>
      <div className={s.between} style={{ alignItems: 'flex-end' }}>
        <div className={s.col} style={{ gap: 4 }}>
          <h1 className={s.titleSm} style={{ fontSize: 28 }}>Catalogue des actions</h1>
          <span className={s.subtitle}>
            {catalog.length} actions au registre · {rows.length} affichée{rows.length > 1 ? 's' : ''} pour votre rôle
            {source === 'registre' ? ' · registre généré (base non joignable)' : ''}
          </span>
        </div>
      </div>

      <div className={s.rowFlexWrap} style={{ alignItems: 'flex-end' }}>
        <Field label="Rechercher une action" htmlFor="catalog-search">
          <TextInput
            id="catalog-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex. rembourser, bannir, signalement…"
          />
        </Field>
        <Field label="Pôle" htmlFor="catalog-pole">
          <Select id="catalog-pole" value={pole} onChange={(event) => setPole(event.target.value)}>
            <option value="tous">Tous les pôles</option>
            {Object.entries(POLE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {!loaded ? (
        <div className={s.card}>
          <SkeletonList rows={8} />
        </div>
      ) : rows.length === 0 ? (
        <div className={s.card}>
          <EmptyState title="Aucune action ne correspond">
            Changez de mot ou de pôle. Les actions réservées à un autre rôle n’apparaissent jamais ici.
          </EmptyState>
        </div>
      ) : (
        <section className={cx(s.card, s.tableWrap)} aria-label="Actions du catalogue">
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Réf.</th>
                <th scope="col">Action</th>
                <th scope="col">Pôle</th>
                <th scope="col">Rôle min.</th>
                <th scope="col">Garde-fous</th>
                <th scope="col">Exécuter</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((command) => (
                <tr key={command.command}>
                  <td className={s.mono}>{command.id}</td>
                  <td>
                    <strong>{command.label}</strong>
                    <div className={s.mono} style={{ fontSize: 11.5, color: 'var(--lkv-text-secondary)' }}>{command.command}</div>
                  </td>
                  <td>{POLE_LABELS[command.pole] ?? command.pole}</td>
                  <td>{command.roleMin === 'super_admin' ? 'Super admin' : command.roleMin === 'responsable' ? 'Responsable' : 'Membre'}</td>
                  <td>
                    <span className={s.rowFlexWrap}>
                      {command.needsValidation ? <Chip tone="info">2 personnes</Chip> : null}
                      {command.reasonRequired ? <Chip tone="warn">Motif</Chip> : null}
                      {command.undoable ? <Chip tone="sage">Annul. 10 s</Chip> : null}
                      {command.agent === 'never' ? <Chip tone="stone">Aucun agent</Chip> : null}
                    </span>
                  </td>
                  <td>
                    <Button tone="soft" size="sm" onClick={() => setDrawer(command)}>
                      Ouvrir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <CommandDrawer open={drawer !== null} command={drawer} ctx={ctx} onClose={() => setDrawer(null)} />
    </>
  );
}

export function poleLabel(code: string): string {
  return POLE_LABELS[code as PoleCode] ?? code;
}
