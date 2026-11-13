import Link from 'next/link';
import { AuthCard } from '../../components/auth/auth-card';
import { MfaPanel } from '../../components/auth/mfa-panel';
import s from '../../ui/crm.module.css';

export const metadata = { title: 'Double authentification — LKDV Control', robots: { index: false, follow: false } };

/** Double authentification : enrôlement TOTP + vérification. */
export default function MfaPage() {
  return (
    <AuthCard
      title="Double authentification"
      subtitle="Un second facteur est exigé à chaque connexion (EX-AUTH-02)."
      footer={
        <span>
          Un problème d’accès ?{' '}
          <Link href="/acces-refuse" style={{ fontWeight: 600 }}>
            Voir la marche à suivre
          </Link>
          . Aucune désactivation n’est possible depuis cet écran.
        </span>
      }
    >
      <MfaPanel />
      <div className={s.rowFlexWrap} style={{ justifyContent: 'space-between' }}>
        <Link href="/connexion" className={s.linkAction}>
          ← Revenir à la connexion
        </Link>
      </div>
    </AuthCard>
  );
}
