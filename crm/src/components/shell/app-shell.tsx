import type { ReactNode } from 'react';
import s from '../../ui/crm.module.css';
import { Avatar } from '../../ui/avatar';
import { Chip } from '../../ui/chip';
import { BrandMark } from '../../ui/icons';
import { OfflineBanner } from '../../ui/offline-banner';
import type { StaffContext } from '../../lib/rpc';
import { CommandBar } from '../command/command-bar';
import { NavPoles, type NavPole } from './nav-poles';
import { NotificationsButton } from './notifications-button';
import { RealtimeChip } from './realtime-chip';
import { SessionCard } from './session-card';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super admin',
  responsable: 'Responsable',
  membre: 'Membre d’équipe'
};

/**
 * Coque du CRM (maquette `Main.dc.html`) :
 * en-tête (logo, ⌘K, mode solo, temps réel, notifications, compte),
 * navigation gauche avec compteurs, zone centrale, rail de contexte.
 */
export function AppShell({
  ctx,
  poles,
  pendingApprovals,
  children
}: {
  ctx: StaffContext | null;
  poles: NavPole[];
  pendingApprovals: number | null;
  children: ReactNode;
}) {
  const known = poles.filter((pole) => pole.count !== null);
  const total = known.length === 0 ? null : known.reduce((sum, pole) => sum + (pole.count ?? 0), 0);
  const role = ctx?.role ? (ROLE_LABEL[ctx.role] ?? 'Rôle non renseigné') : 'Session non renseignée';

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
          <span className={s.hiddenSm}>
            <RealtimeChip />
          </span>
          <NotificationsButton pending={pendingApprovals} />
          <span className={s.rowFlex}>
            <Avatar name={ctx?.display_name} size={36} tone="primary" />
            <span className={s.col} style={{ lineHeight: 1.2 }}>
              <strong style={{ fontSize: 13 }}>{ctx?.display_name ?? 'Session non renseignée'}</strong>
              <span className={s.muted} style={{ fontSize: 12 }}>
                {role}
              </span>
            </span>
          </span>
        </div>
      </header>

      <OfflineBanner />

      <div className={s.body}>
        <NavPoles poles={poles} total={total} sessionCard={<SessionCard ctx={ctx} />} />
        {children}
      </div>
    </div>
  );
}
