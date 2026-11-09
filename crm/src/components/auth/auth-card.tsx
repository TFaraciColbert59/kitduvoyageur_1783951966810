import type { ReactNode } from 'react';
import s from '@/ui/crm.module.css';
import { BrandMark } from '@/ui/icons';

/** Carte centrée et sobre des écrans d'accès (connexion, double authentification). */
export function AuthCard({
  title,
  subtitle,
  children,
  footer
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--lkv-surface)'
      }}
    >
      <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className={s.rowFlex} style={{ gap: 10 }}>
          <BrandMark />
          <span className={s.brandName}>LKDV Control</span>
        </div>

        <div className={`${s.card} ${s.padLg}`} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className={s.col} style={{ gap: 4 }}>
            <h1 className={s.titleSm} style={{ fontSize: 24 }}>
              {title}
            </h1>
            {subtitle ? <span className={s.muted} style={{ fontSize: 13 }}>{subtitle}</span> : null}
          </div>
          {children}
        </div>

        {footer ? <div className={s.muted} style={{ fontSize: 12.5 }}>{footer}</div> : null}
      </div>
    </div>
  );
}
