import Link from 'next/link';
import s from '../../ui/crm.module.css';
import { AuthCard } from '../../components/auth/auth-card';
import { SignOutButton } from '../../components/auth/sign-out-button';
import { Banner } from '../../ui/states';

export const metadata = { title: 'Accès refusé — LKDV Control', robots: { index: false, follow: false } };

/** Accès refusé : la cause la plus probable, et quoi faire. */
export default function AccessDeniedPage() {
  return (
    <AuthCard
      title="Accès refusé"
      subtitle="Votre session ne donne pas accès au CRM, ou la double authentification n’est pas vérifiée."
      footer={
        <span>
          <Link href="/connexion" style={{ fontWeight: 600 }}>
            Revenir à la connexion
          </Link>
        </span>
      }
    >
      <Banner tone="warn" title="Les causes possibles">
        <span className={s.colGapSm}>
          <span>1. La double authentification n’a pas été vérifiée sur cette session.</span>
          <span>2. Votre compte n’a pas de rôle d’équipe actif (super admin, responsable ou membre de pôle).</span>
          <span>3. La session a expiré (12 h maximum) ou a été verrouillée après 30 minutes d’inactivité.</span>
        </span>
      </Banner>

      <div className={s.colGapSm}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Quoi faire</span>
        <span className={s.muted} style={{ fontSize: 13 }}>
          Vérifiez d’abord la double authentification, puis reconnectez-vous. Si l’accès reste refusé, demandez à un
          super admin d’ouvrir votre rôle — cette demande passe par la commande « staff_manage » et laisse une ligne au
          journal.
        </span>
      </div>

      <div className={s.rowFlexWrap}>
        <Link href="/double-authentification" className={`${s.btn} ${s.btnPg}`} style={{ minHeight: 44 }}>
          Vérifier la double authentification
        </Link>
        <SignOutButton />
      </div>

      <span className={s.muted} style={{ fontSize: 12.5 }}>
        Aucune porte dérobée, aucun mode debug : le refus est décidé côté base, pas dans le navigateur.
      </span>
    </AuthCard>
  );
}
