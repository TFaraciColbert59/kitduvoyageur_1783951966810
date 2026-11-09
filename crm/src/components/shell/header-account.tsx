'use client';

import { usePathname } from 'next/navigation';
import s from '../../ui/crm.module.css';
import { Avatar } from '../../ui/avatar';
import type { StaffContext } from '../../lib/rpc';
import { NotificationsButton } from './notifications-button';
import { RealtimeChip } from './realtime-chip';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super admin',
  responsable: 'Responsable',
  membre: 'Membre d’équipe'
};

/**
 * Partie droite de l'en-tête. La maquette montre l'état temps réel, la cloche et
 * l'identité complète sur l'accueil ; les écrans de travail gardent seulement le
 * mode solo et l'avatar (gabarits Moderation/Membre/Agents/Journal).
 */
export function HeaderAccount({ ctx, pendingApprovals }: { ctx: StaffContext | null; pendingApprovals: number | null }) {
  const pathname = usePathname();
  const full = pathname === '/';
  const role = ctx?.role ? (ROLE_LABEL[ctx.role] ?? 'Rôle non renseigné') : 'Session non renseignée';

  return (
    <div className={s.headerRight}>
      {full ? (
        <>
          <span className={s.hiddenSm}>
            <RealtimeChip />
          </span>
          <NotificationsButton pending={pendingApprovals} />
        </>
      ) : null}
      <span className={s.rowFlex}>
        <Avatar name={ctx?.initials ?? ctx?.display_name} size={36} tone="primary" />
        {full ? (
          <span className={s.col} style={{ lineHeight: 1.2 }}>
            <strong style={{ fontSize: 13 }}>{ctx?.display_name ?? 'Session non renseignée'}</strong>
            <span className={s.muted} style={{ fontSize: 12 }}>{role}</span>
          </span>
        ) : null}
      </span>
    </div>
  );
}
