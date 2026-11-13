import Link from 'next/link';
import { AuthCard } from '../../components/auth/auth-card';
import { LoginForm } from '../../components/auth/login-form';
import s from '../../ui/crm.module.css';

export const metadata = { title: 'Connexion — LKDV Control', robots: { index: false, follow: false } };

/** Connexion (EX-AUTH). Carte centrée, sobre. */
export default function LoginPage() {
  return (
    <AuthCard
      title="Connexion"
      subtitle="LKDV Control — l’accès est réservé à l’équipe."
      footer={
        <span>
          Accès refusé alors que vos identifiants sont bons ?{' '}
          <Link href="/acces-refuse" className={s.linkAction}>
            Voir la marche à suivre
          </Link>
          .
        </span>
      }
    >
      <LoginForm />
      <div className={s.rowFlexWrap} style={{ justifyContent: 'space-between' }}>
        <span className={s.muted} style={{ fontSize: 12.5 }}>
          Double authentification obligatoire
        </span>
        <Link href="/double-authentification" className={s.linkAction}>
          Vérifier un code →
        </Link>
      </div>
    </AuthCard>
  );
}
