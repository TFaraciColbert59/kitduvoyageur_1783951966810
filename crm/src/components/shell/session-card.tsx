'use client';

import { usePathname } from 'next/navigation';
import s from '../../ui/crm.module.css';
import { Label } from '../../ui/card';
import type { StaffContext } from '../../lib/rpc';


/** Carte « Votre session » : ce que la session autorise, sans chiffre inventé. */
export function SessionCard({ ctx }: { ctx: StaffContext | null }) {
  const pathname = usePathname();
  // La maquette place la carte de session dans le rail sur la carte de décision.
  // La maquette ne montre la carte de session que sur l'accueil.
  if (pathname !== '/') return null;
  return (
    <div className={s.sessionCard}>
      <Label>Votre session</Label>
      <span style={{ fontSize: 13 }}>
        Cas sensibles :{' '}
        <strong>
          {typeof ctx?.sensitive_today === 'number' ? ctx.sensitive_today : 'non renseigné'}
          {typeof ctx?.sensitive_cap === 'number' ? ` / ${ctx.sensitive_cap}` : ''}
        </strong>
      </span>
      <span className={s.muted} style={{ fontSize: 12 }}>
        Une pause vous sera proposée à {ctx?.sensitive_cap ?? 10}.
      </span>
    </div>
  );
}
