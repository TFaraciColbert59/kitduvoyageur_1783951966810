'use client';

import s from './crm.module.css';
import { useOnline } from './use-online';

/**
 * Hors connexion : bandeau, actions mises en attente et rejouées.
 * Les écritures sont refusées côté client tant que la connexion n'est pas revenue.
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className={s.banner} role="status" style={{ borderRadius: 0, borderBottom: '1px solid var(--lkv-border)' }}>
      <span>
        <strong>Hors connexion.</strong> La file affichée peut être incomplète. Les actions sont mises en attente et
        rejouées dès le retour du réseau — ne fermez pas cet onglet.
      </span>
    </div>
  );
}
