import type { ReactNode } from 'react';
import s from '../../ui/crm.module.css';
import { Chip } from '../../ui/chip';
import { BrandMark } from '../../ui/icons';
import { OfflineBanner } from '../../ui/offline-banner';
import type { StaffContext } from '../../lib/rpc';
import { CommandBar } from '../command/command-bar';
import { HeaderAccount } from './header-account';
import { NavPoles, type NavPole } from './nav-poles';
import { SessionCard } from './session-card';

/**
 * Coque du CRM (maquette `Main.dc.html`) :
 * en-tête (logo, ⌘K, mode solo, temps réel, notifications, compte),
 * navigation gauche avec compteurs, zone centrale, rail de contexte.
 */
export function AppShell({
  ctx,
  poles,
  pendingApprovals,
  queueTotal = null,
  teamCount = null,
  children
}: {
  ctx: StaffContext | null;
  poles: NavPole[];
  pendingApprovals: number | null;
  queueTotal?: number | null;
  teamCount?: number | null;
  children: ReactNode;
}) {
  const known = poles.filter((pole) => pole.count !== null);
  const total = queueTotal ?? (known.length === 0 ? null : known.reduce((sum, pole) => sum + (pole.count ?? 0), 0));

  return (
    <div className={s.shell}>
      <header className={s.header}>
        <div className={s.brandBlock}>
          <BrandMark />
          <span className={s.brandName}>LKDV Control</span>
        </div>

        <CommandBar ctx={ctx} />

        <div className={s.headerRight}>
          {ctx?.solo ? <Chip tone="warn">Mode solo · vous validez seul</Chip> : null}
          <HeaderAccount ctx={ctx} pendingApprovals={pendingApprovals} />
        </div>
      </header>

      <OfflineBanner />

      <div className={s.body}>
        <NavPoles poles={poles} total={total} teamCount={teamCount} sessionCard={<SessionCard ctx={ctx} />} />
        {children}
      </div>
    </div>
  );
}
