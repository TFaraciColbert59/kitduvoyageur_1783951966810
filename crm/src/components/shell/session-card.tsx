import s from '@/ui/crm.module.css';
import { Label } from '@/ui/card';
import type { StaffContext } from '@/lib/rpc';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super admin',
  responsable: 'Responsable de pôle',
  membre: 'Membre d’équipe'
};

/** Carte « Votre session » : ce que la session autorise, sans chiffre inventé. */
export function SessionCard({ ctx }: { ctx: StaffContext | null }) {
  const role = ctx?.role ? (ROLE_LABEL[ctx.role] ?? 'non renseigné') : 'non renseigné';
  return (
    <div className={s.sessionCard}>
      <Label>Votre session</Label>
      <span style={{ fontSize: 13 }}>Rôle : <strong>{role}</strong></span>
      <span style={{ fontSize: 13 }}>
        Cas sensibles traités : <strong>non renseigné</strong>
      </span>
      <span className={s.muted} style={{ fontSize: 12 }}>
        Plafond : 10 cas sensibles par session, une pause vous sera proposée.
      </span>
      {ctx?.solo ? (
        <span className={s.muted} style={{ fontSize: 12 }}>
          Mode solo : vous validez seul, le journal le marque.
        </span>
      ) : null}
    </div>
  );
}
